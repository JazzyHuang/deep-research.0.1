import { generateObject } from 'ai';
import { z } from 'zod';
import type { ResearchPlan, SearchQuery } from '@/types/research';
import { openrouter, MODELS, withGrokFallbackAndRetry } from '@/lib/models';

const ResearchPlanSchema = z.object({
  mainQuestion: z.string().describe('The core research question being investigated'),
  subQuestions: z.array(z.string()).describe('Specific sub-questions to answer'),
  searchStrategies: z.array(
    z.object({
      query: z.string().describe('Search query for academic paper database'),
      filters: z.object({
        yearFrom: z.number().optional().describe('Start year filter'),
        yearTo: z.number().optional().describe('End year filter'),
        openAccess: z.boolean().optional().describe('Filter for open access papers'),
      }).optional(),
    })
  ).describe('Search strategies to find relevant papers'),
  expectedSections: z.array(z.string()).describe('Expected sections in the final report'),
});

/**
 * Create a comprehensive research plan using Grok 4.1 Fast
 * Leverages Grok's 2M context window for strategic planning
 */
export async function createResearchPlan(userQuery: string): Promise<ResearchPlan> {
  const currentYear = new Date().getFullYear();
  
  const result = await withGrokFallbackAndRetry(
    async (modelId) => {
      const { object } = await generateObject({
        model: openrouter(modelId),
        schema: ResearchPlanSchema,
        prompt: `You are an expert academic research planner. Given a research question, create a comprehensive research plan.

USER'S RESEARCH QUESTION:
${userQuery}

Create a research plan that:
1. Clarifies the main research question
2. Breaks it down into 3-5 specific sub-questions
3. Generates 3-6 search strategies with academic search queries
4. Outlines expected sections for the final report

For search strategies:
- Use academic terminology and keywords
- Include synonyms and related terms
- Consider different aspects of the topic
- Focus on queries that will find peer-reviewed papers
- Current year is ${currentYear}

For the report structure:
- Include Introduction, Literature Review sections
- Add topic-specific sections
- Include Discussion/Analysis and Conclusion`,
      });
      return object;
    },
    'Planner',
    'createResearchPlan',
    2 // maxRetries
  );

  return {
    mainQuestion: result.mainQuestion,
    subQuestions: result.subQuestions,
    searchStrategies: result.searchStrategies as SearchQuery[],
    expectedSections: result.expectedSections,
  };
}

/**
 * Refine a search query based on previous results
 * Uses Gemini 2.5 Flash-Lite for efficient query refinement
 */
export async function refineSearchQuery(
  originalQuery: string,
  previousResults: { found: number; relevant: number },
  context: string
): Promise<SearchQuery> {
  const { object } = await generateObject({
    model: openrouter(MODELS.LIGHTWEIGHT),
    schema: z.object({
      query: z.string(),
      reasoning: z.string(),
      filters: z.object({
        yearFrom: z.number().optional(),
        yearTo: z.number().optional(),
        openAccess: z.boolean().optional(),
      }).optional(),
    }),
    prompt: `You are refining an academic search query based on previous results.

ORIGINAL QUERY: ${originalQuery}
PREVIOUS RESULTS: Found ${previousResults.found} papers, ${previousResults.relevant} were relevant
CONTEXT: ${context}

Generate an improved search query that:
- Uses more specific or alternative terminology
- Adjusts scope (broader or narrower as needed)
- Maintains academic rigor

Return the refined query with your reasoning.`,
  });

  return {
    query: object.query,
    filters: object.filters,
  };
}

/**
 * Schema for plan refinement based on critic feedback
 */
const PlanRefinementSchema = z.object({
  additionalSubQuestions: z.array(z.string()).describe('New sub-questions to address identified gaps'),
  additionalSearchStrategies: z.array(
    z.object({
      query: z.string().describe('Targeted search query for the gap'),
      gapAddressed: z.string().describe('Which gap this search addresses'),
      priority: z.enum(['high', 'medium', 'low']).describe('Priority of this search'),
      filters: z.object({
        yearFrom: z.number().optional(),
        yearTo: z.number().optional(),
        openAccess: z.boolean().optional(),
      }).optional(),
    })
  ).describe('New search strategies to fill gaps'),
  refinedSections: z.array(z.string()).optional().describe('Updated sections list if needed'),
  reasoning: z.string().describe('Explanation of refinement decisions'),
});

/**
 * Critic feedback context for plan refinement
 */
export interface CriticFeedbackContext {
  gapsIdentified: string[];
  weaknesses: string[];
  overallScore: number;
  coverageScore: number;
  feedback?: string;
}

/**
 * Result of plan refinement
 */
export interface PlanRefinement {
  additionalSubQuestions: string[];
  additionalSearchStrategies: SearchQuery[];
  refinedSections?: string[];
  reasoning: string;
  gapMappings: Map<string, string[]>; // gap -> search queries that address it
}

/**
 * Refine research plan based on Critic feedback
 * Creates targeted search strategies to fill identified gaps
 */
export async function refinePlanFromFeedback(
  originalPlan: ResearchPlan,
  criticFeedback: CriticFeedbackContext,
  existingPaperTitles: string[] = [],
): Promise<PlanRefinement> {
  const currentYear = new Date().getFullYear();
  
  // Skip refinement if no gaps and score is high
  if (criticFeedback.gapsIdentified.length === 0 && criticFeedback.overallScore >= 80) {
    return {
      additionalSubQuestions: [],
      additionalSearchStrategies: [],
      reasoning: 'No refinement needed - quality gate passed with high score and no gaps identified.',
      gapMappings: new Map(),
    };
  }
  
  const result = await withGrokFallbackAndRetry(
    async (modelId) => {
      const { object } = await generateObject({
        model: openrouter(modelId),
        schema: PlanRefinementSchema,
        prompt: `You are an expert research planner refining a research plan based on quality review feedback.

ORIGINAL RESEARCH PLAN:
- Main Question: ${originalPlan.mainQuestion}
- Sub-Questions: ${originalPlan.subQuestions.join('\n  - ')}
- Current Sections: ${originalPlan.expectedSections.join(', ')}

CRITIC FEEDBACK:
- Overall Score: ${criticFeedback.overallScore}/100
- Coverage Score: ${criticFeedback.coverageScore}/100
- Gaps Identified:
${criticFeedback.gapsIdentified.map((g, i) => `  ${i + 1}. ${g}`).join('\n')}
- Weaknesses:
${criticFeedback.weaknesses.map((w, i) => `  ${i + 1}. ${w}`).join('\n')}
${criticFeedback.feedback ? `- Detailed Feedback: ${criticFeedback.feedback}` : ''}

PAPERS ALREADY FOUND (avoid duplicating these):
${existingPaperTitles.slice(0, 20).join('\n')}

Generate a plan refinement that:
1. Creates NEW sub-questions specifically targeting the identified gaps
2. Generates TARGETED search strategies to find papers addressing each gap
3. Uses different keywords/approaches than the original searches
4. Prioritizes searches based on gap severity
5. Updates sections if needed to accommodate new findings

IMPORTANT:
- Be specific and actionable
- Use academic terminology
- Each search should clearly map to a specific gap
- Current year is ${currentYear}`,
      });
      return object;
    },
    'Planner',
    'refinePlanFromFeedback',
    2 // maxRetries
  );
  
  // Build gap mappings
  const gapMappings = new Map<string, string[]>();
  for (const strategy of result.additionalSearchStrategies) {
    const gap = strategy.gapAddressed;
    if (!gapMappings.has(gap)) {
      gapMappings.set(gap, []);
    }
    gapMappings.get(gap)!.push(strategy.query);
  }
  
  return {
    additionalSubQuestions: result.additionalSubQuestions,
    additionalSearchStrategies: result.additionalSearchStrategies.map(s => ({
      query: s.query,
      filters: s.filters,
    })),
    refinedSections: result.refinedSections,
    reasoning: result.reasoning,
    gapMappings,
  };
}

/**
 * Convert identified gap into a focused search query
 * Lightweight function for single-gap targeting
 */
export async function createGapSearchQuery(
  gap: string,
  mainQuestion: string,
): Promise<SearchQuery> {
  const { object } = await generateObject({
    model: openrouter(MODELS.LIGHTWEIGHT),
    schema: z.object({
      query: z.string(),
      reasoning: z.string(),
      filters: z.object({
        yearFrom: z.number().optional(),
        yearTo: z.number().optional(),
        openAccess: z.boolean().optional(),
      }).optional(),
    }),
    prompt: `Create a targeted academic search query to fill a specific research gap.

MAIN RESEARCH QUESTION: ${mainQuestion}
IDENTIFIED GAP: ${gap}

Generate a search query that will find academic papers directly addressing this gap.
Use specific academic terminology and keywords.
Current year is ${new Date().getFullYear()}.`,
  });
  
  return {
    query: object.query,
    filters: object.filters,
  };
}









