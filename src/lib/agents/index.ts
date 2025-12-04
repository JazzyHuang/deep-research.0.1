// Core agents
export { createResearchPlan, refineSearchQuery, refinePlanFromFeedback } from './planner';
export { executeSearchRound, shouldContinueSearching, enrichPaperContent } from './researcher';
export { generateReport, generateReferenceList, generateStyledReferenceList, generateSectionSummary } from './writer';

// SOTA Coordinator with dynamic workflow (primary orchestration)
export { coordinateResearch, decideNextStep } from './coordinator';
export type { CoordinatorConfig, WorkflowState } from './coordinator';

// Serialization utilities (moved from deprecated orchestrator)
export function serializeStreamEvent(event: import('@/types/research').ExtendedStreamEvent): string {
  return JSON.stringify({
    ...event,
    timestamp: Date.now(),
  });
}

export function parseStreamEvent(data: string): import('@/types/research').ExtendedStreamEvent & { timestamp: number } {
  return JSON.parse(data);
}

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

// SOTA Modules: Verifiable Checklist (RhinoInsight-inspired)
export {
  buildVerifiableChecklist,
  verifyChecklist,
  verifyChecklistItem,
  calculateChecklistStats,
  getUnverifiedHighPriority,
  generateChecklistFeedback,
  updateChecklistItemStatus,
  addEvidenceToItem,
  serializeChecklist,
  deserializeChecklist,
} from './verifiable-checklist';
export type {
  ChecklistItem,
  ChecklistEvidence,
  VerifiableChecklist,
  ChecklistVerificationResult,
  VerificationStatus,
} from './verifiable-checklist';

// SOTA Modules: Evidence Auditor (RhinoInsight-inspired)
export {
  auditEvidence,
  extractClaims,
  verifyClaim,
  checkForHallucination,
  getCriticalAuditIssues,
  generateAuditFeedback,
  auditPassesThreshold,
} from './evidence-auditor';
export type {
  Evidence,
  ClaimBinding,
  EvidenceAuditResult,
  HallucinationDetection,
  EvidenceVerificationStatus,
} from './evidence-auditor';

// Types
export type { SearchAnalysis } from './researcher';

