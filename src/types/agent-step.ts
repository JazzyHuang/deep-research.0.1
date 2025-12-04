/**
 * Agent Step types for execution visualization
 * Used to display the research workflow progress in the UI
 */

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





