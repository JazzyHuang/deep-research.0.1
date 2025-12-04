/**
 * Conversation and Message Types for Human-AI Collaboration
 */

import type { InteractiveCard } from './cards';

// Message types in the conversation stream
export type MessageType = 
  | 'user'           // User message
  | 'assistant'      // AI text response
  | 'agent_progress' // Agent execution progress (collapsible timeline)
  | 'card'           // Interactive card
  | 'checkpoint'     // Checkpoint requiring user confirmation
  | 'log_line'       // Gray execution log entry
  | 'summary_block'  // White key summary
  | 'thinking';      // Collapsible thinking process

// Log line icon types
export type LogLineIcon = 
  | 'search' 
  | 'filter' 
  | 'analyze' 
  | 'write' 
  | 'check' 
  | 'info'
  | 'warning'
  | 'database';

// Log line data for execution logs
export interface LogLineData {
  text: string;
  icon?: LogLineIcon;
  details?: string;        // Optional expandable details
  timestamp?: number;
}

// Summary block data for key summaries
export interface SummaryBlockData {
  title?: string;          // Optional title like "Summary" or "Next Steps"
  content: string;
  bulletPoints?: string[]; // Optional list of key points
}

// Thinking process data
export interface ThinkingData {
  content: string;
  duration?: number;       // Duration in seconds
  isComplete: boolean;
}

// Todo item for task tracking
export interface TodoItem {
  id: string;
  text: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: number;
}

// Task progress for todo tracking
export interface TaskProgress {
  todos: TodoItem[];
  currentPhase?: string;   // e.g., "Planning", "Searching", "Writing"
}

// Message role (simplified)
export type MessageRole = 'user' | 'assistant' | 'system';

// Agent step status
export type StepStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

// Agent step in the execution timeline
export interface AgentStep {
  id: string;
  name: string;
  title: string;
  status: StepStatus;
  startTime?: number;
  endTime?: number;
  duration?: number;
  children?: AgentStep[];
  summary?: string;        // Summary shown when collapsed
  details?: string;        // Additional details
}

// Agent progress for timeline display
export interface AgentProgress {
  steps: AgentStep[];
  currentStepId?: string;
  isCollapsed: boolean;
}

// Checkpoint types
export type CheckpointType = 
  | 'plan_approval'      // Research plan confirmation
  | 'paper_selection'    // Paper filtering (optional)
  | 'quality_decision'   // Quality review decision
  | 'report_review';     // Final report review

// Checkpoint data
export interface CheckpointData {
  id: string;
  type: CheckpointType;
  title: string;
  description: string;
  cardId?: string;       // Associated card ID
  options: CheckpointOption[];
  requiredAction: boolean;  // Must wait for user
  createdAt: number;
  resolvedAt?: number;
  resolution?: string;
}

// Checkpoint option for user selection
export interface CheckpointOption {
  id: string;
  label: string;
  description?: string;
  variant: 'primary' | 'secondary' | 'outline';
  action: string;        // Action identifier
}

// Main message interface
export interface Message {
  id: string;
  type: MessageType;
  role?: MessageRole;
  timestamp: number;
  content?: string;
  
  // Agent progress (for type: 'agent_progress')
  progress?: AgentProgress;
  
  // Card reference (for type: 'card')
  card?: InteractiveCard;
  
  // Checkpoint data (for type: 'checkpoint')
  checkpoint?: CheckpointData;
  
  // Log line data (for type: 'log_line')
  logLine?: LogLineData;
  
  // Summary block data (for type: 'summary_block')
  summaryBlock?: SummaryBlockData;
  
  // Thinking process data (for type: 'thinking')
  thinking?: ThinkingData;
  
  // Streaming state
  isStreaming?: boolean;
}

// Session state for conversation
export interface ConversationState {
  sessionId: string;
  query: string;
  messages: Message[];
  taskProgress: TaskProgress;
  isConnected: boolean;
  error?: string;
}

// User input for checkpoint response
export interface CheckpointResponse {
  checkpointId: string;
  action: string;
  data?: Record<string, unknown>;
  message?: string;
}

// SSE/WebSocket event types for conversation
export type ConversationEvent = 
  // Message events
  | { type: 'message_start'; messageId: string; messageType: MessageType; role?: MessageRole }
  | { type: 'message_content'; messageId: string; content: string }
  | { type: 'message_complete'; messageId: string }
  
  // Agent progress events
  | { type: 'step_start'; step: AgentStep }
  | { type: 'step_update'; stepId: string; updates: Partial<AgentStep> }
  | { type: 'step_complete'; stepId: string; duration: number; status: StepStatus }
  
  // Card events
  | { type: 'card_created'; card: InteractiveCard }
  | { type: 'card_updated'; cardId: string; updates: Partial<InteractiveCard> }
  
  // Checkpoint events
  | { type: 'checkpoint_reached'; checkpoint: CheckpointData }
  | { type: 'checkpoint_resolved'; checkpointId: string; resolution: string }
  
  // Log and summary events
  | { type: 'log_line'; data: LogLineData }
  | { type: 'summary_block'; data: SummaryBlockData }
  
  // Thinking events
  | { type: 'thinking_start'; messageId: string }
  | { type: 'thinking_content'; messageId: string; content: string }
  | { type: 'thinking_complete'; messageId: string; duration: number }
  
  // Todo events
  | { type: 'todo_update'; todos: TodoItem[] }
  | { type: 'todo_item_complete'; todoId: string }
  
  // Control events
  | { type: 'agent_paused'; reason?: string }
  | { type: 'agent_resumed' }
  | { type: 'session_complete' }
  | { type: 'session_error'; error: string };







