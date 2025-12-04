'use client';

import { useState, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Check, 
  Loader2, 
  AlertCircle,
  Clock,
  FileText,
  Search,
  Brain,
  Sparkles,
  BarChart3,
  PenLine,
  Zap,
} from 'lucide-react';
import type { AgentProgress, AgentStep, StepStatus } from '@/types/conversation';
import { cn } from '@/lib/utils';

interface AgentTimelineProps {
  progress: AgentProgress;
  className?: string;
  /** Position mode - 'inline' shows in chat flow, 'header' shows as compact header */
  mode?: 'inline' | 'compact';
}

// Step type icons
const STEP_ICONS: Record<string, React.ReactNode> = {
  thinking: <Brain className="w-3.5 h-3.5" />,
  planning: <Brain className="w-3.5 h-3.5" />,
  plan: <Brain className="w-3.5 h-3.5" />,
  search: <Search className="w-3.5 h-3.5" />,
  searching: <Search className="w-3.5 h-3.5" />,
  retrieval: <Search className="w-3.5 h-3.5" />,
  analyzing: <BarChart3 className="w-3.5 h-3.5" />,
  analysis: <BarChart3 className="w-3.5 h-3.5" />,
  analyze: <BarChart3 className="w-3.5 h-3.5" />,
  writing: <PenLine className="w-3.5 h-3.5" />,
  write: <PenLine className="w-3.5 h-3.5" />,
  synthesize: <PenLine className="w-3.5 h-3.5" />,
  reviewing: <FileText className="w-3.5 h-3.5" />,
  review: <FileText className="w-3.5 h-3.5" />,
  validation: <Check className="w-3.5 h-3.5" />,
  quality: <BarChart3 className="w-3.5 h-3.5" />,
  default: <Sparkles className="w-3.5 h-3.5" />,
};

function getStepIcon(stepName: string): React.ReactNode {
  const normalizedName = stepName.toLowerCase();
  for (const [key, icon] of Object.entries(STEP_ICONS)) {
    if (key !== 'default' && normalizedName.includes(key)) {
      return icon;
    }
  }
  return STEP_ICONS.default;
}

/**
 * AgentTimeline - Redesigned vertical execution timeline
 * 
 * Features:
 * - Clean vertical timeline with animated transitions
 * - Collapsible with smart auto-expand for running steps
 * - Shows current step prominently
 * - Smooth animations for step status changes
 */
export function AgentTimeline({ progress, className, mode = 'inline' }: AgentTimelineProps) {
  const [isCollapsed, setIsCollapsed] = useState(progress.isCollapsed);
  
  const runningSteps = progress.steps.filter(s => s.status === 'running');
  const completedSteps = progress.steps.filter(s => s.status === 'success');
  const hasError = progress.steps.some(s => s.status === 'error');
  const totalDuration = progress.steps.reduce((acc, s) => acc + (s.duration || 0), 0);
  
  // Auto-expand when a step starts running
  useEffect(() => {
    if (runningSteps.length > 0 && isCollapsed) {
      setIsCollapsed(false);
    }
  }, [runningSteps.length]);
  
  // Compact mode - single line summary
  if (mode === 'compact') {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        {runningSteps.length > 0 ? (
          <>
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="text-foreground">{runningSteps[0].title}</span>
          </>
        ) : hasError ? (
          <>
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-destructive">执行出错</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">
              已完成 {completedSteps.length} 个步骤
            </span>
          </>
        )}
      </div>
    );
  }
  
  return (
    <div className={cn(
      "rounded-xl border border-border/50 bg-card/50 overflow-hidden",
      "timeline-enter",
      className
    )}>
      {/* Collapsible Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3",
          "hover:bg-muted/30 transition-colors"
        )}
      >
        {/* Expand/Collapse icon */}
        <div className="text-muted-foreground/60">
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {runningSteps.length > 0 ? (
            <>
              <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
              <span className="text-sm font-medium text-foreground truncate">
                {runningSteps[0].title}
              </span>
            </>
          ) : hasError ? (
            <>
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <span className="text-sm font-medium text-destructive">
                执行出错
              </span>
            </>
          ) : (
            <>
              <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">
                已完成 {completedSteps.length} 个步骤
              </span>
            </>
          )}
        </div>
        
        {/* Progress and duration */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground/60 flex-shrink-0">
          {totalDuration > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(totalDuration)}
            </span>
          )}
          <span className="tabular-nums px-1.5 py-0.5 rounded bg-muted/50">
            {completedSteps.length}/{progress.steps.length}
          </span>
        </div>
      </button>
      
      {/* Expanded Timeline */}
      {!isCollapsed && (
        <div className="px-4 pb-4 pt-1 animate-collapsible-down">
          <div className="timeline-vertical">
            {progress.steps.map((step, index) => (
              <TimelineStep
                key={step.id}
                step={step}
                isLast={index === progress.steps.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface TimelineStepProps {
  step: AgentStep;
  isLast: boolean;
}

/**
 * TimelineStep - Individual step on the vertical timeline
 */
function TimelineStep({ step, isLast }: TimelineStepProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = step.children && step.children.length > 0;
  const hasDetails = step.summary || hasChildren;
  
  return (
    <div className={cn(
      "timeline-step relative pl-7",
      !isLast && "pb-4"
    )}>
      {/* Vertical line */}
      {!isLast && (
        <div className={cn(
          "absolute left-[7px] top-5 bottom-0 w-0.5 rounded-full",
          step.status === 'success' ? "bg-primary/30" : "bg-border"
        )} />
      )}
      
      {/* Step dot/icon */}
      <div className={cn(
        "absolute left-0 w-4 h-4 rounded-full flex items-center justify-center",
        "border-2 bg-background transition-all duration-300",
        step.status === 'running' && "border-primary step-dot-pulse",
        step.status === 'success' && "border-primary bg-primary",
        step.status === 'error' && "border-destructive bg-destructive/10",
        step.status === 'pending' && "border-muted-foreground/30",
        step.status === 'skipped' && "border-muted-foreground/20 bg-muted"
      )}>
        {step.status === 'running' ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />
        ) : step.status === 'success' ? (
          <Check className="w-2.5 h-2.5 text-primary-foreground" />
        ) : step.status === 'error' ? (
          <AlertCircle className="w-2.5 h-2.5 text-destructive" />
        ) : null}
      </div>
      
      {/* Step content */}
      <div 
        className={cn(
          "min-h-[20px]",
          hasDetails && "cursor-pointer"
        )}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {/* Step header */}
        <div className="flex items-center gap-2">
          {/* Expand indicator */}
          {hasDetails && (
            <div className="text-muted-foreground/40">
              {expanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </div>
          )}
          
          {/* Step icon */}
          <div className={cn(
            "flex-shrink-0",
            step.status === 'running' && "text-primary",
            step.status === 'success' && "text-primary/60",
            step.status === 'error' && "text-destructive",
            step.status === 'pending' && "text-muted-foreground/40",
            step.status === 'skipped' && "text-muted-foreground/30"
          )}>
            {getStepIcon(step.name)}
          </div>
          
          {/* Step title */}
          <span className={cn(
            "text-sm flex-1",
            step.status === 'running' && "text-foreground font-medium",
            step.status === 'success' && "text-muted-foreground",
            step.status === 'error' && "text-destructive",
            step.status === 'pending' && "text-muted-foreground/50",
            step.status === 'skipped' && "text-muted-foreground/40 line-through"
          )}>
            {step.title}
          </span>
          
          {/* Duration */}
          {step.duration !== undefined && step.duration > 0 && (
            <span className="text-[10px] text-muted-foreground/40 tabular-nums flex-shrink-0">
              {formatDuration(step.duration)}
            </span>
          )}
        </div>
        
        {/* Expanded details */}
        {expanded && (
          <div className="mt-2 ml-5 space-y-2 animate-collapsible-down">
            {/* Summary */}
            {step.summary && (
              <p className="text-xs text-muted-foreground/60 leading-relaxed">
                {step.summary}
              </p>
            )}
            
            {/* Children steps (nested timeline) */}
            {hasChildren && (
              <div className="timeline-vertical mt-2">
                {step.children!.map((child, i) => (
                  <TimelineStep
                    key={child.id}
                    step={child}
                    isLast={i === step.children!.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export default AgentTimeline;
