import type { Paper } from './paper';

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

export interface SearchQuery {
  query: string;
  filters?: {
    yearFrom?: number;
    yearTo?: number;
    openAccess?: boolean;
  };
}

export interface SearchRound {
  id: string;
  query: string;
  reasoning: string;
  papers: Paper[];
  timestamp: Date;
}

export interface ResearchPlan {
  mainQuestion: string;
  subQuestions: string[];
  searchStrategies: SearchQuery[];
  expectedSections: string[];
}

export interface Citation {
  id: string;
  paperId: string;
  title: string;
  authors: string[];
  year: number;
  doi?: string;
  url?: string;
  inTextRef: string; // e.g., "[1]" or "(Smith et al., 2023)"
  // Extended citation metadata
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  conference?: string;
}

export interface ResearchReport {
  title: string;
  abstract: string;
  sections: ReportSection[];
  citations: Citation[];
  generatedAt: Date;
  qualityMetrics?: QualityMetrics;
  iterationCount?: number;
}

// Quality Gate metrics
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

// Critic Agent analysis result
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

export interface HallucinationFlag {
  text: string;                   // The flagged text
  reason: string;                 // Why it was flagged
  severity: 'low' | 'medium' | 'high';
  suggestedFix?: string;
}

// Citation validation result
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

// Quality Gate decision
export interface QualityGateResult {
  passed: boolean;
  metrics: QualityMetrics;
  analysis: CriticAnalysis;
  iteration: number;
  maxIterations: number;
  decision: 'pass' | 'iterate' | 'fail';
  reason: string;
}

export interface ReportSection {
  heading: string;
  content: string;
  level: number; // 1, 2, or 3 for h1, h2, h3
}

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

// Streaming event types for real-time updates
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
  // New event types for quality control
  | { type: 'quality_check_start'; iteration: number }
  | { type: 'quality_metrics'; metrics: QualityMetrics }
  | { type: 'critic_analysis'; analysis: CriticAnalysis }
  | { type: 'quality_gate_result'; result: QualityGateResult }
  | { type: 'iteration_start'; reason: string; iteration: number; feedback: string }
  | { type: 'citation_validated'; validation: CitationValidation }
  | { type: 'gap_identified'; gap: string; suggestedSearch?: string };

export interface StreamMessage {
  event: StreamEvent;
  timestamp: number;
}

// ============================================
// Agent Execution Visualization Types
// ============================================

/**
 * Type of step in the agent execution workflow
 */
export type AgentStepType = 
  | 'thinking'        // Agent reasoning/planning
  | 'tool_call'       // External tool/API call
  | 'llm_generation'  // LLM text generation
  | 'validation'      // Quality checks/validation
  | 'decision'        // Workflow branching decision
  | 'search'          // Paper/literature search
  | 'analysis';       // Data analysis step

/**
 * Current status of an execution step
 */
export type AgentStepStatus = 
  | 'waiting'   // Queued, not started
  | 'running'   // Currently executing
  | 'success'   // Completed successfully
  | 'error'     // Failed with error
  | 'skipped';  // Skipped (e.g., conditional branch)

/**
 * Log entry within a step
 */
export interface AgentStepLog {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: unknown;
}

/**
 * Represents a single step in the agent execution workflow
 */
export interface AgentStep {
  id: string;
  parentId?: string;              // For tree/nested structure
  type: AgentStepType;
  name: string;                   // Machine-readable name (e.g., "search_papers")
  title: string;                  // Human-readable title
  description?: string;           // Detailed description
  status: AgentStepStatus;
  startTime: number;
  endTime?: number;
  duration?: number;              // Computed: endTime - startTime
  
  // Input/Output
  input?: {
    prompt?: string;
    params?: Record<string, unknown>;
  };
  output?: {
    result?: unknown;
    summary?: string;             // Brief summary of output
    truncated?: boolean;          // If output was truncated
  };
  
  // Logs and errors
  logs: AgentStepLog[];
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  
  // Tree structure
  children: string[];             // Child step IDs
  
  // UI state
  collapsed?: boolean;
}

/**
 * Stream events for agent execution visualization
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
 * Helper to check if event is an agent step event
 */
export function isAgentStepEvent(event: ExtendedStreamEvent): event is AgentStreamEvent {
  return event.type.startsWith('agent_step_');
}

/**
 * Create a new agent step with defaults
 */
export function createAgentStep(
  partial: Pick<AgentStep, 'id' | 'type' | 'name' | 'title'> & Partial<AgentStep>
): AgentStep {
  return {
    status: 'waiting',
    startTime: Date.now(),
    logs: [],
    children: [],
    collapsed: true,
    ...partial,
  };
}

