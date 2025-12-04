/**
 * Research Chat Components
 * 
 * AI SDK v5 components for the research chat interface.
 */

// Message-related components
export { UserMessage } from './UserMessage';
export { AssistantMessage } from './AssistantMessage';

// Execution and progress components
export { AgentTimeline } from './AgentTimeline';
export { AgentStepInline, AgentStepsGroup } from './AgentStepInline';
export { TodoProgress } from './TodoProgress';
export { ThinkingBubble, ThinkingIndicator } from './ThinkingBubble';
export { LogLine } from './LogLine';
export { SummaryBlock } from './SummaryBlock';

// SOTA Unified Timeline (stage-grouped, i18n, deduplication)
export { UnifiedTimeline, CompactTimeline } from './UnifiedTimeline';
export { StageGroup } from './StageGroup';

// Progress UI components
export { ProgressHeader, deriveStageFromSteps, type ResearchStage } from './ProgressHeader';
export { FloatingProgress } from './FloatingProgress';

// Stream renderer
export { ResearchStream } from './ResearchStream';

// Input components
export { ChatInput } from './ChatInput';
export { ThoughtIndicator } from './ThoughtIndicator';

// Tool/action components
export { ToolCallBlock } from './ToolCallBlock';
export { FileChangePill } from './FileChangePill';
export { HoverActions } from './HoverActions';

// AI SDK v5 parts-based rendering
export * from './parts';
