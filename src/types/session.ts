/**
 * Research session types for Deep Research
 */

import type { ResearchPlan, ResearchReport } from './report';
import type { SearchRound } from './search';
import type { ResearchStatus } from './stream';

/**
 * Research session state
 */
export interface ResearchSession {
  id: string;
  userId: string;
  query: string;
  status: ResearchStatus;
  plan?: ResearchPlan;
  searchRounds: SearchRound[];
  report?: ResearchReport;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Workflow state for the coordinator
 */
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

/**
 * Workflow decision from the coordinator
 */
export interface WorkflowDecision {
  nextState: WorkflowState;
  reason: string;
  additionalTasks?: string[];
  feedback?: string;
}





