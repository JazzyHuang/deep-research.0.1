import { generateObject } from 'ai';
import { z } from 'zod';
import type { Paper } from '@/types/paper';
import type { 
  ResearchPlan, 
  SearchRound, 
  ResearchReport,
  ResearchStatus,
  StreamEvent,
  QualityMetrics,
  CriticAnalysis,
  QualityGateResult,
  ExtendedStreamEvent,
  AgentStep,
  AgentStepType,
  AgentStepLog,
  createAgentStep,
} from '@/types/research';
import { createResearchPlan, refineSearchQuery, refinePlanFromFeedback, type CriticFeedbackContext } from './planner';
import { executeSearchRound, shouldContinueSearching } from './researcher';
import { generateReport, generateStyledReferenceList } from './writer';
import { evaluateQuality, type QualityGateConfig } from './quality-gate';
import { validateAllCitations, generateValidationSummary } from './validator';
import type { CitationStyle } from '@/lib/citation';
import { 
  compressPaperContext, 
  formatCompressedContext, 
  deduplicatePapers,
  prioritizePapers,
} from '@/lib/context';
import { ResearchMemory } from '@/lib/context/memory';
import { dataSourceAggregator } from '@/lib/data-sources';
import { openrouter, withGrokFallbackAndRetry } from '@/lib/models';

// Helper to generate unique step IDs
let stepCounter = 0;
function generateStepId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++stepCounter}`;
}

// Helper to create a log entry
function createLog(
  level: AgentStepLog['level'],
  message: string,
  data?: unknown
): AgentStepLog {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    level,
    message,
    data,
  };
}

export interface CoordinatorConfig {
  maxSearchRounds: number;
  maxIterations: number;
  minPapersRequired: number;
  maxPapersPerRound: number;
  qualityGate: Partial<QualityGateConfig>;
  enableMultiSource: boolean;
  enableCitationValidation: boolean;
  enableContextCompression: boolean;
  citationStyle: CitationStyle;
}

const DEFAULT_CONFIG: CoordinatorConfig = {
  maxSearchRounds: 5,
  maxIterations: 3,
  minPapersRequired: 8,
  maxPapersPerRound: 20,
  qualityGate: {
    minOverallScore: 70,
    minCoverageScore: 60,
    maxIterations: 3,
  },
  enableMultiSource: true,
  enableCitationValidation: true,
  enableContextCompression: true,
  citationStyle: 'ieee',
};

export type WorkflowState = 
  | 'initializing'
  | 'planning'
  | 'searching'
  | 'analyzing'
  | 'writing'
  | 'reviewing'
  | 'iterating'
  | 'validating'
  | 'complete'
  | 'error';

interface WorkflowDecision {
  nextState: WorkflowState;
  reason: string;
  additionalTasks?: string[];
  feedback?: string;
}

/**
 * Coordinator: Top-level orchestrator that manages the entire research workflow
 * with dynamic decision-making and quality control
 */
export async function* coordinateResearch(
  userQuery: string,
  config: Partial<CoordinatorConfig> = {},
): AsyncGenerator<ExtendedStreamEvent> {
  const settings = { ...DEFAULT_CONFIG, ...config };
  
  // Initialize memory
  const sessionId = `research-${Date.now()}`;
  const memory = new ResearchMemory(sessionId, userQuery);
  
  let currentState: WorkflowState = 'initializing';
  let lastQualityResult: QualityGateResult | null = null;
  
  // Track parent step for nested steps
  let currentParentStepId: string | undefined;
  
  try {
    yield { type: 'status', status: 'planning', message: 'Initializing research coordinator...' };

    // ================== PHASE 1: PLANNING ==================
    currentState = 'planning';
    const planStepId = generateStepId('plan');
    
    // Emit step start for planning
    yield {
      type: 'agent_step_start',
      step: {
        id: planStepId,
        type: 'thinking',
        name: 'create_research_plan',
        title: 'Creating Research Plan',
        description: `Analyzing query and creating research strategy for: "${userQuery}"`,
        status: 'running',
        startTime: Date.now(),
        logs: [createLog('info', 'Starting research plan generation')],
        children: [],
        collapsed: false,
        input: { params: { query: userQuery } },
      },
    };
    
    yield { type: 'status', status: 'planning', message: 'Creating research plan...' };
    
    const plan = await createResearchPlan(userQuery);
    memory.setPlan(plan);
    
    // Complete planning step
    yield {
      type: 'agent_step_complete',
      stepId: planStepId,
      status: 'success',
      output: {
        summary: `Created plan with ${plan.searchStrategies.length} search strategies and ${plan.subQuestions.length} sub-questions`,
        result: {
          mainQuestion: plan.mainQuestion,
          subQuestions: plan.subQuestions,
          searchStrategies: plan.searchStrategies.length,
        },
      },
    };
    
    yield { type: 'plan', plan };
    yield { 
      type: 'status', 
      status: 'planning', 
      message: `Plan created with ${plan.searchStrategies.length} search strategies and ${plan.subQuestions.length} sub-questions` 
    };

    // ================== PHASE 2: MULTI-ROUND SEARCH ==================
    currentState = 'searching';
    const searchPhaseStepId = generateStepId('search-phase');
    
    yield {
      type: 'agent_step_start',
      step: {
        id: searchPhaseStepId,
        type: 'search',
        name: 'literature_search',
        title: 'Literature Search',
        description: `Multi-round literature search across academic databases`,
        status: 'running',
        startTime: Date.now(),
        logs: [],
        children: [],
        collapsed: false,
      },
    };
    
    yield { type: 'status', status: 'searching', message: 'Beginning literature search...' };

    let roundNumber = 0;
    let searchIndex = 0;

    while (roundNumber < settings.maxSearchRounds) {
      roundNumber++;
      const searchRoundStepId = generateStepId(`search-round-${roundNumber}`);

      // Get next search query
      let currentQuery = plan.searchStrategies[searchIndex];
      
      if (!currentQuery && searchIndex > 0) {
        // Generate refined query based on gaps
        const gaps = memory.gaps;
        if (gaps.length > 0) {
          currentQuery = await refineSearchQuery(
            gaps[0],
            { found: memory.papers.length, relevant: memory.papers.length },
            `Filling gap: ${gaps[0]}`
          );
        } else {
          currentQuery = await refineSearchQuery(
            plan.searchStrategies[0].query,
            { found: memory.papers.length, relevant: memory.papers.length },
            `Expanding search for: ${plan.mainQuestion}`
          );
        }
      }

      if (!currentQuery) break;

      // Emit step for this search round
      yield {
        type: 'agent_step_start',
        step: {
          id: searchRoundStepId,
          parentId: searchPhaseStepId,
          type: 'tool_call',
          name: 'search_papers',
          title: `Search Round ${roundNumber}`,
          description: `Searching: "${currentQuery.query}"`,
          status: 'running',
          startTime: Date.now(),
          logs: [createLog('info', `Query: ${currentQuery.query}`)],
          children: [],
          collapsed: true,
          input: { 
            params: { 
              query: currentQuery.query, 
              filters: currentQuery.filters,
              multiSource: settings.enableMultiSource,
            } 
          },
        },
      };
      
      // Update parent to include this child
      yield {
        type: 'agent_step_update',
        stepId: searchPhaseStepId,
        updates: {
          children: [...(memory.searchRounds.map((_, i) => generateStepId(`search-round-${i + 1}`))), searchRoundStepId],
        },
      };

      yield { 
        type: 'search_start', 
        query: currentQuery.query, 
        round: roundNumber 
      };

      // Execute search - use multi-source aggregator if enabled
      let roundPapers: Paper[] = [];
      
      if (settings.enableMultiSource) {
        yield {
          type: 'agent_step_log',
          stepId: searchRoundStepId,
          log: createLog('info', 'Searching multiple academic sources...'),
        };
        
        const aggregatedResult = await dataSourceAggregator.search({
          query: currentQuery.query,
          limit: settings.maxPapersPerRound,
          yearFrom: currentQuery.filters?.yearFrom,
          yearTo: currentQuery.filters?.yearTo,
          openAccess: currentQuery.filters?.openAccess,
        });
        
        roundPapers = aggregatedResult.papers;
        
        yield {
          type: 'agent_step_log',
          stepId: searchRoundStepId,
          log: createLog('info', `Found ${aggregatedResult.papers.length} papers, ${aggregatedResult.dedupedCount} duplicates removed`),
        };
        
        yield { 
          type: 'analysis', 
          insight: `Found ${aggregatedResult.papers.length} papers from multiple sources (${aggregatedResult.dedupedCount} duplicates removed)` 
        };
      } else {
        // Fallback to single-source search
        const { round, analysis } = await executeSearchRound(
          currentQuery,
          plan.mainQuestion,
          roundNumber
        );
        roundPapers = round.papers;
        
        if (analysis.gapAnalysis) {
          yield { type: 'analysis', insight: analysis.gapAnalysis };
        }
      }

      // Deduplicate and add to memory
      const uniquePapers = deduplicatePapers([...memory.papers, ...roundPapers]);
      const newPapers = uniquePapers.filter(p => !memory.getPaper(p.id));
      
      // Create search round record
      const round: SearchRound = {
        id: `round-${roundNumber}-${Date.now()}`,
        query: currentQuery.query,
        reasoning: `Found ${newPapers.length} new papers`,
        papers: newPapers,
        timestamp: new Date(),
      };
      
      memory.addSearchRound(round);

      // Complete search round step
      yield {
        type: 'agent_step_complete',
        stepId: searchRoundStepId,
        status: 'success',
        output: {
          summary: `Found ${newPapers.length} new papers`,
          result: {
            papersFound: newPapers.length,
            totalPapers: memory.papers.length,
            topPapers: newPapers.slice(0, 3).map(p => p.title),
          },
        },
      };

      yield { 
        type: 'papers_found', 
        papers: newPapers, 
        round: roundNumber 
      };

      // Check if we should continue
      const continueDecision = await shouldContinueSearching(
        memory.searchRounds,
        memory.papers.length,
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

    // Complete search phase step
    yield {
      type: 'agent_step_complete',
      stepId: searchPhaseStepId,
      status: 'success',
      output: {
        summary: `Completed ${roundNumber} search rounds, found ${memory.papers.length} papers`,
        result: {
          totalRounds: roundNumber,
          totalPapers: memory.papers.length,
        },
      },
    };

    yield { 
      type: 'status', 
      status: 'searching', 
      message: `Search complete. Found ${memory.papers.length} relevant papers.` 
    };

    // Check minimum papers requirement
    if (memory.papers.length < settings.minPapersRequired) {
      yield { 
        type: 'status', 
        status: 'analyzing', 
        message: `Warning: Only ${memory.papers.length} papers found. Report may be limited.` 
      };
    }

    // ================== ITERATION LOOP: WRITE → REVIEW → ITERATE ==================
    let iterationCount = 0;
    let reportContent = '';
    let finalReport: ResearchReport | null = null;

    while (iterationCount < settings.maxIterations) {
      iterationCount++;
      memory.incrementIteration();
      
      const iterationStepId = generateStepId(`iteration-${iterationCount}`);

      // ================== PHASE 3: ANALYSIS & CONTEXT PREPARATION ==================
      currentState = 'analyzing';
      const analysisStepId = generateStepId(`analysis-${iterationCount}`);
      
      yield {
        type: 'agent_step_start',
        step: {
          id: analysisStepId,
          type: 'analysis',
          name: 'analyze_papers',
          title: `Analyzing Papers (Iteration ${iterationCount})`,
          description: `Processing and prioritizing ${memory.papers.length} papers for report generation`,
          status: 'running',
          startTime: Date.now(),
          logs: [],
          children: [],
          collapsed: true,
        },
      };
      
      yield { type: 'status', status: 'analyzing', message: `Analyzing papers (iteration ${iterationCount})...` };

      // Prioritize and compress papers
      const prioritizedPapers = prioritizePapers(memory.papers, plan.mainQuestion);
      
      let paperContext: string;
      if (settings.enableContextCompression) {
        yield {
          type: 'agent_step_log',
          stepId: analysisStepId,
          log: createLog('info', 'Compressing paper context for efficient processing...'),
        };
        
        const compressed = await compressPaperContext(
          prioritizedPapers,
          plan.mainQuestion,
          { maxTotalTokens: 10000, maxPapers: 25 }
        );
        paperContext = formatCompressedContext(compressed);
        
        yield {
          type: 'agent_step_complete',
          stepId: analysisStepId,
          status: 'success',
          output: {
            summary: `Compressed ${compressed.papers.length} papers (${Math.round(compressed.compressionRatio * 100)}% of original)`,
            result: { papersProcessed: compressed.papers.length, compressionRatio: compressed.compressionRatio },
          },
        };
        
        yield { 
          type: 'analysis', 
          insight: `Compressed ${compressed.papers.length} papers (${Math.round(compressed.compressionRatio * 100)}% of original size)` 
        };
      } else {
        paperContext = prioritizedPapers.slice(0, 20).map((p, i) => 
          `[${i + 1}] ${p.title} (${p.year})\n${p.abstract?.slice(0, 400) || 'No abstract'}`
        ).join('\n\n');
        
        yield {
          type: 'agent_step_complete',
          stepId: analysisStepId,
          status: 'success',
          output: {
            summary: `Prepared ${Math.min(prioritizedPapers.length, 20)} papers for report`,
          },
        };
      }

      // ================== PHASE 4: WRITING ==================
      currentState = 'writing';
      const writingStepId = generateStepId(`writing-${iterationCount}`);
      
      yield {
        type: 'agent_step_start',
        step: {
          id: writingStepId,
          type: 'llm_generation',
          name: 'generate_report',
          title: iterationCount === 1 ? 'Generating Research Report' : `Revising Report (Iteration ${iterationCount})`,
          description: iterationCount === 1 
            ? 'Writing comprehensive research report with citations'
            : `Improving report based on quality feedback`,
          status: 'running',
          startTime: Date.now(),
          logs: [],
          children: [],
          collapsed: false,
          input: iterationCount > 1 && lastQualityResult ? {
            params: {
              previousScore: lastQualityResult.analysis.overallScore,
              feedback: lastQualityResult.analysis.feedback?.slice(0, 200),
            },
          } : undefined,
        },
      };
      
      if (iterationCount === 1) {
        yield { type: 'status', status: 'writing', message: 'Generating research report...' };
      } else {
        yield { 
          type: 'iteration_start', 
          reason: lastQualityResult?.reason || 'Improving report quality',
          iteration: iterationCount,
          feedback: lastQualityResult?.analysis.feedback || ''
        };
        yield { type: 'status', status: 'writing', message: `Revising report (iteration ${iterationCount})...` };
      }

      // Generate report
      const collectedCitations: { id: string; paperId: string; title: string; authors: string[]; year: number; doi?: string; url?: string; inTextRef: string }[] = [];
      reportContent = '';

      const reportGenerator = generateReport({
        plan,
        searchRounds: memory.searchRounds,
        allPapers: prioritizedPapers,
        previousFeedback: lastQualityResult?.analysis.feedback,
        iteration: iterationCount,
        citationStyle: settings.citationStyle,
      });

      let currentSectionName = '';
      for await (const event of reportGenerator) {
        if (event.type === 'content') {
          reportContent += event.data as string;
          yield { type: 'content', content: event.data as string };
        } else if (event.type === 'citation') {
          const citation = event.data as typeof collectedCitations[0];
          if (!collectedCitations.find(c => c.id === citation.id)) {
            collectedCitations.push(citation);
            yield { type: 'citation', citation };
          }
        } else if (event.type === 'section') {
          const section = event.data as { heading: string; level: number };
          currentSectionName = section.heading;
          yield {
            type: 'agent_step_log',
            stepId: writingStepId,
            log: createLog('info', `Writing section: ${section.heading}`),
          };
          yield { type: 'writing_start', section: section.heading };
        } else if (event.type === 'complete') {
          finalReport = event.data as ResearchReport;
        }
      }

      // Complete writing step
      yield {
        type: 'agent_step_complete',
        stepId: writingStepId,
        status: 'success',
        output: {
          summary: `Generated report with ${collectedCitations.length} citations`,
          result: {
            wordCount: reportContent.split(/\s+/).length,
            citationCount: collectedCitations.length,
          },
        },
      };

      // Save report version
      memory.saveReportVersion(reportContent);

      // ================== PHASE 5: QUALITY REVIEW ==================
      currentState = 'reviewing';
      const reviewStepId = generateStepId(`review-${iterationCount}`);
      
      yield {
        type: 'agent_step_start',
        step: {
          id: reviewStepId,
          type: 'validation',
          name: 'quality_review',
          title: `Quality Review (Iteration ${iterationCount})`,
          description: 'Evaluating report quality and identifying areas for improvement',
          status: 'running',
          startTime: Date.now(),
          logs: [],
          children: [],
          collapsed: true,
        },
      };
      
      yield { type: 'quality_check_start', iteration: iterationCount };
      yield { type: 'status', status: 'reviewing', message: 'Evaluating report quality...' };

      const qualityResult = await evaluateQuality(
        {
          plan,
          papers: memory.papers,
          reportContent,
          citations: collectedCitations.map(c => ({
            id: c.id,
            paperId: c.paperId,
            title: c.title,
          })),
          iteration: iterationCount,
        },
        settings.qualityGate
      );

      lastQualityResult = qualityResult;

      yield {
        type: 'agent_step_log',
        stepId: reviewStepId,
        log: createLog('info', `Quality score: ${qualityResult.analysis.overallScore}/100`),
      };
      
      yield {
        type: 'agent_step_complete',
        stepId: reviewStepId,
        status: qualityResult.decision === 'pass' ? 'success' : 'success',
        output: {
          summary: `Score: ${qualityResult.analysis.overallScore}/100 - ${qualityResult.decision.toUpperCase()}`,
          result: {
            overallScore: qualityResult.analysis.overallScore,
            decision: qualityResult.decision,
            gapsFound: qualityResult.analysis.gapsIdentified.length,
          },
        },
      };

      yield { type: 'quality_metrics', metrics: qualityResult.metrics };
      yield { type: 'critic_analysis', analysis: qualityResult.analysis };
      yield { type: 'quality_gate_result', result: qualityResult };

      // Record gaps for next iteration
      for (const gap of qualityResult.analysis.gapsIdentified) {
        memory.addGap(gap);
        yield { 
          type: 'gap_identified', 
          gap,
          suggestedSearch: qualityResult.analysis.suggestedSearches?.find(s => 
            s.toLowerCase().includes(gap.toLowerCase().split(' ')[0])
          ),
        };
      }

      // ================== PHASE 6: DECISION ==================
      const decisionStepId = generateStepId(`decision-${iterationCount}`);
      
      yield {
        type: 'agent_step_start',
        step: {
          id: decisionStepId,
          type: 'decision',
          name: 'workflow_decision',
          title: 'Workflow Decision',
          description: `Determining next step based on quality score: ${qualityResult.analysis.overallScore}/100`,
          status: 'running',
          startTime: Date.now(),
          logs: [],
          children: [],
          collapsed: true,
        },
      };
      
      if (qualityResult.decision === 'pass') {
        yield {
          type: 'agent_step_complete',
          stepId: decisionStepId,
          status: 'success',
          output: {
            summary: 'Quality gate passed - finalizing report',
            result: { decision: 'pass', score: qualityResult.analysis.overallScore },
          },
        };
        
        yield { 
          type: 'status', 
          status: 'reviewing', 
          message: `Quality gate passed (score: ${qualityResult.analysis.overallScore}/100)` 
        };
        break;
      } else if (qualityResult.decision === 'iterate' && iterationCount < settings.maxIterations) {
        yield {
          type: 'agent_step_complete',
          stepId: decisionStepId,
          status: 'success',
          output: {
            summary: `Iterating to improve quality (current: ${qualityResult.analysis.overallScore}/100)`,
            result: { decision: 'iterate', nextIteration: iterationCount + 1 },
          },
        };
        
        yield { 
          type: 'status', 
          status: 'iterating', 
          message: `Iteration ${iterationCount} complete. Score: ${qualityResult.analysis.overallScore}/100. Starting iteration ${iterationCount + 1}...` 
        };
        
        // Use Critic feedback to refine the research plan and conduct targeted searches
        if (qualityResult.analysis.gapsIdentified.length > 0 || qualityResult.analysis.overallScore < 80) {
          currentState = 'searching';
          
          const gapSearchStepId = generateStepId(`gap-search-${iterationCount}`);
          yield {
            type: 'agent_step_start',
            step: {
              id: gapSearchStepId,
              type: 'search',
              name: 'gap_filling_search',
              title: 'Targeted Gap-Filling Search',
              description: 'Refining plan and searching for papers to fill identified knowledge gaps',
              status: 'running',
              startTime: Date.now(),
              logs: [],
              children: [],
              collapsed: true,
            },
          };
          
          yield { type: 'status', status: 'searching', message: 'Analyzing gaps and refining research plan...' };
          
          // Build critic feedback context for plan refinement
          const criticFeedbackContext: CriticFeedbackContext = {
            gapsIdentified: qualityResult.analysis.gapsIdentified,
            weaknesses: qualityResult.analysis.weaknesses,
            overallScore: qualityResult.analysis.overallScore,
            coverageScore: qualityResult.analysis.coverageScore,
            feedback: qualityResult.analysis.feedback,
          };
          
          // Refine the plan based on critic feedback
          yield {
            type: 'agent_step_log',
            stepId: gapSearchStepId,
            log: createLog('info', 'Generating refined search strategies from critic feedback...'),
          };
          
          const planRefinement = await refinePlanFromFeedback(
            plan,
            criticFeedbackContext,
            memory.papers.map(p => p.title)
          );
          
          yield {
            type: 'agent_step_log',
            stepId: gapSearchStepId,
            log: createLog('info', `Plan refinement: ${planRefinement.additionalSearchStrategies.length} new searches, ${planRefinement.additionalSubQuestions.length} new sub-questions`),
          };
          
          // Add new sub-questions to memory
          for (const subQ of planRefinement.additionalSubQuestions) {
            plan.subQuestions.push(subQ);
            yield { 
              type: 'analysis', 
              insight: `New sub-question added: ${subQ}` 
            };
          }
          
          // Execute targeted searches from the refined plan
          let additionalPapersFound = 0;
          const searchesToExecute: Array<{ query: string; filters?: { yearFrom?: number; yearTo?: number; openAccess?: boolean } }> = 
            planRefinement.additionalSearchStrategies.length > 0
              ? planRefinement.additionalSearchStrategies
              : (qualityResult.analysis.suggestedSearches || []).slice(0, 2).map(q => ({ query: q }));
          
          for (const searchStrategy of searchesToExecute.slice(0, 3)) {
            yield {
              type: 'agent_step_log',
              stepId: gapSearchStepId,
              log: createLog('info', `Targeted search: ${searchStrategy.query}`),
            };
            
            yield { type: 'status', status: 'searching', message: `Searching: ${searchStrategy.query.slice(0, 50)}...` };
            
            const additionalResult = await dataSourceAggregator.search({
              query: searchStrategy.query,
              limit: 10,
              yearFrom: searchStrategy.filters?.yearFrom,
              yearTo: searchStrategy.filters?.yearTo,
              openAccess: searchStrategy.filters?.openAccess,
            });
            
            if (additionalResult.papers.length > 0) {
              // Deduplicate against existing papers
              const newPapers = additionalResult.papers.filter(p => 
                !memory.papers.some(existing => 
                  existing.doi === p.doi || existing.title.toLowerCase() === p.title.toLowerCase()
                )
              );
              
              if (newPapers.length > 0) {
                memory.addPapers(newPapers);
                additionalPapersFound += newPapers.length;
                
                yield { 
                  type: 'papers_found', 
                  papers: newPapers.slice(0, 5), 
                  round: memory.searchRounds.length + 1 
                };
                
                yield {
                  type: 'agent_step_log',
                  stepId: gapSearchStepId,
                  log: createLog('info', `Found ${newPapers.length} new papers for gap: ${searchStrategy.query.slice(0, 40)}...`),
                };
              }
            }
          }
          
          // Mark addressed gaps
          for (const [gap, queries] of planRefinement.gapMappings) {
            if (additionalPapersFound > 0) {
              memory.addInsight(`Gap "${gap}" addressed with ${queries.length} targeted searches`);
            }
          }
          
          yield {
            type: 'agent_step_complete',
            stepId: gapSearchStepId,
            status: 'success',
            output: {
              summary: `Found ${additionalPapersFound} additional papers through targeted gap-filling`,
              result: { 
                papersFound: additionalPapersFound,
                searchesExecuted: searchesToExecute.slice(0, 3).length,
                newSubQuestions: planRefinement.additionalSubQuestions.length,
                reasoning: planRefinement.reasoning.slice(0, 200),
              },
            },
          };
        }
      } else {
        // Max iterations reached or failed
        yield {
          type: 'agent_step_complete',
          stepId: decisionStepId,
          status: 'success',
          output: {
            summary: 'Maximum iterations reached - finalizing',
            result: { decision: 'max_iterations', finalScore: qualityResult.analysis.overallScore },
          },
        };
        
        yield { 
          type: 'status', 
          status: 'reviewing', 
          message: `Maximum iterations reached. Final score: ${qualityResult.analysis.overallScore}/100` 
        };
        break;
      }
    }

    // ================== PHASE 7: VALIDATION (Optional) ==================
    if (settings.enableCitationValidation && finalReport) {
      currentState = 'validating';
      const validationStepId = generateStepId('citation-validation');
      
      yield {
        type: 'agent_step_start',
        step: {
          id: validationStepId,
          type: 'validation',
          name: 'validate_citations',
          title: 'Citation Validation',
          description: 'Verifying citation accuracy and relevance',
          status: 'running',
          startTime: Date.now(),
          logs: [],
          children: [],
          collapsed: true,
        },
      };
      
      yield { type: 'status', status: 'reviewing', message: 'Validating citations...' };

      const validations = await validateAllCitations(
        reportContent,
        finalReport.citations,
        memory.papers
      );

      const summary = generateValidationSummary(validations);
      
      // Report critical issues
      for (const validation of validations.filter(v => !v.isValid)) {
        yield {
          type: 'agent_step_log',
          stepId: validationStepId,
          log: createLog('warn', `Invalid citation: ${validation.citationId}`, validation),
        };
        yield { type: 'citation_validated', validation };
      }

      yield {
        type: 'agent_step_complete',
        stepId: validationStepId,
        status: summary.validCitations === summary.totalCitations ? 'success' : 'success',
        output: {
          summary: `${summary.validCitations}/${summary.totalCitations} citations valid`,
          result: {
            validCitations: summary.validCitations,
            totalCitations: summary.totalCitations,
            averageRelevance: summary.averageRelevance,
          },
        },
      };

      yield { 
        type: 'analysis', 
        insight: `Citation validation: ${summary.validCitations}/${summary.totalCitations} valid, avg relevance: ${summary.averageRelevance}/10` 
      };
    }

    // ================== PHASE 8: FINALIZATION ==================
    const finalizationStepId = generateStepId('finalization');
    
    yield {
      type: 'agent_step_start',
      step: {
        id: finalizationStepId,
        type: 'llm_generation',
        name: 'finalize_report',
        title: 'Finalizing Report',
        description: 'Adding references and final formatting',
        status: 'running',
        startTime: Date.now(),
        logs: [],
        children: [],
        collapsed: true,
      },
    };
    
    // Generate references section
    if (finalReport && finalReport.citations.length > 0) {
      yield { type: 'writing_start', section: 'References' };
      const references = generateStyledReferenceList(finalReport.citations, settings.citationStyle);
      yield { type: 'content', content: '\n\n## References\n\n' + references };
    }

    // Add quality metrics to final report
    if (finalReport && lastQualityResult) {
      finalReport.qualityMetrics = lastQualityResult.metrics;
      finalReport.iterationCount = iterationCount;
    }

    yield {
      type: 'agent_step_complete',
      stepId: finalizationStepId,
      status: 'success',
      output: {
        summary: 'Report finalized successfully',
        result: {
          citations: finalReport?.citations.length || 0,
          iterations: iterationCount,
          finalScore: lastQualityResult?.analysis.overallScore,
        },
      },
    };

    // Complete
    currentState = 'complete';
    if (finalReport) {
      yield { type: 'status', status: 'complete', message: 'Research complete!' };
      yield { type: 'complete', report: finalReport };
    } else {
      throw new Error('Failed to generate report');
    }

  } catch (error) {
    currentState = 'error';
    
    // Provide more helpful error messages
    let errorMessage: string;
    if (error instanceof Error) {
      // Check for common error types and provide user-friendly messages
      const msg = error.message.toLowerCase();
      if (msg.includes('terminated') || msg.includes('aborted')) {
        errorMessage = '研究过程被中断，请重新开始';
      } else if (msg.includes('timeout') || msg.includes('timed out')) {
        errorMessage = 'AI 模型响应超时，请稍后重试';
      } else if (msg.includes('rate limit') || msg.includes('429')) {
        errorMessage = 'API 调用频率限制，请稍后重试';
      } else if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('401')) {
        errorMessage = 'API 密钥配置错误，请检查 OPENROUTER_API_KEY 环境变量';
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
        errorMessage = '网络连接失败，请检查网络后重试';
      } else {
        errorMessage = error.message;
      }
      
      // Log the full error for debugging
      console.error('[Coordinator] Error:', error.message, error.stack);
    } else {
      errorMessage = 'Unknown error occurred';
      console.error('[Coordinator] Unknown error:', error);
    }
    
    // Emit error step
    yield {
      type: 'agent_step_start',
      step: {
        id: generateStepId('error'),
        type: 'decision',
        name: 'error',
        title: 'Error Occurred',
        description: errorMessage,
        status: 'error',
        startTime: Date.now(),
        logs: [createLog('error', errorMessage)],
        children: [],
        collapsed: false,
        error: { message: errorMessage },
      },
    };
    
    yield { type: 'error', error: errorMessage };
    yield { type: 'status', status: 'error', message: errorMessage };
  }
}

/**
 * Make a dynamic workflow decision based on current state and metrics
 * Uses Grok 4.1 Fast for intelligent workflow orchestration
 */
export async function decideNextStep(
  currentState: WorkflowState,
  metrics: QualityMetrics,
  analysis: CriticAnalysis,
  iteration: number,
  maxIterations: number,
): Promise<WorkflowDecision> {
  // Use Grok 4.1 Fast with fallback for workflow orchestration
  const result = await withGrokFallbackAndRetry(
    async (modelId) => {
      const { object } = await generateObject({
        model: openrouter(modelId),
        schema: z.object({
          nextState: z.enum([
            'searching', 'analyzing', 'writing', 'reviewing', 'iterating', 'complete'
          ]),
          reason: z.string(),
          additionalTasks: z.array(z.string()).optional(),
          feedback: z.string().optional(),
        }),
        prompt: `You are coordinating a research workflow. Decide the next step.

CURRENT STATE: ${currentState}
ITERATION: ${iteration}/${maxIterations}

QUALITY METRICS:
- Coverage Score: ${metrics.coverageScore}/100
- Citation Density: ${metrics.citationDensity}
- Unique Sources: ${metrics.uniqueSourcesUsed}
- Recency Score: ${metrics.recencyScore}/100

CRITIC ANALYSIS:
- Overall Score: ${analysis.overallScore}/100
- Gaps: ${analysis.gapsIdentified.join(', ') || 'None'}
- Should Iterate: ${analysis.shouldIterate}
- Feedback: ${analysis.feedback}

Decide:
1. Should we continue iterating or mark as complete?
2. What specific improvements are needed?
3. Should we search for more papers first?`,
      });
      return object;
    },
    'Coordinator',
    'decideNextStep',
    2 // maxRetries
  );

  return {
    nextState: result.nextState as WorkflowState,
    reason: result.reason,
    additionalTasks: result.additionalTasks,
    feedback: result.feedback,
  };
}

// Type re-exported from interface definition above

