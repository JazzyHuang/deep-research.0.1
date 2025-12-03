import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { Paper } from '@/types/paper';
import type { Citation, CitationValidation } from '@/types/research';
import { openAlex } from '@/lib/data-sources';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Crossref API for DOI validation
const CROSSREF_API = 'https://api.crossref.org/works';

interface CrossrefWork {
  DOI: string;
  title: string[];
  author?: { given?: string; family?: string }[];
  published?: { 'date-parts': number[][] };
  'is-referenced-by-count'?: number;
}

/**
 * Verify that a DOI exists and matches the paper metadata
 */
export async function verifyDoi(
  doi: string,
  expectedTitle?: string,
  expectedYear?: number,
): Promise<{
  exists: boolean;
  matches: boolean;
  crossrefData?: CrossrefWork;
  issues: string[];
}> {
  const issues: string[] = [];
  
  if (!doi) {
    return { exists: false, matches: false, issues: ['No DOI provided'] };
  }

  try {
    // Clean DOI
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, '').trim();
    
    const response = await fetch(`${CROSSREF_API}/${encodeURIComponent(cleanDoi)}`, {
      headers: {
        'User-Agent': 'DeepResearch/1.0 (mailto:research@example.com)',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { exists: false, matches: false, issues: ['DOI not found in Crossref'] };
      }
      throw new Error(`Crossref API error: ${response.status}`);
    }

    const data = await response.json();
    const work: CrossrefWork = data.message;

    // Verify title matches (fuzzy)
    let titleMatches = true;
    if (expectedTitle && work.title?.[0]) {
      const normalizedExpected = expectedTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedActual = work.title[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Check if titles are similar (at least 70% overlap)
      const overlap = calculateSimilarity(normalizedExpected, normalizedActual);
      if (overlap < 0.7) {
        titleMatches = false;
        issues.push(`Title mismatch: expected "${expectedTitle.slice(0, 50)}...", got "${work.title[0].slice(0, 50)}..."`);
      }
    }

    // Verify year matches
    let yearMatches = true;
    if (expectedYear && work.published?.['date-parts']?.[0]?.[0]) {
      const actualYear = work.published['date-parts'][0][0];
      if (Math.abs(actualYear - expectedYear) > 1) { // Allow 1 year difference
        yearMatches = false;
        issues.push(`Year mismatch: expected ${expectedYear}, got ${actualYear}`);
      }
    }

    return {
      exists: true,
      matches: titleMatches && yearMatches,
      crossrefData: work,
      issues,
    };
  } catch (error) {
    return {
      exists: false,
      matches: false,
      issues: [`DOI verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Calculate string similarity using Jaccard index on character trigrams
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const getTrigrams = (s: string): Set<string> => {
    const trigrams = new Set<string>();
    for (let i = 0; i < s.length - 2; i++) {
      trigrams.add(s.slice(i, i + 3));
    }
    return trigrams;
  };

  const trigrams1 = getTrigrams(str1);
  const trigrams2 = getTrigrams(str2);

  let intersection = 0;
  for (const t of trigrams1) {
    if (trigrams2.has(t)) intersection++;
  }

  const union = trigrams1.size + trigrams2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Extract claims and their citations from report text
 */
export function extractCitedClaims(
  reportContent: string,
): Array<{ claim: string; citationRefs: string[]; position: number }> {
  const claims: Array<{ claim: string; citationRefs: string[]; position: number }> = [];
  
  // Match sentences that contain citations
  // Pattern: sentence ending with citation(s) [1], [2, 3], etc.
  const sentencePattern = /([^.!?]+(?:\[[^\]]+\])+[^.!?]*[.!?])/g;
  
  let match;
  while ((match = sentencePattern.exec(reportContent)) !== null) {
    const sentence = match[1].trim();
    const position = match.index;
    
    // Extract citation references
    const citationPattern = /\[(\d+(?:,\s*\d+)*)\]/g;
    const citationRefs: string[] = [];
    
    let citationMatch;
    while ((citationMatch = citationPattern.exec(sentence)) !== null) {
      const refs = citationMatch[1].split(',').map(r => r.trim());
      citationRefs.push(...refs);
    }

    if (citationRefs.length > 0) {
      // Remove citations from claim text for cleaner analysis
      const claimText = sentence.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '').trim();
      
      claims.push({
        claim: claimText,
        citationRefs,
        position,
      });
    }
  }

  return claims;
}

/**
 * Validate that a citation supports the claim it's used for
 */
export async function validateCitationSupport(
  claim: string,
  paper: Paper,
): Promise<{
  supports: boolean;
  relevanceScore: number;
  explanation: string;
}> {
  const { object } = await generateObject({
    model: openrouter('openai/gpt-4o-mini'),
    schema: z.object({
      supports: z.boolean().describe('Whether the paper likely supports this claim'),
      relevanceScore: z.number().min(0).max(10).describe('How relevant the paper is to the claim (0-10)'),
      explanation: z.string().describe('Brief explanation of the assessment'),
    }),
    prompt: `Evaluate if this academic paper supports the claim made.

CLAIM: "${claim}"

PAPER DETAILS:
Title: ${paper.title}
Year: ${paper.year}
Abstract: ${paper.abstract?.slice(0, 800) || 'No abstract available'}
${paper.journal ? `Journal: ${paper.journal}` : ''}

Assess:
1. Does the paper's topic align with the claim?
2. Does the abstract suggest findings that would support the claim?
3. Is this a reasonable citation for this claim?

Note: You only have the abstract, so assess based on likely relevance.
Be generous - if the paper seems topically relevant, it likely supports the claim.`,
  });

  return object;
}

/**
 * Validate all citations in a report
 */
export async function validateAllCitations(
  reportContent: string,
  citations: Citation[],
  papers: Paper[],
): Promise<CitationValidation[]> {
  const results: CitationValidation[] = [];
  
  // Create paper lookup
  const paperMap = new Map<string, Paper>();
  papers.forEach(p => paperMap.set(p.id, p));
  
  // Create citation lookup by reference number
  const citationByRef = new Map<string, Citation>();
  citations.forEach(c => {
    const refNum = c.inTextRef.replace(/[\[\]]/g, '');
    citationByRef.set(refNum, c);
  });

  // Extract claims with citations
  const claims = extractCitedClaims(reportContent);
  
  // Group claims by citation
  const claimsByCitation = new Map<string, string[]>();
  for (const { claim, citationRefs } of claims) {
    for (const ref of citationRefs) {
      if (!claimsByCitation.has(ref)) {
        claimsByCitation.set(ref, []);
      }
      claimsByCitation.get(ref)!.push(claim);
    }
  }

  // Validate each citation
  for (const [ref, citation] of citationByRef) {
    const paper = paperMap.get(citation.paperId);
    const claimsForCitation = claimsByCitation.get(ref) || [];
    
    const validation: CitationValidation = {
      citationId: citation.id,
      paperId: citation.paperId,
      isValid: true,
      paperExists: !!paper,
      claimSupported: true,
      relevanceScore: 10,
      issues: [],
    };

    // Check if paper exists
    if (!paper) {
      validation.isValid = false;
      validation.paperExists = false;
      validation.issues.push('Referenced paper not found in sources');
      results.push(validation);
      continue;
    }

    // Verify DOI if available
    if (paper.doi) {
      const doiVerification = await verifyDoi(paper.doi, paper.title, paper.year);
      if (!doiVerification.exists) {
        validation.issues.push('DOI could not be verified');
      } else if (!doiVerification.matches) {
        validation.issues.push(...doiVerification.issues);
      }
    }

    // Check if citation supports the claims (sample check - don't check all claims)
    if (claimsForCitation.length > 0) {
      // Check first claim only to save API calls
      const sampleClaim = claimsForCitation[0];
      const supportCheck = await validateCitationSupport(sampleClaim, paper);
      
      validation.claimSupported = supportCheck.supports;
      validation.relevanceScore = supportCheck.relevanceScore;
      
      if (!supportCheck.supports) {
        validation.issues.push(`May not support claim: "${sampleClaim.slice(0, 100)}..."`);
        validation.suggestedFix = supportCheck.explanation;
      }
    }

    // Determine overall validity
    validation.isValid = validation.paperExists && 
                         validation.issues.length === 0 && 
                         validation.relevanceScore >= 5;

    results.push(validation);
  }

  return results;
}

/**
 * Find alternative citations for unsupported claims
 */
export async function suggestAlternativeCitations(
  claim: string,
  availablePapers: Paper[],
  currentCitation?: Citation,
): Promise<Array<{ paper: Paper; relevanceScore: number }>> {
  // Score each paper for relevance to the claim
  const scoredPapers: Array<{ paper: Paper; score: number }> = [];
  
  // Simple keyword matching first
  const claimWords = claim.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  for (const paper of availablePapers) {
    // Skip current citation
    if (currentCitation && paper.id === currentCitation.paperId) continue;
    
    const titleWords = paper.title.toLowerCase().split(/\s+/);
    const abstractWords = (paper.abstract || '').toLowerCase().split(/\s+/);
    const paperWords = new Set([...titleWords, ...abstractWords]);
    
    // Count matching words
    let matchCount = 0;
    for (const word of claimWords) {
      if (paperWords.has(word)) matchCount++;
    }
    
    const score = claimWords.length > 0 ? matchCount / claimWords.length : 0;
    
    if (score > 0.2) {
      scoredPapers.push({ paper, score });
    }
  }

  // Sort by score and return top candidates
  return scoredPapers
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ paper, score }) => ({
      paper,
      relevanceScore: Math.round(score * 10),
    }));
}

/**
 * Generate a citation validation summary
 */
export function generateValidationSummary(
  validations: CitationValidation[],
): {
  totalCitations: number;
  validCitations: number;
  invalidCitations: number;
  issueCount: number;
  averageRelevance: number;
  criticalIssues: string[];
} {
  const validCitations = validations.filter(v => v.isValid).length;
  const invalidCitations = validations.filter(v => !v.isValid).length;
  const issueCount = validations.reduce((sum, v) => sum + v.issues.length, 0);
  
  const relevanceScores = validations.map(v => v.relevanceScore);
  const averageRelevance = relevanceScores.length > 0
    ? relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length
    : 0;

  const criticalIssues = validations
    .filter(v => !v.isValid || v.relevanceScore < 3)
    .flatMap(v => v.issues);

  return {
    totalCitations: validations.length,
    validCitations,
    invalidCitations,
    issueCount,
    averageRelevance: Math.round(averageRelevance * 10) / 10,
    criticalIssues,
  };
}









