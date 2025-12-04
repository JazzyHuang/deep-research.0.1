/**
 * Agent State and Control Types for Human-AI Collaboration
 */

import type { ResearchPlan, SearchRound, QualityMetrics, CriticAnalysis, Citation } from './research';
import type { Paper } from './paper';
import type { CheckpointType, CheckpointData } from './conversation';
import type { InteractiveCard } from './cards';

// Agent execution state
export type AgentExecutionState = 
  | 'idle'                 // Not started
  | 'running'              // Executing
  | 'paused'               // Paused by user
  | 'awaiting_checkpoint'  // Waiting at checkpoint
  | 'completed'            // Finished successfully
  | 'error';               // Error occurred

// Research phase
export type ResearchPhase = 
  | 'initializing'
  | 'planning'
  | 'searching'
  | 'analyzing'
  | 'writing'
  | 'reviewing'
  | 'iterating'
  | 'finalizing'
  | 'complete';

// Input button state (send/stop toggle)
export type InputButtonMode = 'send' | 'stop';

// Agent session interface
export interface AgentSession {
  id: string;
  query: string;
  state: AgentExecutionState;
  phase: ResearchPhase;
  
  // Current checkpoint (if any)
  currentCheckpoint?: CheckpointData;
  
  // Execution context (for pause/resume)
  context: AgentContext;
  
  // User inputs history
  userInputs: UserInput[];
  
  // Cards created during session
  cards: Map<string, InteractiveCard>;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

// Agent context (preserved state for pause/resume)
export interface AgentContext {
  plan?: ResearchPlan;
  papers: Paper[];
  searchRounds: SearchRound[];
  currentSearchRound: number;
  reportContent?: string;
  reportVersion: number;
  citations: Citation[];
  qualityMetrics?: QualityMetrics;
  qualityAnalysis?: CriticAnalysis;
  iteration: number;
  gaps: string[];
  
  // User modifications
  userModifications?: {
    planEdits?: Partial<ResearchPlan>;
    excludedPaperIds?: string[];
    selectedPaperIds?: string[];
    reportEdits?: string;
    additionalInstructions?: string[];
  };
}

// User input (commands and messages)
export interface UserInput {
  id: string;
  type: 'message' | 'command' | 'checkpoint_response' | 'card_edit';
  content?: string;
  timestamp: number;
  
  // For checkpoint responses
  checkpointId?: string;
  action?: string;
  
  // For card edits
  cardId?: string;
  edits?: Record<string, unknown>;
}

// Checkpoint configuration
export interface CheckpointConfig {
  type: CheckpointType;
  phase: ResearchPhase;
  required: boolean;
  condition?: (context: AgentContext) => boolean;
  autoAction?: (context: AgentContext) => 'continue' | 'wait';
  timeout?: number;  // Auto-continue timeout in seconds
}

// Default checkpoint configurations
export const CHECKPOINT_CONFIGS: CheckpointConfig[] = [
  {
    type: 'plan_approval',
    phase: 'planning',
    required: true,
    condition: () => true,
    // No autoAction - always wait for user
  },
  {
    type: 'paper_selection',
    phase: 'searching',
    required: false,
    condition: (ctx) => ctx.papers.length > 30,
    autoAction: (ctx) => ctx.papers.length <= 30 ? 'continue' : 'wait',
  },
  {
    type: 'quality_decision',
    phase: 'reviewing',
    required: true,
    condition: () => true,
    autoAction: (ctx) => {
      const score = ctx.qualityAnalysis?.overallScore ?? 0;
      return score >= 85 ? 'continue' : 'wait';
    },
  },
  {
    type: 'report_review',
    phase: 'finalizing',
    required: true,
    condition: () => true,
    // No autoAction - always wait for user
  },
];

// Agent control commands
export type AgentCommand = 
  | { type: 'start'; query: string }
  | { type: 'stop' }
  | { type: 'resume'; instruction?: string }
  | { type: 'checkpoint_response'; checkpointId: string; action: string; data?: Record<string, unknown> }
  | { type: 'card_update'; cardId: string; updates: Record<string, unknown> }
  | { type: 'message'; content: string };

// Session store actions
export interface SessionActions {
  // Control
  startSession: (query: string) => void;
  stopAgent: () => void;
  resumeAgent: (instruction?: string) => void;
  
  // Checkpoints
  respondToCheckpoint: (checkpointId: string, action: string, data?: Record<string, unknown>) => void;
  
  // Cards
  updateCard: (cardId: string, updates: Record<string, unknown>) => void;
  
  // Messages
  sendMessage: (content: string) => void;
  
  // Side panel
  openSidePanel: (cardId: string) => void;
  closeSidePanel: () => void;
  saveSidePanelChanges: (cardId: string, changes: Record<string, unknown>) => void;
}

// Research session state (full state for UI)
export interface ResearchSessionState {
  // Session info
  sessionId: string;
  query: string;
  
  // Agent state
  agentState: AgentExecutionState;
  phase: ResearchPhase;
  currentCheckpoint?: CheckpointData;
  
  // Messages and cards
  messages: import('./conversation').Message[];
  cards: Map<string, InteractiveCard>;
  
  // Task progress (todos)
  taskProgress: import('./conversation').TaskProgress;
  
  // Side panel state
  sidePanel: {
    isOpen: boolean;
    cardId?: string;
    cardType?: import('./cards').CardType;
  };
  
  // Input state
  inputState: {
    value: string;
    buttonMode: InputButtonMode;
    disabled: boolean;
  };
  
  // Connection state
  isConnected: boolean;
  error?: string;
}

// Helper to create initial session state
export function createInitialSessionState(sessionId: string, query: string): ResearchSessionState {
  return {
    sessionId,
    query,
    agentState: 'idle',
    phase: 'initializing',
    messages: [],
    cards: new Map(),
    taskProgress: { todos: [] },
    sidePanel: {
      isOpen: false,
    },
    inputState: {
      value: '',
      buttonMode: 'send',
      disabled: false,
    },
    isConnected: false,
  };
}

// Helper to determine button mode from agent state
export function getButtonMode(state: AgentExecutionState): InputButtonMode {
  return state === 'running' ? 'stop' : 'send';
}

// Helper to check if input should be disabled
export function isInputDisabled(state: AgentExecutionState, hasCheckpoint: boolean): boolean {
  // Disabled when running (can only stop), enabled otherwise
  return state === 'running';
}







