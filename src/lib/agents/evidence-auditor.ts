/**
 * Evidence Auditor Module
 * 
 * Based on RhinoInsight framework (arxiv:2511.18743)
 * Structures search content, iteratively updates outlines, prunes noisy context,
 * and binds high-quality evidence to claims to ensure verifiability and reduce hallucinations.
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import type { Citation } from '@/types/research';
import type { Paper } from '@/types/paper';
import { openrouter, MODELS } from '@/lib/models';

// ============================================
// Types
// ============================================

/**
 * Verification status for evidence
 */
export type EvidenceVerificationStatus = 'verified' | 'uncertain' | 'contradicted' | 'unsupported';

/**
 * A single piece of evidence supporting a claim
 */
export interface Evidence {
  id: string;
  paperId: string;
  paperTitle: string;
  paperYear: number;
  excerpt: string;              // Relevant text from the paper
  relevanceScore: number;       // 0-100 relevance to the claim
  verificationStatus: EvidenceVerificationStatus;
  confidence: number;           // 0-100 confidence in this evidence
}

/**
 * A claim extracted from the report with its evidence bindings
 */
export interface ClaimBinding {
  id: string;
  claim: string;                // The claim text from the report
  location: {
    section?: string;
    paragraph?: number;
    characterStart?: number;
    characterEnd?: number;
  };
  citationIds: string[];        // Citation IDs used for this claim
  evidence: Evidence[];         // Evidence supporting this claim
  auditResult: {
    isGrounded: boolean;        // Whether claim is grounded in evidence
    groundingScore: number;     // 0-100 grounding confidence
    verificationStatus: EvidenceVerificationStatus;
    issues: string[];           // Identified issues
    suggestions: string[];      // Suggestions for improvement
  };
}

/**
 * Complete audit result for a report
 */
export interface EvidenceAuditResult {
  id: string;
  sessionId: string;
  totalClaims: number;
  groundedClaims: number;
  uncertainClaims: number;
  unsupportedClaims: number;
  contradictedClaims: number;
  overallGroundingScore: number;  // 0-100
  claimBindings: ClaimBinding[];
  summary: string;
  criticalIssues: string[];
  recommendations: string[];
  auditedAt: number;
}

/**
 * Hallucination detection result
 */
export interface HallucinationDetection {
  claimId: string;
  claim: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'fabrication' | 'exaggeration' | 'misattribution' | 'contradiction';
  explanation: string;
  suggestedFix?: string;
}

// ============================================
// Schemas
// ============================================

const ClaimExtractionSchema = z.object({
  claims: z.array(z.object({
    claim: z.string().describe('A factual claim from the report'),
    section: z.string().optional().describe('Section where the claim appears'),
    citationRefs: z.array(z.string()).describe('Citation references used (e.g., "[1]", "(Smith, 2023)")'),
    requiresEvidence: z.boolean().describe('Whether this claim requires evidence support'),
  })).describe('Extracted factual claims from the report'),
});

const EvidenceVerificationSchema = z.object({
  isSupported: z.boolean().describe('Whether the claim is supported by the evidence'),
  relevanceScore: z.number().min(0).max(100).describe('How relevant the paper is to the claim'),
  confidence: z.number().min(0).max(100).describe('Confidence in the verification'),
  status: z.enum(['verified', 'uncertain', 'contradicted', 'unsupported']).describe('Verification status'),
  relevantExcerpt: z.string().describe('Most relevant excerpt from the paper'),
  reasoning: z.string().describe('Reasoning for the verification'),
});

const HallucinationCheckSchema = z.object({
  isHallucination: z.boolean().describe('Whether this appears to be a hallucination'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Severity if hallucination'),
  type: z.enum(['fabrication', 'exaggeration', 'misattribution', 'contradiction']).optional(),
  explanation: z.string().describe('Explanation of the assessment'),
  suggestedFix: z.string().optional().describe('Suggested correction'),
});

// ============================================
// Core Functions
// ============================================

/**
 * Generate a unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Extract factual claims from report content
 */
export async function extractClaims(
  reportContent: string,
  citations: Citation[],
): Promise<Array<{
  claim: string;
  section?: string;
  citationRefs: string[];
  requiresEvidence: boolean;
}>> {
  const { object } = await generateObject({
    model: openrouter(MODELS.LIGHTWEIGHT),
    schema: ClaimExtractionSchema,
    prompt: `You are an expert academic reviewer extracting factual claims from a research report.

REPORT CONTENT:
${reportContent.slice(0, 12000)}

CITATIONS USED:
${citations.map(c => `${c.inTextRef}: ${c.title} (${c.year})`).join('\n')}

TASK:
Extract all factual claims from the report that:
1. Make specific assertions about facts, findings, or statistics
2. Reference or cite sources
3. Could potentially be verified or contradicted

For each claim:
- Extract the exact claim text
- Note which citations are referenced
- Indicate if it requires evidence (opinions and general statements don't)

Focus on claims that are:
- Specific numerical claims
- Assertions about research findings
- Statements about methodology or results
- Comparative statements

Do NOT extract:
- General introductory statements
- Obvious facts that don't need citation
- The author's own opinions clearly marked as such`,
  });

  return object.claims;
}

/**
 * Verify a single claim against a paper's content
 */
export async function verifyClaim(
  claim: string,
  paper: Paper,
): Promise<{
  isSupported: boolean;
  relevanceScore: number;
  confidence: number;
  status: EvidenceVerificationStatus;
  relevantExcerpt: string;
  reasoning: string;
}> {
  const paperContent = paper.fullText || paper.abstract || '';
  
  const { object } = await generateObject({
    model: openrouter(MODELS.LIGHTWEIGHT),
    schema: EvidenceVerificationSchema,
    prompt: `You are verifying whether a claim from a research report is supported by a source paper.

CLAIM TO VERIFY:
"${claim}"

SOURCE PAPER:
Title: ${paper.title}
Authors: ${paper.authors.map(a => a.name).join(', ')}
Year: ${paper.year}
Content: ${paperContent.slice(0, 4000)}

TASK:
1. Determine if the paper supports, contradicts, or is unrelated to the claim
2. Find the most relevant excerpt from the paper
3. Assess confidence in your verification
4. Provide reasoning

VERIFICATION STATUS:
- "verified": Paper clearly supports the claim
- "uncertain": Paper partially supports or the connection is unclear
- "contradicted": Paper contradicts the claim
- "unsupported": Paper doesn't address the claim at all`,
  });

  return object;
}

/**
 * Check if a claim might be a hallucination
 */
export async function checkForHallucination(
  claim: string,
  citedPapers: Paper[],
  verificationResults: Array<{ status: EvidenceVerificationStatus; confidence: number }>,
): Promise<HallucinationDetection | null> {
  // If no verification found any support, potential hallucination
  const anySupport = verificationResults.some(
    r => r.status === 'verified' || (r.status === 'uncertain' && r.confidence > 50)
  );

  if (anySupport) {
    return null; // Claim has support, not a hallucination
  }

  const paperContext = citedPapers.slice(0, 5).map(p => ({
    title: p.title,
    year: p.year,
    abstract: p.abstract?.slice(0, 300) || '',
  }));

  const { object } = await generateObject({
    model: openrouter(MODELS.LIGHTWEIGHT),
    schema: HallucinationCheckSchema,
    prompt: `You are checking if a claim from a research report might be a hallucination (fabricated or unsupported content).

CLAIM:
"${claim}"

CITED PAPERS (what the claim references):
${paperContext.map((p, i) => `${i + 1}. "${p.title}" (${p.year})\n   ${p.abstract}`).join('\n\n')}

VERIFICATION CONTEXT:
None of the cited papers appear to directly support this claim.

TASK:
Determine if this claim appears to be:
- fabrication: Made up facts or statistics
- exaggeration: Overstating findings from sources
- misattribution: Attributing findings to wrong sources
- contradiction: Stating something opposite to what sources say

Consider:
1. Is this a specific claim that should have clear evidence?
2. Could this be a reasonable inference that doesn't need direct support?
3. Is this a common knowledge statement that doesn't need citation?`,
  });

  if (!object.isHallucination) {
    return null;
  }

  return {
    claimId: generateId('hall'),
    claim,
    severity: object.severity,
    type: object.type || 'fabrication',
    explanation: object.explanation,
    suggestedFix: object.suggestedFix,
  };
}

/**
 * Audit all evidence in a report
 * Main entry point for evidence auditing
 */
export async function auditEvidence(
  reportContent: string,
  citations: Citation[],
  papers: Paper[],
  sessionId: string,
): Promise<EvidenceAuditResult> {
  // Step 1: Extract claims from report
  const extractedClaims = await extractClaims(reportContent, citations);
  
  // Filter to claims that need evidence
  const claimsToVerify = extractedClaims.filter(c => c.requiresEvidence);

  const claimBindings: ClaimBinding[] = [];
  const hallucinations: HallucinationDetection[] = [];

  // Step 2: Verify each claim
  for (const extractedClaim of claimsToVerify) {
    // Find papers referenced by this claim
    const referencedCitations = citations.filter(c => 
      extractedClaim.citationRefs.some(ref => 
        c.inTextRef === ref || c.id === ref
      )
    );
    
    const referencedPapers = papers.filter(p => 
      referencedCitations.some(c => c.paperId === p.id)
    );

    // If no papers found, try to match by citation text
    if (referencedPapers.length === 0) {
      // Use first few papers as fallback for verification
      referencedPapers.push(...papers.slice(0, 3));
    }

    const evidence: Evidence[] = [];
    const verificationResults: Array<{ status: EvidenceVerificationStatus; confidence: number }> = [];

    // Verify against each referenced paper
    for (const paper of referencedPapers.slice(0, 5)) {
      try {
        const result = await verifyClaim(extractedClaim.claim, paper);
        
        evidence.push({
          id: generateId('ev'),
          paperId: paper.id,
          paperTitle: paper.title,
          paperYear: paper.year,
          excerpt: result.relevantExcerpt,
          relevanceScore: result.relevanceScore,
          verificationStatus: result.status,
          confidence: result.confidence,
        });

        verificationResults.push({
          status: result.status,
          confidence: result.confidence,
        });
      } catch (error) {
        console.error(`Failed to verify claim against paper ${paper.id}:`, error);
      }
    }

    // Determine overall verification status for this claim
    const bestEvidence = evidence.reduce((best, e) => 
      (e.confidence > (best?.confidence || 0) && e.verificationStatus === 'verified') ? e : best,
      null as Evidence | null
    );

    let overallStatus: EvidenceVerificationStatus = 'unsupported';
    let groundingScore = 0;

    if (bestEvidence?.verificationStatus === 'verified') {
      overallStatus = 'verified';
      groundingScore = bestEvidence.confidence;
    } else if (evidence.some(e => e.verificationStatus === 'contradicted')) {
      overallStatus = 'contradicted';
      groundingScore = 0;
    } else if (evidence.some(e => e.verificationStatus === 'uncertain')) {
      overallStatus = 'uncertain';
      groundingScore = Math.max(...evidence.filter(e => e.verificationStatus === 'uncertain').map(e => e.confidence)) * 0.5;
    }

    // Check for hallucination
    if (overallStatus === 'unsupported' || overallStatus === 'contradicted') {
      const hallucinationCheck = await checkForHallucination(
        extractedClaim.claim,
        referencedPapers,
        verificationResults,
      );
      if (hallucinationCheck) {
        hallucinations.push(hallucinationCheck);
      }
    }

    const issues: string[] = [];
    const suggestions: string[] = [];

    if (overallStatus === 'unsupported') {
      issues.push('Claim lacks supporting evidence from cited sources');
      suggestions.push('Add a citation that directly supports this claim, or rephrase as opinion/interpretation');
    }
    if (overallStatus === 'contradicted') {
      issues.push('Claim is contradicted by cited source');
      suggestions.push('Review the cited source and correct the claim to match the evidence');
    }
    if (overallStatus === 'uncertain') {
      issues.push('Evidence support is weak or indirect');
      suggestions.push('Consider adding additional sources or clarifying the connection to evidence');
    }

    claimBindings.push({
      id: generateId('claim'),
      claim: extractedClaim.claim,
      location: {
        section: extractedClaim.section,
      },
      citationIds: referencedCitations.map(c => c.id),
      evidence,
      auditResult: {
        isGrounded: overallStatus === 'verified' || (overallStatus === 'uncertain' && groundingScore >= 50),
        groundingScore,
        verificationStatus: overallStatus,
        issues,
        suggestions,
      },
    });
  }

  // Calculate overall statistics
  const groundedClaims = claimBindings.filter(c => c.auditResult.isGrounded).length;
  const uncertainClaims = claimBindings.filter(c => c.auditResult.verificationStatus === 'uncertain').length;
  const unsupportedClaims = claimBindings.filter(c => c.auditResult.verificationStatus === 'unsupported').length;
  const contradictedClaims = claimBindings.filter(c => c.auditResult.verificationStatus === 'contradicted').length;

  const overallGroundingScore = claimBindings.length > 0
    ? Math.round(claimBindings.reduce((sum, c) => sum + c.auditResult.groundingScore, 0) / claimBindings.length)
    : 100;

  // Generate critical issues and recommendations
  const criticalIssues: string[] = [];
  const recommendations: string[] = [];

  if (contradictedClaims > 0) {
    criticalIssues.push(`${contradictedClaims} claims are contradicted by their cited sources`);
    recommendations.push('Immediately review and correct contradicted claims');
  }
  if (hallucinations.filter(h => h.severity === 'critical' || h.severity === 'high').length > 0) {
    criticalIssues.push(`${hallucinations.filter(h => h.severity === 'critical' || h.severity === 'high').length} potential hallucinations detected`);
    recommendations.push('Review flagged hallucinations and either add supporting evidence or remove claims');
  }
  if (unsupportedClaims > claimBindings.length * 0.3) {
    criticalIssues.push(`Over 30% of claims lack supporting evidence`);
    recommendations.push('Add more citations or rephrase unsupported claims as interpretations');
  }

  const summary = `Evidence Audit: ${groundedClaims}/${claimBindings.length} claims grounded (${overallGroundingScore}%). ` +
    `${uncertainClaims} uncertain, ${unsupportedClaims} unsupported, ${contradictedClaims} contradicted. ` +
    `${hallucinations.length} potential hallucinations detected.`;

  return {
    id: generateId('audit'),
    sessionId,
    totalClaims: claimBindings.length,
    groundedClaims,
    uncertainClaims,
    unsupportedClaims,
    contradictedClaims,
    overallGroundingScore,
    claimBindings,
    summary,
    criticalIssues,
    recommendations,
    auditedAt: Date.now(),
  };
}

/**
 * Get high-severity issues from audit result
 */
export function getCriticalAuditIssues(audit: EvidenceAuditResult): ClaimBinding[] {
  return audit.claimBindings.filter(
    c => c.auditResult.verificationStatus === 'contradicted' ||
    (c.auditResult.verificationStatus === 'unsupported' && c.evidence.length > 0)
  );
}

/**
 * Generate feedback for improving grounding based on audit
 */
export function generateAuditFeedback(audit: EvidenceAuditResult): string {
  let feedback = `## Evidence Audit Feedback\n\n`;
  feedback += `**Overall Grounding Score: ${audit.overallGroundingScore}/100**\n\n`;

  if (audit.criticalIssues.length > 0) {
    feedback += `### Critical Issues\n`;
    audit.criticalIssues.forEach(issue => {
      feedback += `- ⚠️ ${issue}\n`;
    });
    feedback += '\n';
  }

  if (audit.recommendations.length > 0) {
    feedback += `### Recommendations\n`;
    audit.recommendations.forEach(rec => {
      feedback += `- ${rec}\n`;
    });
    feedback += '\n';
  }

  // List specific problematic claims
  const problematicClaims = audit.claimBindings.filter(
    c => !c.auditResult.isGrounded
  ).slice(0, 5);

  if (problematicClaims.length > 0) {
    feedback += `### Claims Needing Attention\n`;
    problematicClaims.forEach((claim, i) => {
      feedback += `${i + 1}. "${claim.claim.slice(0, 100)}..."\n`;
      feedback += `   Status: ${claim.auditResult.verificationStatus}\n`;
      if (claim.auditResult.suggestions.length > 0) {
        feedback += `   Suggestion: ${claim.auditResult.suggestions[0]}\n`;
      }
      feedback += '\n';
    });
  }

  return feedback;
}

/**
 * Check if audit passes minimum quality threshold
 */
export function auditPassesThreshold(
  audit: EvidenceAuditResult,
  minGroundingScore: number = 60,
  maxContradictions: number = 0,
): boolean {
  return (
    audit.overallGroundingScore >= minGroundingScore &&
    audit.contradictedClaims <= maxContradictions
  );
}

