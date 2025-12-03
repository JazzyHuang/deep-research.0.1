import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { Paper } from '@/types/paper';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export interface CompressedPaper {
  id: string;
  title: string;
  authors: string;           // Compressed author list
  year: number;
  keyFindings: string[];     // Extracted key findings
  methodology?: string;      // Brief methodology summary
  relevance: string;         // Why it's relevant to the research
  doi?: string;
  citationKey: string;       // For in-text citations
}

export interface CompressedContext {
  papers: CompressedPaper[];
  totalTokensEstimate: number;
  compressionRatio: number;
  summary: string;           // High-level summary of all papers
}

export interface CompressionConfig {
  maxTokensPerPaper: number;     // Target tokens per paper (default: 200)
  maxTotalTokens: number;        // Max total tokens (default: 8000)
  maxPapers: number;             // Max papers to include (default: 30)
  includeMethodology: boolean;   // Include methodology (default: true)
  prioritizeByRelevance: boolean; // Sort by relevance (default: true)
  prioritizeByCitations: boolean; // Sort by citations (default: true)
}

const DEFAULT_CONFIG: CompressionConfig = {
  maxTokensPerPaper: 200,
  maxTotalTokens: 8000,
  maxPapers: 30,
  includeMethodology: true,
  prioritizeByRelevance: true,
  prioritizeByCitations: true,
};

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Compress a single paper's information
 */
export async function compressPaper(
  paper: Paper,
  researchQuestion: string,
  citationIndex: number,
): Promise<CompressedPaper> {
  // If abstract is short, don't need AI compression
  if (!paper.abstract || paper.abstract.length < 300) {
    return {
      id: paper.id,
      title: paper.title,
      authors: formatAuthorsShort(paper.authors.map(a => a.name)),
      year: paper.year,
      keyFindings: paper.abstract ? [paper.abstract] : ['No abstract available'],
      doi: paper.doi,
      citationKey: `[${citationIndex}]`,
      relevance: 'Included based on search relevance',
    };
  }

  try {
    const { object } = await generateObject({
      model: openrouter('openai/gpt-4o-mini'),
      schema: z.object({
        keyFindings: z.array(z.string()).max(3).describe('Key findings or contributions (max 3)'),
        methodology: z.string().optional().describe('Brief methodology summary if applicable'),
        relevance: z.string().describe('One sentence on why this paper is relevant'),
      }),
      prompt: `Extract key information from this paper abstract for a research report on: "${researchQuestion}"

PAPER: ${paper.title} (${paper.year})
ABSTRACT: ${paper.abstract}

Extract:
1. Up to 3 key findings or contributions (be concise, ~20 words each)
2. Brief methodology if mentioned (optional, ~15 words)
3. One sentence on relevance to the research question`,
    });

    return {
      id: paper.id,
      title: paper.title,
      authors: formatAuthorsShort(paper.authors.map(a => a.name)),
      year: paper.year,
      keyFindings: object.keyFindings,
      methodology: object.methodology,
      relevance: object.relevance,
      doi: paper.doi,
      citationKey: `[${citationIndex}]`,
    };
  } catch (error) {
    // Fallback to simple truncation
    return {
      id: paper.id,
      title: paper.title,
      authors: formatAuthorsShort(paper.authors.map(a => a.name)),
      year: paper.year,
      keyFindings: [paper.abstract?.slice(0, 200) || 'No abstract'],
      doi: paper.doi,
      citationKey: `[${citationIndex}]`,
      relevance: 'Search result',
    };
  }
}

/**
 * Format authors in short form (First et al.)
 */
function formatAuthorsShort(authors: string[]): string {
  if (authors.length === 0) return 'Unknown';
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  return `${authors[0]} et al.`;
}

/**
 * Compress multiple papers into a context-efficient format
 */
export async function compressPaperContext(
  papers: Paper[],
  researchQuestion: string,
  config: Partial<CompressionConfig> = {},
): Promise<CompressedContext> {
  const settings = { ...DEFAULT_CONFIG, ...config };
  
  // Sort and limit papers
  let sortedPapers = [...papers];
  
  if (settings.prioritizeByCitations) {
    sortedPapers.sort((a, b) => (b.citations || 0) - (a.citations || 0));
  }
  
  // Take top N papers
  const limitedPapers = sortedPapers.slice(0, settings.maxPapers);
  
  // Compress each paper
  const compressedPapers: CompressedPaper[] = [];
  let totalTokens = 0;
  
  for (let i = 0; i < limitedPapers.length; i++) {
    const paper = limitedPapers[i];
    
    // Check if we're approaching token limit
    if (totalTokens >= settings.maxTotalTokens * 0.9) {
      break;
    }
    
    const compressed = await compressPaper(paper, researchQuestion, i + 1);
    const paperTokens = estimateTokens(JSON.stringify(compressed));
    
    if (totalTokens + paperTokens <= settings.maxTotalTokens) {
      compressedPapers.push(compressed);
      totalTokens += paperTokens;
    }
  }

  // Calculate compression ratio
  const originalTokens = papers.reduce((sum, p) => {
    return sum + estimateTokens(JSON.stringify({
      title: p.title,
      authors: p.authors,
      abstract: p.abstract,
      year: p.year,
    }));
  }, 0);
  
  const compressionRatio = originalTokens > 0 ? totalTokens / originalTokens : 1;

  // Generate summary
  const summary = generateContextSummary(compressedPapers);

  return {
    papers: compressedPapers,
    totalTokensEstimate: totalTokens,
    compressionRatio,
    summary,
  };
}

/**
 * Generate a brief summary of all papers
 */
function generateContextSummary(papers: CompressedPaper[]): string {
  const yearRange = papers.length > 0
    ? `${Math.min(...papers.map(p => p.year))}-${Math.max(...papers.map(p => p.year))}`
    : 'N/A';
  
  return `${papers.length} papers from ${yearRange}. Key sources include: ${
    papers.slice(0, 5).map(p => `${p.citationKey} ${p.authors} (${p.year})`).join(', ')
  }${papers.length > 5 ? ', and others.' : '.'}`;
}

/**
 * Format compressed papers for LLM prompt
 */
export function formatCompressedContext(context: CompressedContext): string {
  let output = `## Research Sources (${context.papers.length} papers)\n\n`;
  output += `${context.summary}\n\n`;
  
  for (const paper of context.papers) {
    output += `### ${paper.citationKey} ${paper.title}\n`;
    output += `${paper.authors} (${paper.year})`;
    if (paper.doi) output += ` | DOI: ${paper.doi}`;
    output += '\n';
    output += `**Relevance:** ${paper.relevance}\n`;
    output += `**Key Findings:**\n`;
    paper.keyFindings.forEach(f => {
      output += `- ${f}\n`;
    });
    if (paper.methodology) {
      output += `**Method:** ${paper.methodology}\n`;
    }
    output += '\n';
  }
  
  return output;
}

/**
 * Create a minimal citation reference list
 */
export function formatCitationList(context: CompressedContext): string {
  return context.papers.map(p => 
    `${p.citationKey} ${p.authors} (${p.year}). ${p.title}. ${p.doi ? `https://doi.org/${p.doi}` : ''}`
  ).join('\n');
}

/**
 * Deduplicate papers based on DOI or title similarity
 */
export function deduplicatePapers(papers: Paper[]): Paper[] {
  const seen = new Map<string, Paper>();
  const seenTitles = new Set<string>();
  
  for (const paper of papers) {
    // Check DOI
    if (paper.doi) {
      const normalizedDoi = paper.doi.toLowerCase().trim();
      if (seen.has(normalizedDoi)) continue;
      seen.set(normalizedDoi, paper);
    }
    
    // Check title similarity
    const normalizedTitle = paper.title.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 50);
    
    if (seenTitles.has(normalizedTitle)) continue;
    seenTitles.add(normalizedTitle);
    
    if (!paper.doi) {
      seen.set(paper.id, paper);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Prioritize papers based on multiple factors
 */
export function prioritizePapers(
  papers: Paper[],
  researchQuestion: string,
  weights: {
    citations?: number;
    recency?: number;
    relevance?: number;
    openAccess?: number;
  } = {},
): Paper[] {
  const w = {
    citations: weights.citations ?? 0.3,
    recency: weights.recency ?? 0.2,
    relevance: weights.relevance ?? 0.4,
    openAccess: weights.openAccess ?? 0.1,
  };
  
  const currentYear = new Date().getFullYear();
  const maxCitations = Math.max(...papers.map(p => p.citations || 0), 1);
  
  // Calculate keyword relevance
  const keywords = researchQuestion.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  const scoredPapers = papers.map(paper => {
    // Citation score (0-1)
    const citationScore = (paper.citations || 0) / maxCitations;
    
    // Recency score (0-1)
    const age = currentYear - paper.year;
    const recencyScore = Math.max(0, 1 - age / 20); // Papers older than 20 years get 0
    
    // Keyword relevance score (0-1)
    const titleLower = paper.title.toLowerCase();
    const abstractLower = (paper.abstract || '').toLowerCase();
    const matchCount = keywords.filter(kw => 
      titleLower.includes(kw) || abstractLower.includes(kw)
    ).length;
    const relevanceScore = keywords.length > 0 ? matchCount / keywords.length : 0;
    
    // Open access bonus
    const openAccessScore = paper.openAccess ? 1 : 0;
    
    // Combined score
    const totalScore = 
      citationScore * w.citations +
      recencyScore * w.recency +
      relevanceScore * w.relevance +
      openAccessScore * w.openAccess;
    
    return { paper, score: totalScore };
  });
  
  // Sort by score descending
  scoredPapers.sort((a, b) => b.score - a.score);
  
  return scoredPapers.map(sp => sp.paper);
}

/**
 * Split papers into batches for parallel processing
 */
export function batchPapers<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}









