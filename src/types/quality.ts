/**
 * Quality control types for Deep Research
 * Includes metrics, critic analysis, and validation results
 */

/**
 * Quality metrics calculated from report analysis
 */
export interface QualityMetrics {
  coverageScore: number;          // 0-100: How well sub-questions are covered
  citationDensity: number;        // Citations per 500 words
  uniqueSourcesUsed: number;      // Number of unique papers cited
  recencyScore: number;           // 0-100: How recent are the sources
  subQuestionsCovered: number;    // Count of covered sub-questions
  totalSubQuestions: number;      // Total sub-questions from plan
  averageCitationYear: number;    // Average publication year of citations
  openAccessPercentage: number;   // Percentage of open access sources
}

/**
 * Potential hallucination flag
 */
export interface HallucinationFlag {
  text: string;                   // The flagged text
  reason: string;                 // Why it was flagged
  severity: 'low' | 'medium' | 'high';
  suggestedFix?: string;
}

/**
 * Critic agent analysis result
 */
export interface CriticAnalysis {
  overallScore: number;           // 0-100 overall quality score
  coverageScore: number;          // 0-100: Research coverage
  citationAccuracy: number;       // 0-100: Citation accuracy estimate
  coherenceScore: number;         // 0-100: Logical flow and structure
  depthScore: number;             // 0-100: Analysis depth
  gapsIdentified: string[];       // Uncovered sub-questions or topics
  hallucinations: HallucinationFlag[];  // Potential hallucinations detected
  strengths: string[];            // Report strengths
  weaknesses: string[];           // Areas for improvement
  shouldIterate: boolean;         // Whether to trigger another iteration
  feedback: string;               // Detailed feedback for Writer
  suggestedSearches?: string[];   // Additional searches to fill gaps
}

/**
 * Citation validation result
 */
export interface CitationValidation {
  citationId: string;
  paperId: string;
  isValid: boolean;
  paperExists: boolean;
  claimSupported: boolean;        // Whether citation supports the claim
  relevanceScore: number;         // 0-10 relevance to the claim
  suggestedFix?: string;
  issues: string[];
}

/**
 * Quality gate decision
 */
export interface QualityGateResult {
  passed: boolean;
  metrics: QualityMetrics;
  analysis: CriticAnalysis;
  iteration: number;
  maxIterations: number;
  decision: 'pass' | 'iterate' | 'fail';
  reason: string;
}

/**
 * Quality gate configuration
 */
export interface QualityGateConfig {
  minOverallScore: number;
  minCoverageScore: number;
  minCitationDensity: number;
  minRecencyScore: number;
  maxIterations: number;
}





