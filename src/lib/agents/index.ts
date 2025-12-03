// Core agents
export { createResearchPlan, refineSearchQuery } from './planner';
export { executeSearchRound, shouldContinueSearching, enrichPaperContent } from './researcher';
export { generateReport, generateReferenceList, generateSectionSummary } from './writer';

// Legacy orchestrator (kept for backwards compatibility)
export { orchestrateResearch, serializeStreamEvent, parseStreamEvent } from './orchestrator';
export type { OrchestratorConfig } from './orchestrator';

// New SOTA coordinator with dynamic workflow
export { coordinateResearch, decideNextStep } from './coordinator';
export type { CoordinatorConfig, WorkflowState } from './coordinator';

// Quality control agents
export { analyzeReport, checkClaim, generateImprovementPlan, compareIterations } from './critic';
export type { CriticContext } from './critic';

export { 
  evaluateQuality, 
  calculateQualityMetrics, 
  formatQualityReport,
  checkThreshold,
} from './quality-gate';
export type { QualityGateConfig } from './quality-gate';

// Citation validation
export {
  verifyDoi,
  extractCitedClaims,
  validateCitationSupport,
  validateAllCitations,
  suggestAlternativeCitations,
  generateValidationSummary,
} from './validator';

// Types
export type { SearchAnalysis } from './researcher';

