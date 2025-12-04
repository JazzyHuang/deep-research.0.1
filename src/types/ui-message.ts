/**
 * AI SDK v5 UIMessage Types for Deep Research
 * 
 * This file defines custom data parts and message types that extend
 * the AI SDK's UIMessage system for research-specific features.
 * 
 * Key concepts:
 * - ResearchDataParts: Maps data part names to their data types
 * - ResearchUIMessage: Typed UIMessage with custom data parts
 * - DataPart<T>: Helper type for creating typed data parts
 */

import type { UIMessage } from 'ai';
import type { Paper } from './paper';

// ============================================================================
// Custom Data Part Types
// ============================================================================

/**
 * Research plan data for the plan card
 */
export interface PlanData {
  plan: {
    mainQuestion: string;
    subQuestions: string[];
    searchStrategies: Array<{
      query: string;
      sources: string[];
      priority: number;
    }>;
    expectedSections: string[];
    estimatedTime?: number;
  };
  summary: {
    subQuestionsCount: number;
    searchStrategiesCount: number;
    expectedSectionsCount: number;
  };
}

/**
 * Paper list data for search results
 */
export interface PaperListData {
  papers: Paper[];
  totalFound: number;
  displayCount: number;
  roundNumber: number;
}

/**
 * Quality metrics data
 */
export interface QualityData {
  metrics: {
    coverageScore: number;
    accuracyScore: number;
    completenessScore: number;
    citationQuality: number;
  };
  analysis: {
    overallScore: number;
    strengths: string[];
    gapsIdentified: string[];
    suggestions: string[];
  };
  iteration: number;
  recommendation: 'pass' | 'iterate' | 'fail';
  improvements?: string[];
}

/**
 * Document/report data
 */
export interface DocumentData {
  title: string;
  content: string;
  version: number;
  wordCount: number;
  citationCount: number;
  qualityScore?: number;
}

/**
 * Checkpoint data for user interaction points
 */
export interface CheckpointData {
  id: string;
  type: 'plan_approval' | 'paper_selection' | 'quality_decision' | 'report_review';
  title: string;
  description: string;
  cardId?: string;
  options: Array<{
    id: string;
    label: string;
    description?: string;
    variant: 'primary' | 'secondary' | 'outline';
    action: string;
  }>;
  requiredAction: boolean;
  createdAt: number;
  resolvedAt?: number;
  resolution?: string;
}

/**
 * Agent step progress data
 */
export interface AgentStepData {
  id: string;
  name: string;
  title: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  startTime?: number;
  endTime?: number;
  duration?: number;
  summary?: string;
  details?: string;
}

/**
 * Todo/task progress data
 */
export interface TodoData {
  todos: Array<{
    id: string;
    text: string;
    status: 'pending' | 'in_progress' | 'completed';
    completedAt?: number;
  }>;
  currentPhase?: string;
}

/**
 * Log line data for execution logs
 */
export interface LogLineData {
  text: string;
  icon?: 'search' | 'filter' | 'analyze' | 'write' | 'check' | 'info' | 'warning' | 'database';
  details?: string;
  timestamp?: number;
}

/**
 * Summary block data
 */
export interface SummaryBlockData {
  title?: string;
  content: string;
  bulletPoints?: string[];
}

/**
 * Notification data (transient)
 */
export interface NotificationData {
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
}

// ============================================================================
// Custom UIMessage Type
// ============================================================================

/**
 * Custom data parts schema for Deep Research
 * These map to `data-{name}` part types in the stream
 * 
 * AI SDK v5 uses generics to type custom data parts:
 * - The key is the data part name (without 'data-' prefix)
 * - The value is the data structure for that part
 * - In the stream, parts appear as { type: 'data-{name}', id?: string, data: {...} }
 */
export interface ResearchDataParts {
  // Cards - rendered as interactive cards in the UI
  plan: PlanData;
  'paper-list': PaperListData;
  quality: QualityData;
  document: DocumentData;
  
  // Research flow control
  checkpoint: CheckpointData;
  'agent-step': AgentStepData;
  'step-complete': { stepId: string; status: string; duration: number };
  todo: TodoData;
  
  // UI elements
  'log-line': LogLineData;
  summary: SummaryBlockData;
  notification: NotificationData;  // Typically sent as transient
  
  // Session control events
  'session-complete': { timestamp: number };
  'session-error': { error: string };
  'agent-paused': { reason?: string };
}

/**
 * Extended UIMessage type for Deep Research
 * 
 * Due to TypeScript constraints with AI SDK's UIDataTypes interface,
 * we use the base UIMessage type and handle custom data parts through
 * type guards at runtime. This provides flexibility while maintaining
 * type safety through explicit type assertions.
 * 
 * Use the DataPart<T> helper type and isDataPartOfType() guard for
 * type-safe access to specific data parts.
 */
export type ResearchUIMessage = UIMessage;

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Extract a specific data part type from ResearchUIMessage
 */
export type DataPart<T extends keyof ResearchDataParts> = {
  type: `data-${T}`;
  id?: string;
  data: ResearchDataParts[T];
};

/**
 * Union of all possible data part types
 * Useful for type guards and switch statements
 */
export type AnyDataPart = {
  [K in keyof ResearchDataParts]: DataPart<K>;
}[keyof ResearchDataParts];

/**
 * Type guard to check if a part is a data part
 */
export function isDataPart(part: { type: string }): part is AnyDataPart {
  return part.type.startsWith('data-');
}

/**
 * Type guard for specific data part types
 */
export function isDataPartOfType<T extends keyof ResearchDataParts>(
  part: { type: string },
  dataType: T
): part is DataPart<T> {
  return part.type === `data-${dataType}`;
}

/**
 * Card types for data parts (maps to cards.ts CardType)
 * Note: This is a subset matching our custom data parts
 */
export type DataCardType = 'plan' | 'paper-list' | 'quality' | 'document';

// ============================================================================
// Session State Types (Re-exports from cards.ts for convenience)
// ============================================================================

// Re-export InteractiveCard and CardType from cards.ts
export type { InteractiveCard, CardType } from './cards';

/**
 * Input button mode for the chat input
 */
export type InputButtonMode = 'send' | 'stop';

