/**
 * Agent Event Manager
 * 
 * Manages agent events with:
 * - Deduplication: Same stage+stepType+iteration updates existing event
 * - Context injection: Automatically adds rich metadata
 * - Batch updates: Aggregates rapid events
 * - Hierarchy: Supports parent-child event relationships
 */

import {
  AgentEvent,
  AgentEventUpdate,
  AgentEventStatus,
  AgentStage,
  AgentStepType,
  AgentEventMeta,
  AgentEventStreamEvent,
  generateEventId,
  createAgentEvent,
  mergeEventUpdate,
} from '@/types/agent-event';

/**
 * Options for creating a new event
 */
export interface EmitEventOptions {
  stage: AgentStage;
  stepType: AgentStepType;
  titleEn: string;
  titleZh: string;
  status?: AgentEventStatus;
  iteration?: number;
  totalIterations?: number;
  meta?: AgentEventMeta;
  parentId?: string;
}

/**
 * Options for updating an existing event
 */
export interface UpdateEventOptions {
  id: string;
  status?: AgentEventStatus;
  meta?: Partial<AgentEventMeta>;
  iteration?: number;
  totalIterations?: number;
}

/**
 * Options for completing an event
 */
export interface CompleteEventOptions {
  id: string;
  status?: AgentEventStatus;
  meta?: Partial<AgentEventMeta>;
}

/**
 * Event Manager Class
 * 
 * Manages the lifecycle of agent events during a research session.
 * Emits unified events that can be reconciled on the frontend.
 */
export class EventManager {
  /** Map of event ID -> event */
  private events: Map<string, AgentEvent> = new Map();
  
  /** Map of stage:stepType -> latest event ID (for deduplication) */
  private stageStepMap: Map<string, string> = new Map();
  
  /** Current iteration counts per stage:stepType */
  private iterationCounts: Map<string, number> = new Map();
  
  /** Event emitter callback */
  private emitCallback: (event: AgentEventStreamEvent) => void;
  
  /** Session ID for logging */
  private sessionId: string;
  
  constructor(
    sessionId: string,
    emitCallback: (event: AgentEventStreamEvent) => void
  ) {
    this.sessionId = sessionId;
    this.emitCallback = emitCallback;
  }
  
  /**
   * Emit a new event or update existing one with same stage+stepType
   */
  emit(options: EmitEventOptions): AgentEvent {
    const {
      stage,
      stepType,
      titleEn,
      titleZh,
      status = 'running',
      iteration,
      totalIterations,
      meta,
      parentId,
    } = options;
    
    // Determine iteration
    const key = `${stage}:${stepType}`;
    let actualIteration = iteration;
    
    if (actualIteration === undefined && this.shouldAutoIterate(stepType)) {
      // Auto-increment iteration for multi-round step types
      const current = this.iterationCounts.get(key) || 0;
      actualIteration = current + 1;
      this.iterationCounts.set(key, actualIteration);
    }
    
    // Generate event ID
    const eventId = generateEventId(stage, stepType, actualIteration);
    
    // Check if event already exists
    const existingEvent = this.events.get(eventId);
    
    if (existingEvent) {
      // Update existing event
      return this.update({
        id: eventId,
        status,
        meta,
        iteration: actualIteration,
        totalIterations,
      });
    }
    
    // Create new event
    const event = createAgentEvent({
      stage,
      stepType,
      titleEn,
      titleZh,
      status,
      iteration: actualIteration,
      totalIterations,
      meta,
      parentId,
    });
    
    // Store event
    this.events.set(eventId, event);
    this.stageStepMap.set(key, eventId);
    
    // Emit start event
    this.emitCallback({
      type: 'agent_event_start',
      event,
    });
    
    return event;
  }
  
  /**
   * Update an existing event
   */
  update(options: UpdateEventOptions): AgentEvent {
    const { id, status, meta, iteration, totalIterations } = options;
    
    const existingEvent = this.events.get(id);
    if (!existingEvent) {
      console.warn(`[EventManager] Event ${id} not found for update`);
      // Create a placeholder event if not found
      return existingEvent as unknown as AgentEvent;
    }
    
    // Create update payload
    const update: AgentEventUpdate = {
      id,
      status,
      meta,
      iteration,
      totalIterations,
    };
    
    // Merge update
    const updatedEvent = mergeEventUpdate(existingEvent, update);
    this.events.set(id, updatedEvent);
    
    // Emit update event
    this.emitCallback({
      type: 'agent_event_update',
      update,
    });
    
    return updatedEvent;
  }
  
  /**
   * Complete an event
   */
  complete(options: CompleteEventOptions): AgentEvent | null {
    const { id, status = 'success', meta } = options;
    
    const existingEvent = this.events.get(id);
    if (!existingEvent) {
      console.warn(`[EventManager] Event ${id} not found for completion`);
      return null;
    }
    
    const endTime = Date.now();
    const duration = endTime - existingEvent.startTime;
    
    // Create update payload
    const update: AgentEventUpdate = {
      id,
      status,
      meta,
      endTime,
      duration,
    };
    
    // Merge update
    const completedEvent = mergeEventUpdate(existingEvent, update);
    this.events.set(id, completedEvent);
    
    // Emit complete event
    this.emitCallback({
      type: 'agent_event_complete',
      id,
      status,
      duration,
      meta,
    });
    
    return completedEvent;
  }
  
  /**
   * Get the current event for a stage+stepType
   */
  getCurrentEvent(stage: AgentStage, stepType: AgentStepType): AgentEvent | undefined {
    const key = `${stage}:${stepType}`;
    const eventId = this.stageStepMap.get(key);
    return eventId ? this.events.get(eventId) : undefined;
  }
  
  /**
   * Get event by ID
   */
  getEvent(id: string): AgentEvent | undefined {
    return this.events.get(id);
  }
  
  /**
   * Get all events
   */
  getAllEvents(): AgentEvent[] {
    return Array.from(this.events.values());
  }
  
  /**
   * Get current iteration for a stage+stepType
   */
  getCurrentIteration(stage: AgentStage, stepType: AgentStepType): number {
    const key = `${stage}:${stepType}`;
    return this.iterationCounts.get(key) || 0;
  }
  
  /**
   * Set total iterations for a stage+stepType
   */
  setTotalIterations(stage: AgentStage, stepType: AgentStepType, total: number): void {
    const key = `${stage}:${stepType}`;
    const eventId = this.stageStepMap.get(key);
    if (eventId) {
      this.update({ id: eventId, totalIterations: total });
    }
  }
  
  /**
   * Check if a step type should auto-iterate
   */
  private shouldAutoIterate(stepType: AgentStepType): boolean {
    const multiRoundTypes: AgentStepType[] = [
      'search_round',
      'gap_search',
      'generate_report',
      'revise_report',
      'quality_review',
    ];
    return multiRoundTypes.includes(stepType);
  }
  
  /**
   * Reset iteration count for a stage+stepType
   */
  resetIteration(stage: AgentStage, stepType: AgentStepType): void {
    const key = `${stage}:${stepType}`;
    this.iterationCounts.set(key, 0);
  }
  
  /**
   * Clear all events (for new session)
   */
  clear(): void {
    this.events.clear();
    this.stageStepMap.clear();
    this.iterationCounts.clear();
  }
}

// ============================================================================
// Helper functions for common event patterns
// ============================================================================

/**
 * Create planning stage events
 */
export function emitPlanningEvents(
  manager: EventManager,
  action: 'start' | 'complete',
  meta?: Partial<AgentEventMeta>
) {
  const eventId = generateEventId('planning', 'create_plan');
  
  if (action === 'start') {
    return manager.emit({
      stage: 'planning',
      stepType: 'create_plan',
      titleEn: 'Creating Research Plan',
      titleZh: '创建研究计划',
      status: 'running',
      meta: meta as AgentEventMeta,
    });
  } else {
    return manager.complete({
      id: eventId,
      status: 'success',
      meta,
    });
  }
}

/**
 * Create search stage events
 */
export function emitSearchEvent(
  manager: EventManager,
  options: {
    action: 'start' | 'update' | 'complete';
    iteration: number;
    totalIterations?: number;
    query?: string;
    paperCount?: number;
    newPaperCount?: number;
    sourceBreakdown?: Record<string, number>;
    isParallel?: boolean;
    isGapSearch?: boolean;
  }
) {
  const stepType: AgentStepType = options.isParallel 
    ? 'parallel_search' 
    : options.isGapSearch 
    ? 'gap_search' 
    : 'search_round';
  
  const eventId = generateEventId('searching', stepType, options.iteration);
  
  const meta: AgentEventMeta = {
    query: options.query,
    paperCount: options.paperCount,
    newPaperCount: options.newPaperCount,
    sourceBreakdown: options.sourceBreakdown,
  };
  
  if (options.action === 'start') {
    return manager.emit({
      stage: 'searching',
      stepType,
      titleEn: options.isParallel 
        ? 'Parallel Multi-Strategy Search'
        : options.isGapSearch
        ? 'Targeted Gap-Filling Search'
        : `Search Round ${options.iteration}`,
      titleZh: options.isParallel 
        ? '并行多策略搜索'
        : options.isGapSearch
        ? '定向补充搜索'
        : `搜索 Round ${options.iteration}`,
      status: 'running',
      iteration: options.iteration,
      totalIterations: options.totalIterations,
      meta,
    });
  } else if (options.action === 'update') {
    return manager.update({
      id: eventId,
      meta,
      iteration: options.iteration,
      totalIterations: options.totalIterations,
    });
  } else {
    return manager.complete({
      id: eventId,
      status: 'success',
      meta,
    });
  }
}

/**
 * Create analysis stage events
 */
export function emitAnalysisEvent(
  manager: EventManager,
  options: {
    action: 'start' | 'complete';
    iteration: number;
    paperCount?: number;
    compressionRatio?: number;
  }
) {
  const eventId = generateEventId('analyzing', 'analyze_papers', options.iteration);
  
  const meta: AgentEventMeta = {
    processingCount: options.paperCount,
    compressionRatio: options.compressionRatio,
  };
  
  if (options.action === 'start') {
    return manager.emit({
      stage: 'analyzing',
      stepType: 'analyze_papers',
      titleEn: `Analyzing Papers (Iteration ${options.iteration})`,
      titleZh: `分析论文 (第 ${options.iteration} 轮)`,
      status: 'running',
      iteration: options.iteration,
      meta,
    });
  } else {
    return manager.complete({
      id: eventId,
      status: 'success',
      meta,
    });
  }
}

/**
 * Create writing stage events
 */
export function emitWritingEvent(
  manager: EventManager,
  options: {
    action: 'start' | 'update' | 'complete';
    iteration: number;
    isRevision?: boolean;
    section?: string;
    wordCount?: number;
    citationCount?: number;
  }
) {
  const stepType: AgentStepType = options.isRevision ? 'revise_report' : 'generate_report';
  const eventId = generateEventId('writing', stepType, options.iteration);
  
  const meta: AgentEventMeta = {
    section: options.section,
    wordCount: options.wordCount,
    citationCount: options.citationCount,
  };
  
  if (options.action === 'start') {
    return manager.emit({
      stage: 'writing',
      stepType,
      titleEn: options.isRevision 
        ? `Revising Report (Iteration ${options.iteration})`
        : 'Generating Research Report',
      titleZh: options.isRevision 
        ? `修订报告 (第 ${options.iteration} 轮)`
        : '撰写研究报告',
      status: 'running',
      iteration: options.iteration,
      meta,
    });
  } else if (options.action === 'update') {
    return manager.update({
      id: eventId,
      meta,
    });
  } else {
    return manager.complete({
      id: eventId,
      status: 'success',
      meta,
    });
  }
}

/**
 * Create quality review events
 */
export function emitQualityEvent(
  manager: EventManager,
  options: {
    action: 'start' | 'complete';
    iteration: number;
    score?: number;
    decision?: 'pass' | 'iterate' | 'fail';
    gapsFound?: number;
  }
) {
  const eventId = generateEventId('reviewing', 'quality_review', options.iteration);
  
  const meta: AgentEventMeta = {
    score: options.score,
    decision: options.decision,
    gapsFound: options.gapsFound,
  };
  
  if (options.action === 'start') {
    return manager.emit({
      stage: 'reviewing',
      stepType: 'quality_review',
      titleEn: `Quality Review (Iteration ${options.iteration})`,
      titleZh: `质量评审 (第 ${options.iteration} 轮)`,
      status: 'running',
      iteration: options.iteration,
      meta,
    });
  } else {
    return manager.complete({
      id: eventId,
      status: options.decision === 'pass' ? 'success' : 'success',
      meta,
    });
  }
}

export default EventManager;


