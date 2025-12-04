'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { AgentEventData } from '@/types/ui-message';
import { StageGroup } from './StageGroup';

// ============================================================================
// Types
// ============================================================================

type StageType = AgentEventData['stage'];

interface UnifiedTimelineProps {
  events: AgentEventData[];
  locale?: 'en' | 'zh';
  className?: string;
}

// Stage order for display
const STAGE_ORDER: StageType[] = [
  'planning',
  'searching',
  'analyzing',
  'writing',
  'reviewing',
  'validating',
  'complete',
  'error',
];

// ============================================================================
// UnifiedTimeline Component
// ============================================================================

/**
 * UnifiedTimeline - SOTA Agent execution timeline
 * 
 * Features:
 * - Groups events by stage for clear visual hierarchy
 * - Deduplicates events automatically (reconciled in hook)
 * - Supports i18n with locale prop
 * - Shows rich metadata (query, paper counts, scores)
 * - Collapsible stages with progress summaries
 * 
 * Usage:
 * ```tsx
 * const { agentEvents } = useResearchChat({ sessionId });
 * <UnifiedTimeline events={agentEvents} locale="zh" />
 * ```
 */
export function UnifiedTimeline({ 
  events, 
  locale = 'zh',
  className 
}: UnifiedTimelineProps) {
  
  // Group events by stage
  const groupedEvents = useMemo(() => {
    const groups = new Map<StageType, AgentEventData[]>();
    
    // Initialize all stages with empty arrays
    for (const stage of STAGE_ORDER) {
      groups.set(stage, []);
    }
    
    // Group events by stage
    for (const event of events) {
      const stageEvents = groups.get(event.stage);
      if (stageEvents) {
        stageEvents.push(event);
      }
    }
    
    // Filter out empty stages and convert to array
    return STAGE_ORDER
      .map(stage => ({
        stage,
        events: groups.get(stage) || [],
      }))
      .filter(group => group.events.length > 0);
  }, [events]);
  
  // Check if any stage is currently active
  const activeStage = useMemo(() => {
    for (const event of events) {
      if (event.status === 'running') {
        return event.stage;
      }
    }
    return null;
  }, [events]);
  
  if (events.length === 0) {
    return null;
  }
  
  return (
    <div className={cn("unified-timeline space-y-1", className)}>
      {groupedEvents.map(({ stage, events: stageEvents }) => (
        <StageGroup
          key={stage}
          stage={stage}
          events={stageEvents}
          isActive={stage === activeStage}
          locale={locale}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Compact Timeline Variant
// ============================================================================

interface CompactTimelineProps {
  events: AgentEventData[];
  locale?: 'en' | 'zh';
  className?: string;
}

/**
 * CompactTimeline - Minimal progress indicator
 * 
 * Shows a single-line summary of current progress:
 * - Current step title
 * - Progress count (completed/total)
 * - Active indicator
 */
export function CompactTimeline({ 
  events, 
  locale = 'zh',
  className 
}: CompactTimelineProps) {
  
  const summary = useMemo(() => {
    const running = events.find(e => e.status === 'running');
    const completed = events.filter(e => e.status === 'success').length;
    const total = events.length;
    const hasError = events.some(e => e.status === 'error');
    
    return {
      currentTitle: running 
        ? (locale === 'zh' ? running.titleZh : running.titleEn)
        : hasError 
        ? (locale === 'zh' ? '执行出错' : 'Error')
        : (locale === 'zh' ? '已完成' : 'Complete'),
      completed,
      total,
      isRunning: !!running,
      hasError,
    };
  }, [events, locale]);
  
  if (events.length === 0) {
    return null;
  }
  
  return (
    <div className={cn(
      "inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full",
      "bg-muted/30 border border-border/50",
      "text-sm",
      className
    )}>
      {/* Status indicator */}
      {summary.isRunning ? (
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
        </div>
      ) : summary.hasError ? (
        <div className="w-2 h-2 rounded-full bg-destructive" />
      ) : (
        <div className="w-2 h-2 rounded-full bg-green-500" />
      )}
      
      {/* Current step title */}
      <span className={cn(
        "font-medium max-w-48 truncate",
        summary.hasError ? "text-destructive" : "text-foreground"
      )}>
        {summary.currentTitle}
      </span>
      
      {/* Progress count */}
      <span className="text-muted-foreground/60 tabular-nums">
        {summary.completed}/{summary.total}
      </span>
    </div>
  );
}

export default UnifiedTimeline;


