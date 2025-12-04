// Core types
export * from './paper';

// Research types (aggregated for backward compatibility)
export * from './research';

// Specialized type modules (prefer these for new code)
export * from './search';
export * from './quality';
export * from './report';
export * from './stream';
export * from './agent-step';
export * from './session';

// Explicitly export from conversation to avoid name collisions
export type {
  MessageType,
  MessageRole,
  StepStatus,
  AgentProgress,
  CheckpointType,
  CheckpointData,
  CheckpointOption,
  Message,
  ConversationState,
  CheckpointResponse,
  ConversationEvent,
} from './conversation';

// Rename AgentStep from conversation to avoid collision with research.ts
export type { AgentStep as ConversationAgentStep } from './conversation';

export * from './cards';

// Explicitly export from agent to avoid collisions
export type {
  AgentExecutionState,
  ResearchPhase,
  InputButtonMode,
  AgentSession,
  AgentContext,
  UserInput,
  CheckpointConfig,
  AgentCommand,
  SessionActions,
  ResearchSessionState,
} from './agent';

export {
  CHECKPOINT_CONFIGS,
  createInitialSessionState,
  getButtonMode,
  isInputDisabled,
} from './agent';

// AI SDK v5 UIMessage types
export type {
  ResearchUIMessage,
  ResearchDataParts,
  InteractiveCard as UIInteractiveCard,
  CardType as UICardType,
  PlanData,
  PaperListData,
  QualityData,
  DocumentData,
  CheckpointData as UICheckpointData,
  AgentStepData,
  TodoData,
  LogLineData as UILogLineData,
  SummaryBlockData as UISummaryBlockData,
  NotificationData,
  DataPart,
  AnyDataPart,
  DataCardType,
} from './ui-message';

export { isDataPart, isDataPartOfType } from './ui-message';
