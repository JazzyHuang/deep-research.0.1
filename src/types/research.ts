/**
 * Research Types - Aggregated exports for Deep Research
 * 
 * This file re-exports types from specialized modules for backward compatibility.
 * For new code, prefer importing from the specific modules directly:
 * - @/types/search - Search-related types
 * - @/types/quality - Quality control types
 * - @/types/report - Report and citation types
 * - @/types/stream - Streaming event types
 * - @/types/agent-step - Agent execution visualization types
 * - @/types/session - Session management types
 */

// Search types
export type { SearchQuery, SearchRound, SearchAnalysis, AggregatedSearchResult } from './search';

// Quality types
export type { 
  QualityMetrics, 
  HallucinationFlag, 
  CriticAnalysis, 
  CitationValidation, 
  QualityGateResult,
  QualityGateConfig,
} from './quality';

// Report types
export type { Citation, ReportSection, ResearchReport, ResearchPlan } from './report';

// Stream types
export type { ResearchStatus, StreamEvent, AgentStreamEvent, ExtendedStreamEvent, StreamMessage } from './stream';
export { isAgentStepEvent } from './stream';

// Agent step types
export type { AgentStepType, AgentStepStatus, AgentStepLog, AgentStep } from './agent-step';
export { createAgentStep } from './agent-step';

// Session types
export type { ResearchSession, WorkflowState, WorkflowDecision } from './session';
