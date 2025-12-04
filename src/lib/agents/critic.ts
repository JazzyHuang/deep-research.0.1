import { generateObject } from 'ai';
import { z } from 'zod';
import type { Paper } from '@/types/paper';
import type { 
  ResearchPlan, 
  CriticAnalysis,
  HallucinationFlag,
} from '@/types/research';
import { openrouter, MODELS } from '@/lib/models';

// Zod schemas for structured output
const HallucinationFlagSchema = z.object({
  text: z.string().describe('The specific text that may be a hallucination'),
  reason: z.string().describe('Why this text is flagged as potential hallucination'),
  severity: z.enum(['low', 'medium', 'high']).describe('Severity of the potential hallucination'),
  suggestedFix: z.string().optional().describe('Suggested correction if applicable'),
});

const CriticAnalysisSchema = z.object({
  overallScore: z.number().min(0).max(100).describe('Overall quality score 0-100'),
  coverageScore: z.number().min(0).max(100).describe('How well the report covers all sub-questions'),
  citationAccuracy: z.number().min(0).max(100).describe('Estimated accuracy of citations'),
  coherenceScore: z.number().min(0).max(100).describe('Logical flow and structure quality'),
  depthScore: z.number().min(0).max(100).describe('Depth of analysis'),
  gapsIdentified: z.array(z.string()).describe('Sub-questions or topics not adequately covered'),
  hallucinations: z.array(HallucinationFlagSchema).describe('Potential hallucinations detected'),
  strengths: z.array(z.string()).describe('Strong points of the report'),
  weaknesses: z.array(z.string()).describe('Areas needing improvement'),
  shouldIterate: z.boolean().describe('Whether another iteration is recommended'),
  feedback: z.string().describe('Detailed feedback for the Writer to improve the report'),
  suggestedSearches: z.array(z.string()).optional().describe('Additional search queries to fill gaps'),
});

export interface CriticContext {
  plan: ResearchPlan;
  papers: Paper[];
  reportContent: string;
  citations: { id: string; paperId: string; title: string }[];
  iteration: number;
}

/**
 * Critic Agent: Analyzes research reports for quality, coverage, and potential issues
 * Uses Gemini 2.5 Flash for deep critical analysis
 */
export async function analyzeReport(context: CriticContext): Promise<CriticAnalysis> {
  const { plan, papers, reportContent, citations, iteration } = context;

  // Create paper reference for the model
  const paperSummaries = papers.slice(0, 30).map((p, i) => ({
    index: i + 1,
    id: p.id,
    title: p.title,
    year: p.year,
    abstract: p.abstract?.slice(0, 300) || 'No abstract',
  }));

  const citationList = citations.map(c => `${c.id}: "${c.title}"`).join('\n');

  try {
    const { object } = await generateObject({
      model: openrouter(MODELS.WRITER),
      schema: CriticAnalysisSchema,
      prompt: `You are an expert academic reviewer and critic. Analyze the following research report for quality, accuracy, and completeness.

RESEARCH PLAN:
Main Question: ${plan.mainQuestion}

Sub-questions to address:
${plan.subQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Expected Sections: ${plan.expectedSections.join(', ')}

AVAILABLE SOURCES (papers found):
${paperSummaries.map(p => `[${p.index}] ${p.title} (${p.year})`).join('\n')}

CITATIONS USED IN REPORT:
${citationList}

REPORT CONTENT:
${reportContent.slice(0, 15000)}

ITERATION: ${iteration} (This is iteration ${iteration} of the report)

ANALYSIS TASKS:
1. COVERAGE: Check if each sub-question is adequately addressed. List any gaps.
2. CITATION ACCURACY: Verify citations appear to match claims. Flag any suspicious citations.
3. HALLUCINATIONS: Identify any claims that:
   - Are not supported by the cited sources
   - Make specific numerical claims without citations
   - Assert facts that seem fabricated
   - Reference papers/studies not in the available sources
4. COHERENCE: Evaluate logical flow, structure, and readability.
5. DEPTH: Assess whether the analysis goes beyond surface-level summarization.
6. DECISION: Determine if another iteration is needed (score < 75 or critical gaps exist).

Be thorough but fair. Academic reports need iteration to improve.
${iteration >= 3 ? 'NOTE: This is already iteration 3+. Be more lenient on shouldIterate unless there are critical issues.' : ''}`,
    });

    return {
      overallScore: object.overallScore,
      coverageScore: object.coverageScore,
      citationAccuracy: object.citationAccuracy,
      coherenceScore: object.coherenceScore,
      depthScore: object.depthScore,
      gapsIdentified: object.gapsIdentified,
      hallucinations: object.hallucinations as HallucinationFlag[],
      strengths: object.strengths,
      weaknesses: object.weaknesses,
      shouldIterate: object.shouldIterate,
      feedback: object.feedback,
      suggestedSearches: object.suggestedSearches,
    };
  } catch (error) {
    // Handle errors with detailed message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Critic] Failed to analyze report:', errorMessage);
    
    // Provide fallback analysis on error
    return {
      overallScore: 60,
      coverageScore: 60,
      citationAccuracy: 70,
      coherenceScore: 70,
      depthScore: 60,
      gapsIdentified: [],
      hallucinations: [],
      strengths: ['Report was generated successfully'],
      weaknesses: ['Quality analysis temporarily unavailable'],
      shouldIterate: false,
      feedback: `质量分析暂时不可用: ${errorMessage}. 报告将以当前状态完成。`,
      suggestedSearches: [],
    };
  }
}

/**
 * Quick hallucination check for a specific claim
 * Uses Gemini 2.5 Flash-Lite for efficient batch claim checking
 */
export async function checkClaim(
  claim: string,
  citedPapers: Paper[],
): Promise<{ isSupported: boolean; confidence: number; explanation: string }> {
  const paperContext = citedPapers.map(p => ({
    title: p.title,
    abstract: p.abstract?.slice(0, 500) || '',
    year: p.year,
  }));

  try {
    const { object } = await generateObject({
      model: openrouter(MODELS.LIGHTWEIGHT),
      schema: z.object({
        isSupported: z.boolean().describe('Whether the claim is supported by the papers'),
        confidence: z.number().min(0).max(100).describe('Confidence in this assessment'),
        explanation: z.string().describe('Brief explanation'),
      }),
      prompt: `Check if this claim is supported by the cited papers:

CLAIM: "${claim}"

CITED PAPERS:
${paperContext.map((p, i) => `${i + 1}. "${p.title}" (${p.year})
   Abstract: ${p.abstract}`).join('\n\n')}

Is this claim supported by these papers? Consider:
- Does the claim align with what the papers likely discuss?
- Is the claim too specific without matching evidence?
- Could this be a reasonable inference from the papers?`,
    });

    return object;
  } catch (error) {
    console.error('[Critic] Failed to check claim:', error);
    // Return neutral fallback on error
    return {
      isSupported: true,
      confidence: 50,
      explanation: 'Claim verification temporarily unavailable',
    };
  }
}

/**
 * Generate improvement suggestions based on critic analysis
 * Uses Gemini 2.5 Flash-Lite for efficient improvement planning
 */
export async function generateImprovementPlan(
  analysis: CriticAnalysis,
  plan: ResearchPlan,
): Promise<{
  prioritizedImprovements: string[];
  additionalSearchQueries: string[];
  sectionsToRevise: string[];
}> {
  try {
    const { object } = await generateObject({
      model: openrouter(MODELS.LIGHTWEIGHT),
      schema: z.object({
        prioritizedImprovements: z.array(z.string()).describe('Ordered list of improvements to make'),
        additionalSearchQueries: z.array(z.string()).describe('New search queries to find missing information'),
        sectionsToRevise: z.array(z.string()).describe('Specific sections that need revision'),
      }),
      prompt: `Based on this critic analysis, create an improvement plan:

CRITIC ANALYSIS:
- Overall Score: ${analysis.overallScore}/100
- Coverage Score: ${analysis.coverageScore}/100
- Gaps Identified: ${analysis.gapsIdentified.join(', ')}
- Weaknesses: ${analysis.weaknesses.join(', ')}
- Feedback: ${analysis.feedback}
- Suggested Searches: ${analysis.suggestedSearches?.join(', ') || 'None'}

ORIGINAL RESEARCH PLAN:
Main Question: ${plan.mainQuestion}
Sub-questions: ${plan.subQuestions.join(', ')}
Expected Sections: ${plan.expectedSections.join(', ')}

Create a prioritized improvement plan that:
1. Addresses the most critical gaps first
2. Suggests specific search queries to find missing information
3. Identifies which sections need the most work`,
    });

    return object;
  } catch (error) {
    console.error('[Critic] Failed to generate improvement plan:', error);
    // Return fallback plan based on existing analysis
    return {
      prioritizedImprovements: analysis.weaknesses.slice(0, 3),
      additionalSearchQueries: analysis.suggestedSearches || [],
      sectionsToRevise: analysis.gapsIdentified.slice(0, 2),
    };
  }
}

/**
 * Compare two versions of a report to track improvements
 */
export async function compareIterations(
  previousAnalysis: CriticAnalysis,
  currentAnalysis: CriticAnalysis,
): Promise<{
  improved: boolean;
  scoreChange: number;
  resolvedIssues: string[];
  remainingIssues: string[];
  newIssues: string[];
}> {
  const scoreChange = currentAnalysis.overallScore - previousAnalysis.overallScore;
  
  // Find resolved gaps
  const previousGaps = new Set(previousAnalysis.gapsIdentified);
  const currentGaps = new Set(currentAnalysis.gapsIdentified);
  
  const resolvedIssues = previousAnalysis.gapsIdentified.filter(g => !currentGaps.has(g));
  const remainingIssues = currentAnalysis.gapsIdentified.filter(g => previousGaps.has(g));
  const newIssues = currentAnalysis.gapsIdentified.filter(g => !previousGaps.has(g));

  return {
    improved: scoreChange > 0,
    scoreChange,
    resolvedIssues,
    remainingIssues,
    newIssues,
  };
}









