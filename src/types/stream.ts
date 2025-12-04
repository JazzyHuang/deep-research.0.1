/**
 * Streaming event types for Deep Research
 * Real-time updates during research process
 */

import type { Paper } from './paper';
import type { ResearchPlan, Citation, ResearchReport } from './report';
import type { QualityMetrics, CriticAnalysis, QualityGateResult, CitationValidation } from './quality';
import type { AgentStep, AgentStepLog, AgentStepStatus } from './agent-step';

/**
 * Research workflow status
 */
export type ResearchStatus = 
  | 'idle'
  | 'planning'
  | 'searching'
  | 'analyzing'
  | 'writing'
  | 'reviewing'    // Quality review phase
  | 'iterating'    // Iteration/refinement phase
  | 'complete'
  | 'error';

/**
 * Core streaming events for research progress
 */
export type StreamEvent = 
  | { type: 'status'; status: ResearchStatus; message: string }
  | { type: 'plan'; plan: ResearchPlan }
  | { type: 'search_start'; query: string; round: number }
  | { type: 'papers_found'; papers: Paper[]; round: number }
  | { type: 'analysis'; insight: string }
  | { type: 'writing_start'; section: string }
  | { type: 'content'; content: string }
  | { type: 'citation'; citation: Citation }
  | { type: 'complete'; report: ResearchReport }
  | { type: 'error'; error: string }
  // Quality control events
  | { type: 'quality_check_start'; iteration: number }
  | { type: 'quality_metrics'; metrics: QualityMetrics }
  | { type: 'critic_analysis'; analysis: CriticAnalysis }
  | { type: 'quality_gate_result'; result: QualityGateResult }
  | { type: 'iteration_start'; reason: string; iteration: number; feedback: string }
  | { type: 'citation_validated'; validation: CitationValidation }
  | { type: 'gap_identified'; gap: string; suggestedSearch?: string };

/**
 * Agent execution visualization events
 */
export type AgentStreamEvent =
  | { type: 'agent_step_start'; step: AgentStep }
  | { type: 'agent_step_update'; stepId: string; updates: Partial<Omit<AgentStep, 'id'>> }
  | { type: 'agent_step_log'; stepId: string; log: AgentStepLog }
  | { type: 'agent_step_complete'; stepId: string; output?: AgentStep['output']; status: AgentStepStatus; duration?: number }
  | { type: 'agent_step_error'; stepId: string; error: AgentStep['error'] };

/**
 * Extended StreamEvent including agent visualization events
 */
export type ExtendedStreamEvent = StreamEvent | AgentStreamEvent;

/**
 * Timestamped stream message
 */
export interface StreamMessage {
  event: StreamEvent;
  timestamp: number;
}

/**
 * Helper to check if event is an agent step event
 */
export function isAgentStepEvent(event: ExtendedStreamEvent): event is AgentStreamEvent {
  return event.type.startsWith('agent_step_');
}





