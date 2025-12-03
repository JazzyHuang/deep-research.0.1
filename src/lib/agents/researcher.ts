import { generateObject } from 'ai';
import { z } from 'zod';
import { dataSourceAggregator, DataSourceAggregator } from '@/lib/data-sources';
import { enrichPaper, type EnrichmentResult } from '@/lib/data-sources/enricher';
import { contentExtractor, formatPapersForContext } from '@/lib/content-extractor';
import type { Paper, DataSourceName } from '@/types/paper';
import { DataAvailability, getDataAvailabilityLabel } from '@/types/paper';
import type { SearchQuery, SearchRound } from '@/types/research';
import { openrouter, MODELS, withGrokFallback } from '@/lib/models';

const PaperRelevanceSchema = z.object({
  paperId: z.string(),
  relevanceScore: z.number().min(0).max(10),
  reasoning: z.string(),
  keyInsights: z.array(z.string()),
  suggestedForSection: z.string().optional(),
});

const SearchAnalysisSchema = z.object({
  relevantPapers: z.array(PaperRelevanceSchema),
  gapAnalysis: z.string(),
  suggestedFollowUp: z.array(z.string()),
  overallQuality: z.number().min(0).max(10),
});

export interface SearchAnalysis {
  relevantPapers: Array<{
    paper: Paper;
    relevanceScore: number;
    reasoning: string;
    keyInsights: string[];
    suggestedForSection?: string;
  }>;
  gapAnalysis: string;
  suggestedFollowUp: string[];
  overallQuality: number;
}

/**
 * Execute a search round and analyze results using multi-source aggregation
 */
export async function executeSearchRound(
  searchQuery: SearchQuery,
  researchQuestion: string,
  roundNumber: number,
  options?: {
    enabledSources?: DataSourceName[];
    maxResultsPerSource?: number;
  }
): Promise<{ round: SearchRound; analysis: SearchAnalysis; sourceBreakdown?: Record<string, number> }> {
  // Create aggregator with optional custom configuration
  const aggregator = options?.enabledSources 
    ? new DataSourceAggregator({
        enabledSources: options.enabledSources,
        maxResultsPerSource: options.maxResultsPerSource || 15,
      })
    : dataSourceAggregator;

  // Execute multi-source search
  const searchResult = await aggregator.search({
    query: searchQuery.query,
    limit: options?.maxResultsPerSource || 15,
    yearFrom: searchQuery.filters?.yearFrom,
    yearTo: searchQuery.filters?.yearTo,
    openAccess: searchQuery.filters?.openAccess,
  });

  const papers = searchResult.papers;

  // If no papers found, return empty round
  if (papers.length === 0) {
    return {
      round: {
        id: `round-${roundNumber}-${Date.now()}`,
        query: searchQuery.query,
        reasoning: 'No papers found for this query',
        papers: [],
        timestamp: new Date(),
      },
      analysis: {
        relevantPapers: [],
        gapAnalysis: 'No papers found. Consider broadening the search terms.',
        suggestedFollowUp: ['Try alternative keywords', 'Broaden the scope'],
        overallQuality: 0,
      },
      sourceBreakdown: searchResult.sourceBreakdown,
    };
  }

  // Log source breakdown for debugging
  console.log(`[Researcher] Search returned ${papers.length} papers from sources:`, 
    Object.entries(searchResult.sourceBreakdown)
      .filter(([_, count]) => count > 0)
      .map(([source, count]) => `${source}: ${count}`)
      .join(', ')
  );

  // Get data availability summary
  const dataSummary = contentExtractor.getDataSummary(papers);
  console.log(`[Researcher] Data availability: ${dataSummary.withFullText} with full text, ${dataSummary.withPdfUrl} with PDF, ${dataSummary.withAbstract} with abstract`);

  // Analyze paper relevance using AI
  const analysis = await analyzePapers(papers, researchQuestion, searchQuery.query);

  // Create the search round
  const round: SearchRound = {
    id: `round-${roundNumber}-${Date.now()}`,
    query: searchQuery.query,
    reasoning: `Found ${papers.length} papers from ${Object.values(searchResult.sourceBreakdown).filter(c => c > 0).length} sources, ${analysis.relevantPapers.length} highly relevant`,
    papers: analysis.relevantPapers.map(rp => rp.paper),
    timestamp: new Date(),
  };

  return { round, analysis, sourceBreakdown: searchResult.sourceBreakdown };
}

/**
 * Analyze papers for relevance to the research question
 * Uses Gemini 2.5 Flash-Lite for efficient batch processing
 */
async function analyzePapers(
  papers: Paper[],
  researchQuestion: string,
  searchQuery: string
): Promise<SearchAnalysis> {
  // Create paper summaries for analysis
  const paperSummaries = papers.map(p => ({
    id: p.id,
    title: p.title,
    abstract: p.abstract?.slice(0, 500) || 'No abstract available',
    authors: p.authors.map(a => a.name).join(', '),
    year: p.year,
  }));

  const { object } = await generateObject({
    model: openrouter(MODELS.LIGHTWEIGHT),
    schema: SearchAnalysisSchema,
    prompt: `You are an expert academic researcher analyzing search results.

RESEARCH QUESTION: ${researchQuestion}
SEARCH QUERY USED: ${searchQuery}

PAPERS FOUND:
${paperSummaries.map((p, i) => `
[${i + 1}] ID: ${p.id}
Title: ${p.title}
Authors: ${p.authors}
Year: ${p.year}
Abstract: ${p.abstract}
`).join('\n---\n')}

Analyze each paper for relevance to the research question:
1. Score each paper 0-10 on relevance (7+ is highly relevant)
2. Explain why each paper is or isn't relevant
3. Extract key insights that could be useful
4. Suggest which section of a report it fits
5. Identify gaps in the literature
6. Suggest follow-up searches if needed

Only include papers with relevance score >= 5 in your analysis.`,
  });

  // Map the analysis back to full paper objects
  const relevantPapers = object.relevantPapers
    .filter(rp => rp.relevanceScore >= 5)
    .map(rp => {
      const paper = papers.find(p => p.id === rp.paperId);
      return paper ? {
        paper,
        relevanceScore: rp.relevanceScore,
        reasoning: rp.reasoning,
        keyInsights: rp.keyInsights,
        suggestedForSection: rp.suggestedForSection,
      } : null;
    })
    .filter((rp): rp is NonNullable<typeof rp> => rp !== null);

  return {
    relevantPapers,
    gapAnalysis: object.gapAnalysis,
    suggestedFollowUp: object.suggestedFollowUp,
    overallQuality: object.overallQuality,
  };
}

/**
 * Determine if more search rounds are needed
 * Uses Grok 4.1 Fast for search coordination decisions
 */
export async function shouldContinueSearching(
  completedRounds: SearchRound[],
  totalRelevantPapers: number,
  researchQuestion: string
): Promise<{ shouldContinue: boolean; reason: string; nextQuery?: string }> {
  // Basic heuristics
  if (completedRounds.length >= 5) {
    return { shouldContinue: false, reason: 'Maximum search rounds reached' };
  }

  if (totalRelevantPapers >= 20) {
    return { shouldContinue: false, reason: 'Sufficient papers collected' };
  }

  if (totalRelevantPapers < 3 && completedRounds.length < 3) {
    // Need more papers, use Grok to generate a new query
    const result = await withGrokFallback(
      async (modelId) => {
        const { object } = await generateObject({
          model: openrouter(modelId),
          schema: z.object({
            shouldContinue: z.boolean(),
            reason: z.string(),
            nextQuery: z.string().optional(),
          }),
          prompt: `You are deciding whether to continue searching for academic papers.

RESEARCH QUESTION: ${researchQuestion}

COMPLETED SEARCHES:
${completedRounds.map(r => `- "${r.query}" → ${r.papers.length} papers`).join('\n')}

TOTAL RELEVANT PAPERS: ${totalRelevantPapers}

Should we continue searching? If yes, suggest a different search approach.`,
        });
        return object;
      },
      'Researcher',
      'shouldContinueSearching'
    );

    return result;
  }

  return { shouldContinue: false, reason: 'Adequate coverage achieved' };
}

/**
 * Get paper full text or extended content using multi-source enrichment
 * Attempts to achieve the target data availability level
 */
export async function enrichPaperContent(
  paper: Paper,
  options?: {
    targetLevel?: DataAvailability;
    parsePdf?: boolean;
    extractSections?: boolean;
  }
): Promise<Paper> {
  const targetLevel = options?.targetLevel || DataAvailability.WITH_FULL_TEXT;
  
  // Check if already at target level
  if (paper.dataAvailability >= targetLevel) {
    return paper;
  }

  // Use the PaperEnricher for multi-source enrichment
  const result = await enrichPaper(paper, {
    targetLevel,
    parsePdf: options?.parsePdf ?? true,
    extractSections: options?.extractSections ?? true,
  });

  if (result.enriched) {
    console.log(
      `[Researcher] Enriched paper "${paper.title.slice(0, 50)}..." from ${getDataAvailabilityLabel(result.previousLevel)} to ${getDataAvailabilityLabel(result.newLevel)}`
    );
  }

  return result.paper;
}

/**
 * Batch enrich multiple papers for a specific agent stage
 */
export async function enrichPapersForStage(
  papers: Paper[],
  stage: 'filtering' | 'analyzing' | 'writing',
  options?: {
    maxPapersToEnrich?: number;
    priorityPaperIds?: string[];
  }
): Promise<Paper[]> {
  const maxToEnrich = options?.maxPapersToEnrich || 10;
  const priorityIds = new Set(options?.priorityPaperIds || []);
  
  // Determine target level based on stage
  const targetLevelMap: Record<string, DataAvailability> = {
    filtering: DataAvailability.WITH_ABSTRACT,
    analyzing: DataAvailability.WITH_FULL_TEXT,
    writing: DataAvailability.WITH_ABSTRACT,
  };
  
  const targetLevel = targetLevelMap[stage] || DataAvailability.WITH_ABSTRACT;
  
  // Sort papers: priority first, then by need for enrichment
  const sortedPapers = [...papers].sort((a, b) => {
    const aPriority = priorityIds.has(a.id) ? 1 : 0;
    const bPriority = priorityIds.has(b.id) ? 1 : 0;
    if (aPriority !== bPriority) return bPriority - aPriority;
    
    // Papers that need enrichment come first
    const aNeedsEnrich = (a.dataAvailability || DataAvailability.METADATA_ONLY) < targetLevel ? 1 : 0;
    const bNeedsEnrich = (b.dataAvailability || DataAvailability.METADATA_ONLY) < targetLevel ? 1 : 0;
    return bNeedsEnrich - aNeedsEnrich;
  });
  
  // Enrich top papers
  const papersToEnrich = sortedPapers.slice(0, maxToEnrich);
  const enrichedPapers = await Promise.all(
    papersToEnrich.map(p => enrichPaperContent(p, { targetLevel }))
  );
  
  // Create a map of enriched papers
  const enrichedMap = new Map(enrichedPapers.map(p => [p.id, p]));
  
  // Return all papers with enriched ones updated
  return papers.map(p => enrichedMap.get(p.id) || p);
}

/**
 * Get content from papers formatted for a specific agent stage
 */
export async function getPapersContextForStage(
  papers: Paper[],
  stage: 'filtering' | 'analyzing' | 'writing',
  options?: {
    maxTokens?: number;
    priorityPaperIds?: string[];
  }
): Promise<string> {
  const stageMapping = {
    filtering: 'filtering' as const,
    analyzing: 'analyzing' as const,
    writing: 'writing' as const,
  };
  
  return formatPapersForContext(papers, stageMapping[stage], options?.maxTokens);
}









