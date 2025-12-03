import { generateObject } from 'ai';
import { z } from 'zod';
import type { ResearchPlan, SearchQuery } from '@/types/research';
import { openrouter, MODELS, withGrokFallback } from '@/lib/models';

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
  
  const result = await withGrokFallback(
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
    'createResearchPlan'
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









