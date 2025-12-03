import type { Paper } from '@/types/paper';
import type { 
  ResearchPlan, 
  Citation,
  QualityMetrics,
  QualityGateResult,
  CriticAnalysis,
} from '@/types/research';
import { analyzeReport, type CriticContext } from './critic';

export interface QualityGateConfig {
  minOverallScore: number;        // Minimum score to pass (default: 70)
  minCoverageScore: number;       // Minimum coverage score (default: 60)
  minCitationDensity: number;     // Min citations per 500 words (default: 2)
  minUniqueSources: number;       // Min unique sources cited (default: 5)
  maxIterations: number;          // Max iterations before force-pass (default: 3)
  requireOpenAccess: boolean;     // Require % of open access (default: false)
  minOpenAccessPercent: number;   // Min open access percentage (default: 30)
}

const DEFAULT_CONFIG: QualityGateConfig = {
  minOverallScore: 70,
  minCoverageScore: 60,
  minCitationDensity: 2,
  minUniqueSources: 5,
  maxIterations: 3,
  requireOpenAccess: false,
  minOpenAccessPercent: 30,
};

/**
 * Calculate quality metrics from report content and citations
 */
export function calculateQualityMetrics(
  plan: ResearchPlan,
  reportContent: string,
  citations: Citation[],
  papers: Paper[],
): QualityMetrics {
  // Calculate word count
  const wordCount = reportContent.split(/\s+/).length;
  
  // Calculate citation density (per 500 words)
  const citationMatches = reportContent.match(/\[\d+(?:,\s*\d+)*\]/g) || [];
  const citationDensity = wordCount > 0 
    ? (citationMatches.length / wordCount) * 500 
    : 0;

  // Count unique sources
  const uniqueSourcesUsed = new Set(citations.map(c => c.paperId)).size;

  // Calculate recency score (0-100)
  const currentYear = new Date().getFullYear();
  const citedYears = citations.map(c => c.year).filter(y => y > 0);
  const averageCitationYear = citedYears.length > 0
    ? citedYears.reduce((a, b) => a + b, 0) / citedYears.length
    : currentYear - 10;
  
  // Recency: papers from last 3 years = 100, each year older = -10
  const yearsSinceAverage = currentYear - averageCitationYear;
  const recencyScore = Math.max(0, Math.min(100, 100 - (yearsSinceAverage - 3) * 10));

  // Estimate sub-questions coverage
  // Simple heuristic: check if sub-question keywords appear in report
  let subQuestionsCovered = 0;
  for (const subQ of plan.subQuestions) {
    const keywords = subQ.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const matchCount = keywords.filter(kw => 
      reportContent.toLowerCase().includes(kw)
    ).length;
    if (matchCount >= keywords.length * 0.3) {
      subQuestionsCovered++;
    }
  }

  // Calculate coverage score
  const coverageScore = plan.subQuestions.length > 0
    ? (subQuestionsCovered / plan.subQuestions.length) * 100
    : 0;

  // Calculate open access percentage
  const citedPaperIds = new Set(citations.map(c => c.paperId));
  const citedPapers = papers.filter(p => citedPaperIds.has(p.id));
  const openAccessCount = citedPapers.filter(p => p.openAccess).length;
  const openAccessPercentage = citedPapers.length > 0
    ? (openAccessCount / citedPapers.length) * 100
    : 0;

  return {
    coverageScore: Math.round(coverageScore),
    citationDensity: Math.round(citationDensity * 10) / 10,
    uniqueSourcesUsed,
    recencyScore: Math.round(recencyScore),
    subQuestionsCovered,
    totalSubQuestions: plan.subQuestions.length,
    averageCitationYear: Math.round(averageCitationYear),
    openAccessPercentage: Math.round(openAccessPercentage),
  };
}

/**
 * Run the quality gate evaluation
 */
export async function evaluateQuality(
  context: CriticContext,
  config: Partial<QualityGateConfig> = {},
): Promise<QualityGateResult> {
  const settings = { ...DEFAULT_CONFIG, ...config };
  const { plan, papers, reportContent, citations, iteration } = context;

  // Calculate metrics
  const citationObjects: Citation[] = citations.map(c => ({
    id: c.id,
    paperId: c.paperId,
    title: c.title,
    authors: [],
    year: papers.find(p => p.id === c.paperId)?.year || 0,
    inTextRef: c.id,
  }));

  const metrics = calculateQualityMetrics(plan, reportContent, citationObjects, papers);

  // Run critic analysis
  const analysis = await analyzeReport(context);

  // Determine if we should pass
  let decision: 'pass' | 'iterate' | 'fail';
  let reason: string;

  // Force pass after max iterations
  if (iteration >= settings.maxIterations) {
    decision = 'pass';
    reason = `Maximum iterations (${settings.maxIterations}) reached. Passing with current quality.`;
  }
  // Check minimum requirements
  else if (analysis.overallScore < settings.minOverallScore * 0.5) {
    decision = 'fail';
    reason = `Quality score (${analysis.overallScore}) is critically low. Major revision needed.`;
  }
  // Check if iteration is recommended
  else if (analysis.shouldIterate && iteration < settings.maxIterations) {
    const issues: string[] = [];
    
    if (analysis.overallScore < settings.minOverallScore) {
      issues.push(`Overall score ${analysis.overallScore} < ${settings.minOverallScore}`);
    }
    if (metrics.coverageScore < settings.minCoverageScore) {
      issues.push(`Coverage ${metrics.coverageScore}% < ${settings.minCoverageScore}%`);
    }
    if (metrics.citationDensity < settings.minCitationDensity) {
      issues.push(`Citation density ${metrics.citationDensity} < ${settings.minCitationDensity}`);
    }
    if (metrics.uniqueSourcesUsed < settings.minUniqueSources) {
      issues.push(`Unique sources ${metrics.uniqueSourcesUsed} < ${settings.minUniqueSources}`);
    }
    if (analysis.gapsIdentified.length > 0) {
      issues.push(`${analysis.gapsIdentified.length} gaps identified`);
    }
    if (analysis.hallucinations.filter(h => h.severity !== 'low').length > 0) {
      issues.push(`${analysis.hallucinations.length} potential hallucinations`);
    }

    decision = 'iterate';
    reason = issues.length > 0 
      ? `Iteration needed: ${issues.join('; ')}`
      : 'Critic recommends iteration for quality improvement.';
  }
  // Pass
  else {
    decision = 'pass';
    reason = `Quality gate passed with score ${analysis.overallScore}/100.`;
  }

  return {
    passed: decision === 'pass',
    metrics,
    analysis,
    iteration,
    maxIterations: settings.maxIterations,
    decision,
    reason,
  };
}

/**
 * Generate a summary of the quality evaluation for display
 */
export function formatQualityReport(result: QualityGateResult): string {
  const { metrics, analysis, decision, reason } = result;
  
  const statusEmoji = decision === 'pass' ? '✅' : decision === 'iterate' ? '🔄' : '❌';
  
  let report = `## Quality Gate ${statusEmoji} ${decision.toUpperCase()}\n\n`;
  report += `**Reason:** ${reason}\n\n`;
  
  report += `### Scores\n`;
  report += `- Overall: ${analysis.overallScore}/100\n`;
  report += `- Coverage: ${analysis.coverageScore}/100 (${metrics.subQuestionsCovered}/${metrics.totalSubQuestions} sub-questions)\n`;
  report += `- Citation Accuracy: ${analysis.citationAccuracy}/100\n`;
  report += `- Coherence: ${analysis.coherenceScore}/100\n`;
  report += `- Depth: ${analysis.depthScore}/100\n\n`;
  
  report += `### Metrics\n`;
  report += `- Citation Density: ${metrics.citationDensity} per 500 words\n`;
  report += `- Unique Sources: ${metrics.uniqueSourcesUsed}\n`;
  report += `- Recency Score: ${metrics.recencyScore}/100 (avg year: ${metrics.averageCitationYear})\n`;
  report += `- Open Access: ${metrics.openAccessPercentage}%\n\n`;
  
  if (analysis.strengths.length > 0) {
    report += `### Strengths\n`;
    analysis.strengths.forEach(s => { report += `- ${s}\n`; });
    report += '\n';
  }
  
  if (analysis.weaknesses.length > 0) {
    report += `### Areas for Improvement\n`;
    analysis.weaknesses.forEach(w => { report += `- ${w}\n`; });
    report += '\n';
  }
  
  if (analysis.gapsIdentified.length > 0) {
    report += `### Gaps Identified\n`;
    analysis.gapsIdentified.forEach(g => { report += `- ${g}\n`; });
    report += '\n';
  }
  
  if (analysis.hallucinations.length > 0) {
    report += `### Potential Issues\n`;
    analysis.hallucinations.forEach(h => {
      report += `- [${h.severity}] "${h.text.slice(0, 100)}...": ${h.reason}\n`;
    });
  }
  
  return report;
}

/**
 * Check if a specific threshold is met
 */
export function checkThreshold(
  metrics: QualityMetrics,
  analysis: CriticAnalysis,
  threshold: keyof QualityGateConfig,
  config: Partial<QualityGateConfig> = {},
): boolean {
  const settings = { ...DEFAULT_CONFIG, ...config };
  
  switch (threshold) {
    case 'minOverallScore':
      return analysis.overallScore >= settings.minOverallScore;
    case 'minCoverageScore':
      return metrics.coverageScore >= settings.minCoverageScore;
    case 'minCitationDensity':
      return metrics.citationDensity >= settings.minCitationDensity;
    case 'minUniqueSources':
      return metrics.uniqueSourcesUsed >= settings.minUniqueSources;
    case 'minOpenAccessPercent':
      return metrics.openAccessPercentage >= settings.minOpenAccessPercent;
    default:
      return true;
  }
}









