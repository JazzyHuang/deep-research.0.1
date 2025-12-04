'use client';

import { useState, useMemo } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Check, 
  Loader2, 
  AlertCircle,
  Brain,
  Search,
  BarChart3,
  PenLine,
  FileCheck,
  Shield,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentEventData, AgentEventMetaData } from '@/types/ui-message';

// ============================================================================
// Types
// ============================================================================

type StageType = AgentEventData['stage'];
type StatusType = AgentEventData['status'];

interface StageGroupProps {
  stage: StageType;
  events: AgentEventData[];
  isActive: boolean;
  locale?: 'en' | 'zh';
  className?: string;
}

interface EventItemProps {
  event: AgentEventData;
  isLast: boolean;
  locale: 'en' | 'zh';
}

// ============================================================================
// Stage Configuration
// ============================================================================

interface StageConfig {
  titleEn: string;
  titleZh: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
}

const STAGE_CONFIGS: Record<StageType, StageConfig> = {
  planning: {
    titleEn: 'Planning',
    titleZh: '规划研究',
    icon: <Brain className="w-4 h-4" />,
    colorClass: 'text-violet-500',
    bgClass: 'bg-violet-500/10',
  },
  searching: {
    titleEn: 'Literature Search',
    titleZh: '文献检索',
    icon: <Search className="w-4 h-4" />,
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-500/10',
  },
  analyzing: {
    titleEn: 'Analysis',
    titleZh: '分析论文',
    icon: <BarChart3 className="w-4 h-4" />,
    colorClass: 'text-purple-500',
    bgClass: 'bg-purple-500/10',
  },
  writing: {
    titleEn: 'Writing',
    titleZh: '撰写报告',
    icon: <PenLine className="w-4 h-4" />,
    colorClass: 'text-emerald-500',
    bgClass: 'bg-emerald-500/10',
  },
  reviewing: {
    titleEn: 'Quality Review',
    titleZh: '质量评审',
    icon: <FileCheck className="w-4 h-4" />,
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-500/10',
  },
  validating: {
    titleEn: 'Validation',
    titleZh: '验证引用',
    icon: <Shield className="w-4 h-4" />,
    colorClass: 'text-teal-500',
    bgClass: 'bg-teal-500/10',
  },
  complete: {
    titleEn: 'Complete',
    titleZh: '完成',
    icon: <CheckCircle className="w-4 h-4" />,
    colorClass: 'text-green-500',
    bgClass: 'bg-green-500/10',
  },
  error: {
    titleEn: 'Error',
    titleZh: '错误',
    icon: <AlertTriangle className="w-4 h-4" />,
    colorClass: 'text-red-500',
    bgClass: 'bg-red-500/10',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getStageTitle(stage: StageType, locale: 'en' | 'zh'): string {
  const config = STAGE_CONFIGS[stage];
  return locale === 'zh' ? config.titleZh : config.titleEn;
}

function getEventTitle(event: AgentEventData, locale: 'en' | 'zh'): string {
  return locale === 'zh' ? event.titleZh : event.titleEn;
}

function formatMetaSummary(meta: AgentEventMetaData | undefined, locale: 'en' | 'zh'): string | null {
  if (!meta) return null;
  
  const parts: string[] = [];
  
  if (meta.summary) {
    return meta.summary;
  }
  
  if (meta.query) {
    const truncatedQuery = meta.query.length > 40 ? meta.query.slice(0, 37) + '...' : meta.query;
    parts.push(`"${truncatedQuery}"`);
  }
  
  if (meta.paperCount !== undefined) {
    parts.push(locale === 'zh' ? `${meta.paperCount} 篇` : `${meta.paperCount} papers`);
  }
  
  if (meta.newPaperCount !== undefined && meta.newPaperCount > 0) {
    parts.push(locale === 'zh' ? `+${meta.newPaperCount} 新` : `+${meta.newPaperCount} new`);
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
  
  return parts.length > 0 ? parts.join(' · ') : null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function getStatusIcon(status: StatusType) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3 h-3 animate-spin" />;
    case 'success':
      return <Check className="w-3 h-3" strokeWidth={3} />;
    case 'error':
      return <AlertCircle className="w-3 h-3" />;
    default:
      return null;
  }
}

// ============================================================================
// EventItem Component
// ============================================================================

function EventItem({ event, isLast, locale }: EventItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const metaSummary = formatMetaSummary(event.meta, locale);
  const hasDetails = !!event.meta?.query || !!event.meta?.sourceBreakdown;
  
  // Format iteration display
  const iterationText = event.iteration !== undefined
    ? event.totalIterations !== undefined
      ? `${event.iteration}/${event.totalIterations}`
      : `#${event.iteration}`
    : null;
  
  return (
    <div className={cn("relative pl-6", !isLast && "pb-3")}>
      {/* Vertical connector line */}
      {!isLast && (
        <div className={cn(
          "absolute left-[7px] top-4 bottom-0 w-0.5 rounded-full",
          event.status === 'success' 
            ? "bg-gradient-to-b from-primary/40 to-primary/10" 
            : event.status === 'running'
            ? "bg-gradient-to-b from-primary/30 to-transparent"
            : "bg-border/40"
        )} />
      )}
      
      {/* Status dot */}
      <div className={cn(
        "absolute left-0 w-4 h-4 rounded-full flex items-center justify-center",
        "transition-all duration-300",
        event.status === 'running' && "bg-primary/10 border-2 border-primary animate-pulse",
        event.status === 'success' && "bg-primary border-2 border-primary",
        event.status === 'error' && "bg-destructive/10 border-2 border-destructive",
        event.status === 'pending' && "bg-muted border-2 border-muted-foreground/20",
      )}>
        <span className={cn(
          event.status === 'running' && "text-primary",
          event.status === 'success' && "text-primary-foreground",
          event.status === 'error' && "text-destructive",
        )}>
          {getStatusIcon(event.status)}
        </span>
      </div>
      
      {/* Event content */}
      <div 
        className={cn(
          "min-h-[16px] group",
          hasDetails && "cursor-pointer"
        )}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        {/* Event header */}
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm flex-1 transition-colors",
            event.status === 'running' && "text-foreground font-medium",
            event.status === 'success' && "text-muted-foreground",
            event.status === 'error' && "text-destructive font-medium",
            event.status === 'pending' && "text-muted-foreground/50",
          )}>
            {getEventTitle(event, locale)}
          </span>
          
          {/* Iteration badge */}
          {iterationText && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground tabular-nums">
              {iterationText}
            </span>
          )}
          
          {/* Duration */}
          {event.duration !== undefined && event.duration > 0 && (
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">
              {formatDuration(event.duration)}
            </span>
          )}
          
          {/* Expand indicator */}
          {hasDetails && (
            <div className={cn(
              "transition-transform duration-200",
              "text-muted-foreground/30 group-hover:text-muted-foreground/60",
              isExpanded && "rotate-90"
            )}>
              <ChevronRight className="w-3 h-3" />
            </div>
          )}
        </div>
        
        {/* Meta summary */}
        {metaSummary && !isExpanded && (
          <p className="text-xs text-muted-foreground/60 mt-0.5 truncate">
            {metaSummary}
          </p>
        )}
        
        {/* Expanded details */}
        {isExpanded && event.meta && (
          <div className="mt-2 ml-1 space-y-1.5 text-xs text-muted-foreground/70 border-l-2 border-border/50 pl-2">
            {event.meta.query && (
              <div>
                <span className="text-muted-foreground/50">Query: </span>
                <span className="font-mono">{event.meta.query}</span>
              </div>
            )}
            {event.meta.sourceBreakdown && Object.keys(event.meta.sourceBreakdown).length > 0 && (
              <div>
                <span className="text-muted-foreground/50">Sources: </span>
                {Object.entries(event.meta.sourceBreakdown).map(([source, count]) => (
                  <span key={source} className="mr-2">
                    {source}: {count}
                  </span>
                ))}
              </div>
            )}
            {event.meta.gapsFound !== undefined && event.meta.gapsFound > 0 && (
              <div>
                <span className="text-muted-foreground/50">
                  {locale === 'zh' ? '发现缺口: ' : 'Gaps found: '}
                </span>
                {event.meta.gapsFound}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// StageGroup Component
// ============================================================================

/**
 * StageGroup - Groups events by stage with collapsible header
 * 
 * Features:
 * - Collapsible stage header with progress summary
 * - Events grouped under each stage
 * - Visual progress indicator for multi-round operations
 * - i18n support for titles
 */
export function StageGroup({ 
  stage, 
  events, 
  isActive, 
  locale = 'zh',
  className 
}: StageGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const config = STAGE_CONFIGS[stage];
  
  // Calculate stage summary
  const summary = useMemo(() => {
    const completed = events.filter(e => e.status === 'success').length;
    const running = events.filter(e => e.status === 'running').length;
    const total = events.length;
    
    // Get the running event title for display
    const runningEvent = events.find(e => e.status === 'running');
    const runningTitle = runningEvent 
      ? getEventTitle(runningEvent, locale)
      : null;
    
    // Calculate total duration
    const totalDuration = events.reduce((acc, e) => acc + (e.duration || 0), 0);
    
    // Get highest iteration if applicable
    const maxIteration = Math.max(...events.map(e => e.iteration || 0));
    const maxTotal = Math.max(...events.map(e => e.totalIterations || 0));
    
    return {
      completed,
      running,
      total,
      runningTitle,
      totalDuration,
      maxIteration: maxIteration > 0 ? maxIteration : undefined,
      maxTotal: maxTotal > 0 ? maxTotal : undefined,
      isComplete: completed === total && running === 0,
      hasError: events.some(e => e.status === 'error'),
    };
  }, [events, locale]);
  
  if (events.length === 0) return null;
  
  return (
    <div className={cn(
      "rounded-xl overflow-hidden",
      "border border-border/40",
      "bg-card/50 backdrop-blur-sm",
      "mb-3",
      className
    )}>
      {/* Stage Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5",
          "hover:bg-muted/30 transition-all duration-200"
        )}
      >
        {/* Expand/Collapse icon */}
        <div className={cn(
          "transition-transform duration-200",
          isExpanded && "rotate-90"
        )}>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
        </div>
        
        {/* Stage icon */}
        <div className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center",
          config.bgClass,
          config.colorClass
        )}>
          {summary.running > 0 ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : summary.hasError ? (
            <AlertCircle className="w-4 h-4" />
          ) : summary.isComplete ? (
            <Check className="w-4 h-4" />
          ) : (
            config.icon
          )}
        </div>
        
        {/* Stage title and status */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {getStageTitle(stage, locale)}
            </span>
            
            {/* Iteration indicator for multi-round stages */}
            {summary.maxIteration && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground tabular-nums">
                {summary.maxTotal 
                  ? `${summary.maxIteration}/${summary.maxTotal}`
                  : `Round ${summary.maxIteration}`
                }
              </span>
            )}
          </div>
          
          {/* Running status or summary */}
          {summary.runningTitle ? (
            <p className="text-xs text-muted-foreground truncate">
              {summary.runningTitle}...
            </p>
          ) : summary.isComplete && (
            <p className="text-xs text-muted-foreground/60">
              {locale === 'zh' 
                ? `完成 ${summary.completed} 个步骤`
                : `${summary.completed} steps completed`
              }
            </p>
          )}
        </div>
        
        {/* Progress indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
          {summary.totalDuration > 0 && (
            <span className="tabular-nums">
              {formatDuration(summary.totalDuration)}
            </span>
          )}
          <span className="tabular-nums px-1.5 py-0.5 rounded bg-muted/50">
            {summary.completed}/{summary.total}
          </span>
        </div>
      </button>
      
      {/* Expanded Events */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1">
          {events.map((event, index) => (
            <EventItem
              key={event.id}
              event={event}
              isLast={index === events.length - 1}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default StageGroup;


