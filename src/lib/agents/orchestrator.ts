import { createResearchPlan, refineSearchQuery } from './planner';
import { executeSearchRound, shouldContinueSearching, enrichPapersForStage } from './researcher';
import { generateReport, generateStyledReferenceList } from './writer';
import { contentExtractor } from '@/lib/content-extractor';
import type { Paper, DataSourceName } from '@/types/paper';
import { DataAvailability, getDataAvailabilityLabel } from '@/types/paper';
import type { 
  ResearchPlan, 
  SearchRound, 
  ResearchReport, 
  StreamEvent,
  ExtendedStreamEvent,
  Citation 
} from '@/types/research';
import type { CitationStyle } from '@/lib/citation';

export interface OrchestratorConfig {
  maxSearchRounds?: number;
  minPapersRequired?: number;
  maxPapersPerRound?: number;
  citationStyle?: CitationStyle;
  // New data source options
  enabledSources?: DataSourceName[];
  enrichTopPapers?: number;           // Number of top papers to enrich with full text
  enableProgressiveLoading?: boolean; // Enable stage-aware data loading
}

const defaultConfig: OrchestratorConfig = {
  maxSearchRounds: 5,
  minPapersRequired: 5,
  maxPapersPerRound: 15,
  citationStyle: 'ieee',
  // New defaults
  enabledSources: ['semantic-scholar', 'openalex', 'core', 'arxiv', 'pubmed'],
  enrichTopPapers: 10,
  enableProgressiveLoading: true,
};

/**
 * Main orchestrator that coordinates the deep research process
 * Returns an async generator that yields streaming events
 */
export async function* orchestrateResearch(
  userQuery: string,
  config: OrchestratorConfig = {}
): AsyncGenerator<StreamEvent> {
  const settings = { ...defaultConfig, ...config };
  
  const searchRounds: SearchRound[] = [];
  const allPapers: Map<string, Paper> = new Map();
  let plan: ResearchPlan | null = null;

  try {
    // Phase 1: Planning
    yield { type: 'status', status: 'planning', message: 'Creating research plan...' };
    
    plan = await createResearchPlan(userQuery);
    yield { type: 'plan', plan };
    yield { 
      type: 'status', 
      status: 'planning', 
      message: `Plan created with ${plan.searchStrategies.length} search strategies` 
    };

    // Phase 2: Multi-round Search
    yield { type: 'status', status: 'searching', message: 'Beginning literature search...' };

    let roundNumber = 0;
    let searchIndex = 0;

    while (roundNumber < settings.maxSearchRounds!) {
      roundNumber++;

      // Get next search query
      let currentQuery = plan.searchStrategies[searchIndex];
      
      if (!currentQuery && searchIndex > 0) {
        // Try to generate a refined query based on previous results
        const refinedQuery = await refineSearchQuery(
          plan.searchStrategies[0].query,
          { found: allPapers.size, relevant: allPapers.size },
          `Searching for: ${plan.mainQuestion}`
        );
        currentQuery = refinedQuery;
      }

      if (!currentQuery) {
        break;
      }

      yield { 
        type: 'search_start', 
        query: currentQuery.query, 
        round: roundNumber 
      };

      // Execute search round with multi-source aggregation
      const { round, analysis, sourceBreakdown } = await executeSearchRound(
        currentQuery,
        plan.mainQuestion,
        roundNumber,
        {
          enabledSources: settings.enabledSources,
          maxResultsPerSource: settings.maxPapersPerRound,
        }
      );

      searchRounds.push(round);
      
      // Report source breakdown if available
      if (sourceBreakdown) {
        const activeSources = Object.entries(sourceBreakdown)
          .filter(([_, count]) => count > 0)
          .map(([source, count]) => `${source}: ${count}`)
          .join(', ');
        if (activeSources) {
          yield { 
            type: 'status', 
            status: 'searching', 
            message: `Sources: ${activeSources}` 
          };
        }
      }

      // Add relevant papers to collection
      analysis.relevantPapers.forEach(rp => {
        if (!allPapers.has(rp.paper.id)) {
          allPapers.set(rp.paper.id, rp.paper);
        }
      });

      yield { 
        type: 'papers_found', 
        papers: round.papers, 
        round: roundNumber 
      };

      // Share analysis insights
      if (analysis.gapAnalysis) {
        yield { type: 'analysis', insight: analysis.gapAnalysis };
      }

      // Check if we should continue
      const continueDecision = await shouldContinueSearching(
        searchRounds,
        allPapers.size,
        plan.mainQuestion
      );

      if (!continueDecision.shouldContinue) {
        yield { 
          type: 'status', 
          status: 'searching', 
          message: continueDecision.reason 
        };
        break;
      }

      // Prepare next query
      if (continueDecision.nextQuery) {
        plan.searchStrategies.push({ query: continueDecision.nextQuery });
      }
      searchIndex++;
    }

    yield { 
      type: 'status', 
      status: 'searching', 
      message: `Search complete. Found ${allPapers.size} relevant papers.` 
    };

    // Check if we have enough papers
    if (allPapers.size < settings.minPapersRequired!) {
      yield { 
        type: 'status', 
        status: 'analyzing', 
        message: `Warning: Only ${allPapers.size} papers found. Report may be limited.` 
      };
    }

    // Phase 3: Analysis and Enrichment
    yield { type: 'status', status: 'analyzing', message: 'Analyzing collected papers...' };
    
    // Get data availability summary before enrichment
    const papersList = Array.from(allPapers.values());
    const preSummary = contentExtractor.getDataSummary(papersList);
    
    yield {
      type: 'status',
      status: 'analyzing',
      message: `Data availability: ${preSummary.withFullText} with full text, ${preSummary.withAbstract} with abstracts`
    };

    // Enrich top papers if progressive loading is enabled
    let enrichedPapers = papersList;
    if (settings.enableProgressiveLoading && settings.enrichTopPapers && settings.enrichTopPapers > 0) {
      yield { 
        type: 'status', 
        status: 'analyzing', 
        message: `Enriching top ${Math.min(settings.enrichTopPapers, papersList.length)} papers...` 
      };
      
      enrichedPapers = await enrichPapersForStage(
        papersList,
        'writing',
        { maxPapersToEnrich: settings.enrichTopPapers }
      );
      
      // Update the allPapers map with enriched data
      for (const paper of enrichedPapers) {
        allPapers.set(paper.id, paper);
      }
      
      // Get post-enrichment summary
      const postSummary = contentExtractor.getDataSummary(enrichedPapers);
      const enrichedCount = postSummary.withFullText - preSummary.withFullText;
      
      if (enrichedCount > 0) {
        yield {
          type: 'status',
          status: 'analyzing',
          message: `Enriched ${enrichedCount} additional papers with full text`
        };
      }
    }

    yield { type: 'status', status: 'writing', message: 'Generating research report...' };

    // Generate report with streaming
    const reportGenerator = generateReport({
      plan,
      searchRounds,
      allPapers: enrichedPapers,
      citationStyle: settings.citationStyle,
    });

    let finalReport: ResearchReport | null = null;
    const collectedCitations: Citation[] = [];

    for await (const event of reportGenerator) {
      if (event.type === 'content') {
        yield { type: 'content', content: event.data as string };
      } else if (event.type === 'citation') {
        const citation = event.data as Citation;
        if (!collectedCitations.find(c => c.id === citation.id)) {
          collectedCitations.push(citation);
          yield { type: 'citation', citation };
        }
      } else if (event.type === 'section') {
        const section = event.data as { heading: string; level: number };
        yield { type: 'writing_start', section: section.heading };
      } else if (event.type === 'complete') {
        finalReport = event.data as ResearchReport;
      }
    }

    // Generate references section
    if (collectedCitations.length > 0) {
      yield { type: 'writing_start', section: 'References' };
      const references = generateStyledReferenceList(collectedCitations, settings.citationStyle);
      yield { type: 'content', content: '\n\n## References\n\n' + references };
    }

    // Complete
    if (finalReport) {
      yield { type: 'status', status: 'complete', message: 'Research complete!' };
      yield { type: 'complete', report: finalReport };
    } else {
      throw new Error('Failed to generate report');
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    yield { type: 'error', error: errorMessage };
    yield { type: 'status', status: 'error', message: errorMessage };
  }
}

/**
 * Convert stream events to a format suitable for storage
 * Supports both legacy StreamEvent and new ExtendedStreamEvent (including agent step events)
 */
export function serializeStreamEvent(event: StreamEvent | ExtendedStreamEvent): string {
  return JSON.stringify({
    ...event,
    timestamp: Date.now(),
  });
}

/**
 * Parse a serialized stream event
 * Returns ExtendedStreamEvent to support both legacy and new event types
 */
export function parseStreamEvent(data: string): ExtendedStreamEvent & { timestamp: number } {
  return JSON.parse(data);
}

