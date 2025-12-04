/**
 * Unified Agent Event Types for SOTA Timeline Visualization
 * 
 * This module defines a unified event system that:
 * - Eliminates duplicate logs through smart reconciliation
 * - Supports i18n with titleEn/titleZh
 * - Tracks iterations for multi-round operations
 * - Includes rich metadata for context
 */

/**
 * High-level stages in the research workflow
 */
export type AgentStage = 
  | 'planning'
  | 'searching'
  | 'analyzing'
  | 'writing'
  | 'reviewing'
  | 'validating'
  | 'complete'
  | 'error';

/**
 * Specific step types within each stage
 */
export type AgentStepType =
  // Planning
  | 'create_plan'
  | 'build_checklist'
  // Searching
  | 'parallel_search'
  | 'search_round'
  | 'gap_search'
  // Analyzing
  | 'analyze_papers'
  | 'compress_context'
  // Writing
  | 'generate_report'
  | 'revise_report'
  | 'finalize_report'
  // Reviewing
  | 'evidence_audit'
  | 'quality_review'
  | 'citation_validation'
  // Control
  | 'workflow_decision'
  | 'error';

/**
 * Event status
 */
export type AgentEventStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

/**
 * Rich metadata for events
 */
export interface AgentEventMeta {
  // Search-related
  query?: string;
  queries?: string[];
  paperCount?: number;
  newPaperCount?: number;
  totalPaperCount?: number;
  sourceBreakdown?: Record<string, number>;
  
  // Analysis-related
  processingCount?: number;
  compressionRatio?: number;
  
  // Quality-related
  score?: number;
  decision?: 'pass' | 'iterate' | 'fail';
  gapsFound?: number;
  
  // Writing-related
  section?: string;
  wordCount?: number;
  citationCount?: number;
  
  // General
  reason?: string;
  summary?: string;
  progress?: string;
  details?: Record<string, unknown>;
}

/**
 * Unified Agent Event
 * 
 * Each event represents a discrete action in the research workflow.
 * Events with the same stage+stepType+iteration are reconciled (updated)
 * rather than duplicated.
 */
export interface AgentEvent {
  /** Unique identifier: {stage}-{stepType}-{iteration} */
  id: string;
  
  /** High-level workflow stage */
  stage: AgentStage;
  
  /** Specific action type */
  stepType: AgentStepType;
  
  /** English title */
  titleEn: string;
  
  /** Chinese title */
  titleZh: string;
  
  /** Current status */
  status: AgentEventStatus;
  
  /** Current iteration (1-indexed) for multi-round operations */
  iteration?: number;
  
  /** Total expected iterations (if known) */
  totalIterations?: number;
  
  /** Rich metadata */
  meta?: AgentEventMeta;
  
  /** Nested sub-events */
  children?: AgentEvent[];
  
  /** Parent event ID for tree structure */
  parentId?: string;
  
  /** Start timestamp */
  startTime: number;
  
  /** End timestamp */
  endTime?: number;
  
  /** Duration in ms */
  duration?: number;
}

/**
 * Event update payload (partial update)
 */
export interface AgentEventUpdate {
  id: string;
  status?: AgentEventStatus;
  iteration?: number;
  totalIterations?: number;
  meta?: Partial<AgentEventMeta>;
  endTime?: number;
  duration?: number;
}

/**
 * Stream event types for agent events
 */
export type AgentEventStreamEvent =
  | { type: 'agent_event_start'; event: AgentEvent }
  | { type: 'agent_event_update'; update: AgentEventUpdate }
  | { type: 'agent_event_complete'; id: string; status: AgentEventStatus; duration?: number; meta?: Partial<AgentEventMeta> };

/**
 * Stage configuration for UI display
 */
export interface StageConfig {
  stage: AgentStage;
  titleEn: string;
  titleZh: string;
  icon: string;
  color: string;
}

/**
 * Stage configurations
 */
export const STAGE_CONFIGS: Record<AgentStage, StageConfig> = {
  planning: {
    stage: 'planning',
    titleEn: 'Planning',
    titleZh: '规划研究',
    icon: 'brain',
    color: 'primary',
  },
  searching: {
    stage: 'searching',
    titleEn: 'Literature Search',
    titleZh: '文献检索',
    icon: 'search',
    color: 'blue',
  },
  analyzing: {
    stage: 'analyzing',
    titleEn: 'Analysis',
    titleZh: '分析论文',
    icon: 'chart',
    color: 'purple',
  },
  writing: {
    stage: 'writing',
    titleEn: 'Writing',
    titleZh: '撰写报告',
    icon: 'pen',
    color: 'green',
  },
  reviewing: {
    stage: 'reviewing',
    titleEn: 'Quality Review',
    titleZh: '质量评审',
    icon: 'check',
    color: 'orange',
  },
  validating: {
    stage: 'validating',
    titleEn: 'Validation',
    titleZh: '验证引用',
    icon: 'shield',
    color: 'teal',
  },
  complete: {
    stage: 'complete',
    titleEn: 'Complete',
    titleZh: '完成',
    icon: 'check-circle',
    color: 'success',
  },
  error: {
    stage: 'error',
    titleEn: 'Error',
    titleZh: '错误',
    icon: 'alert',
    color: 'destructive',
  },
};

/**
 * Generate a deterministic event ID
 */
export function generateEventId(stage: AgentStage, stepType: AgentStepType, iteration?: number): string {
  const base = `${stage}-${stepType}`;
  return iteration !== undefined ? `${base}-${iteration}` : base;
}

/**
 * Create a new agent event with defaults
 */
export function createAgentEvent(
  params: Pick<AgentEvent, 'stage' | 'stepType' | 'titleEn' | 'titleZh'> & Partial<AgentEvent>
): AgentEvent {
  const { stage, stepType, iteration, ...rest } = params;
  return {
    id: generateEventId(stage, stepType, iteration),
    stage,
    stepType,
    status: 'pending',
    startTime: Date.now(),
    iteration,
    ...rest,
  };
}

/**
 * Format iteration display text
 */
export function formatIteration(iteration: number, total?: number, locale: 'en' | 'zh' = 'zh'): string {
  if (total) {
    return locale === 'zh' ? `第 ${iteration}/${total} 轮` : `Round ${iteration}/${total}`;
  }
  return locale === 'zh' ? `第 ${iteration} 轮` : `Round ${iteration}`;
}

/**
 * Get localized title based on locale
 */
export function getLocalizedTitle(event: AgentEvent, locale: 'en' | 'zh' = 'zh'): string {
  return locale === 'zh' ? event.titleZh : event.titleEn;
}

/**
 * Format metadata summary for display
 */
export function formatMetaSummary(meta: AgentEventMeta, locale: 'en' | 'zh' = 'zh'): string {
  const parts: string[] = [];
  
  if (meta.query) {
    const truncatedQuery = meta.query.length > 50 ? meta.query.slice(0, 47) + '...' : meta.query;
    parts.push(`"${truncatedQuery}"`);
  }
  
  if (meta.paperCount !== undefined) {
    parts.push(locale === 'zh' ? `${meta.paperCount} 篇论文` : `${meta.paperCount} papers`);
  }
  
  if (meta.newPaperCount !== undefined) {
    parts.push(locale === 'zh' ? `新增 ${meta.newPaperCount} 篇` : `${meta.newPaperCount} new`);
  }
  
  if (meta.score !== undefined) {
    parts.push(`${meta.score}/100`);
  }
  
  if (meta.wordCount !== undefined) {
    parts.push(locale === 'zh' ? `${meta.wordCount} 字` : `${meta.wordCount} words`);
  }
  
  if (meta.citationCount !== undefined) {
    parts.push(locale === 'zh' ? `${meta.citationCount} 引用` : `${meta.citationCount} citations`);
  }
  
  return parts.join(' · ');
}

/**
 * Check if two events should be merged (same stage+type+iteration)
 */
export function shouldMergeEvents(a: AgentEvent, b: AgentEvent): boolean {
  return a.stage === b.stage && 
         a.stepType === b.stepType && 
         a.iteration === b.iteration;
}

/**
 * Merge event update into existing event
 */
export function mergeEventUpdate(event: AgentEvent, update: AgentEventUpdate): AgentEvent {
  return {
    ...event,
    status: update.status ?? event.status,
    iteration: update.iteration ?? event.iteration,
    totalIterations: update.totalIterations ?? event.totalIterations,
    meta: update.meta ? { ...event.meta, ...update.meta } : event.meta,
    endTime: update.endTime ?? event.endTime,
    duration: update.duration ?? event.duration,
  };
}


