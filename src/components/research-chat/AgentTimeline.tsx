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
  CircleDot,
} from 'lucide-react';
import type { AgentProgress, AgentStep, StepStatus } from '@/types/conversation';
import { cn } from '@/lib/utils';

interface AgentTimelineProps {
  progress: AgentProgress;
  className?: string;
  /** Position mode - 'inline' shows in chat flow, 'header' shows as compact header */
  mode?: 'inline' | 'compact';
}

// Step type icons with consistent sizing
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
 * AgentTimeline - Modern vertical execution timeline
 * 
 * Features:
 * - Glassmorphism design with smooth animations
 * - Connected step visualization with gradient lines
 * - Smart auto-expand for running steps
 * - Refined typography and spacing
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
  }, [runningSteps.length, isCollapsed]);
  
  // Compact mode - minimal pill summary
  if (mode === 'compact') {
    return (
      <div className={cn(
        "inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full",
        "bg-muted/30 border border-border/50",
        "text-sm",
        className
      )}>
        {runningSteps.length > 0 ? (
          <>
            <div className="relative">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            </div>
            <span className="text-foreground font-medium">{runningSteps[0].title}</span>
          </>
        ) : hasError ? (
          <>
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-destructive font-medium">执行出错</span>
          </>
        ) : (
          <>
            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-primary" />
            </div>
            <span className="text-muted-foreground">
              {completedSteps.length} 步骤完成
            </span>
          </>
        )}
      </div>
    );
  }
  
  return (
    <div className={cn(
      "rounded-2xl overflow-hidden",
      "border border-border/40",
      "bg-card/50 backdrop-blur-sm",
      "timeline-enter",
      className
    )}>
      {/* Collapsible Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3.5",
          "hover:bg-muted/30 transition-all duration-200"
        )}
      >
        {/* Expand/Collapse icon */}
        <div className={cn(
          "transition-transform duration-300",
          !isCollapsed && "rotate-90"
        )}>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {runningSteps.length > 0 ? (
            <>
              <div className="relative flex-shrink-0">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-ping" />
              </div>
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground truncate block">
                  {runningSteps[0].title}
                </span>
                {runningSteps.length > 1 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{runningSteps.length - 1} 并行
                  </span>
                )}
              </div>
            </>
          ) : hasError ? (
            <>
              <div className="w-6 h-6 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-3.5 h-3.5 text-destructive" />
              </div>
              <span className="text-sm font-medium text-destructive">
                执行出错
              </span>
            </>
          ) : (
            <>
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Check className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">
                已完成 {completedSteps.length} 个步骤
              </span>
            </>
          )}
        </div>
        
        {/* Progress and duration */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground/60 flex-shrink-0">
          {totalDuration > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/30">
              <Clock className="w-3 h-3" />
              {formatDuration(totalDuration)}
            </span>
          )}
          <span className="tabular-nums px-2 py-0.5 rounded-md bg-muted/50 font-medium">
            {completedSteps.length}/{progress.steps.length}
          </span>
        </div>
      </button>
      
      {/* Expanded Timeline */}
      {!isCollapsed && (
        <div className="px-4 pb-4 pt-1 animate-collapsible-down">
          <div className="timeline-vertical pl-2">
            {progress.steps.map((step, index) => (
              <TimelineStep
                key={step.id}
                step={step}
                index={index}
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
  index: number;
  isLast: boolean;
}

/**
 * TimelineStep - Individual step on the vertical timeline
 * Redesigned with gradient lines and refined animations
 */
function TimelineStep({ step, index, isLast }: TimelineStepProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = step.children && step.children.length > 0;
  const hasDetails = step.summary || hasChildren;
  
  return (
    <div 
      className={cn(
        "timeline-step relative pl-8",
        !isLast && "pb-5"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Vertical connector line */}
      {!isLast && (
        <div className={cn(
          "absolute left-[9px] top-6 bottom-0 w-0.5 rounded-full",
          "transition-all duration-500",
          step.status === 'success' 
            ? "bg-gradient-to-b from-primary/60 to-primary/20" 
            : "bg-border/50"
        )} />
      )}
      
      {/* Step dot */}
      <div className={cn(
        "absolute left-0 w-5 h-5 rounded-full flex items-center justify-center",
        "transition-all duration-300",
        step.status === 'running' && [
          "bg-primary/10 border-2 border-primary",
          "step-dot-pulse"
        ],
        step.status === 'success' && "bg-primary border-2 border-primary",
        step.status === 'error' && "bg-destructive/10 border-2 border-destructive",
        step.status === 'pending' && "bg-muted border-2 border-muted-foreground/20",
        step.status === 'skipped' && "bg-muted/50 border-2 border-muted-foreground/10"
      )}>
        {step.status === 'running' ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin text-primary" />
        ) : step.status === 'success' ? (
          <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
        ) : step.status === 'error' ? (
          <AlertCircle className="w-2.5 h-2.5 text-destructive" />
        ) : step.status === 'pending' ? (
          <CircleDot className="w-2.5 h-2.5 text-muted-foreground/40" />
        ) : null}
      </div>
      
      {/* Step content */}
      <div 
        className={cn(
          "min-h-[20px] group",
          hasDetails && "cursor-pointer"
        )}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {/* Step header */}
        <div className="flex items-center gap-2">
          {/* Step icon */}
          <div className={cn(
            "flex-shrink-0 p-1 rounded-md transition-colors",
            step.status === 'running' && "text-primary bg-primary/5",
            step.status === 'success' && "text-primary/50",
            step.status === 'error' && "text-destructive bg-destructive/5",
            step.status === 'pending' && "text-muted-foreground/30",
            step.status === 'skipped' && "text-muted-foreground/20"
          )}>
            {getStepIcon(step.name)}
          </div>
          
          {/* Step title */}
          <span className={cn(
            "text-sm flex-1 transition-colors",
            step.status === 'running' && "text-foreground font-medium",
            step.status === 'success' && "text-foreground/70",
            step.status === 'error' && "text-destructive font-medium",
            step.status === 'pending' && "text-muted-foreground/50",
            step.status === 'skipped' && "text-muted-foreground/40 line-through"
          )}>
            {step.title}
          </span>
          
          {/* Duration badge */}
          {step.duration !== undefined && step.duration > 0 && (
            <span className={cn(
              "text-[10px] tabular-nums flex-shrink-0",
              "px-1.5 py-0.5 rounded-md",
              "bg-muted/50 text-muted-foreground/50"
            )}>
              {formatDuration(step.duration)}
            </span>
          )}
          
          {/* Expand indicator */}
          {hasDetails && (
            <div className={cn(
              "transition-all duration-200",
              "text-muted-foreground/30 group-hover:text-muted-foreground/60",
              expanded && "rotate-90"
            )}>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
        
        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 ml-7 space-y-3 animate-collapsible-down">
            {/* Summary */}
            {step.summary && (
              <p className="text-xs text-muted-foreground/60 leading-relaxed pl-1 border-l-2 border-border/50">
                {step.summary}
              </p>
            )}
            
            {/* Children steps (nested timeline) */}
            {hasChildren && (
              <div className="timeline-vertical">
                {step.children!.map((child, i) => (
                  <TimelineStep
                    key={child.id}
                    step={child}
                    index={i}
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
