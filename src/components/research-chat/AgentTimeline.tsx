'use client';

import { useState, useCallback } from 'react';
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
} from 'lucide-react';
import type { AgentProgress, AgentStep, StepStatus } from '@/types/conversation';
import { cn } from '@/lib/utils';

interface AgentTimelineProps {
  progress: AgentProgress;
  className?: string;
}

// Step type icons
const STEP_ICONS: Record<string, React.ReactNode> = {
  thinking: <Brain className="w-3.5 h-3.5" />,
  planning: <Brain className="w-3.5 h-3.5" />,
  search: <Search className="w-3.5 h-3.5" />,
  searching: <Search className="w-3.5 h-3.5" />,
  analyzing: <BarChart3 className="w-3.5 h-3.5" />,
  analysis: <BarChart3 className="w-3.5 h-3.5" />,
  writing: <PenLine className="w-3.5 h-3.5" />,
  reviewing: <FileText className="w-3.5 h-3.5" />,
  validation: <Check className="w-3.5 h-3.5" />,
  default: <Sparkles className="w-3.5 h-3.5" />,
};

function getStepIcon(stepName: string): React.ReactNode {
  const normalizedName = stepName.toLowerCase();
  for (const [key, icon] of Object.entries(STEP_ICONS)) {
    if (normalizedName.includes(key)) {
      return icon;
    }
  }
  return STEP_ICONS.default;
}

/**
 * AgentTimeline - Cursor 2.0 style compact execution timeline
 * Enhanced with better visual feedback and expandable details
 */
export function AgentTimeline({ progress, className }: AgentTimelineProps) {
  const [isCollapsed, setIsCollapsed] = useState(progress.isCollapsed);
  
  const runningSteps = progress.steps.filter(s => s.status === 'running');
  const completedSteps = progress.steps.filter(s => s.status === 'success');
  const hasError = progress.steps.some(s => s.status === 'error');
  const totalDuration = progress.steps.reduce((acc, s) => acc + (s.duration || 0), 0);
  
  return (
    <div className={cn("py-3 message-enter", className)}>
      {/* Compact Cursor-style timeline container */}
      <div className="rounded-xl bg-muted/30 border border-border overflow-hidden shadow-sm">
        {/* Header - Collapsible */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/50 transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
          
          {/* Status indicator */}
          {runningSteps.length > 0 ? (
            <>
              <span className="text-primary">
                {getStepIcon(runningSteps[0].name)}
              </span>
              <span className="text-sm font-medium text-foreground truncate flex-1 text-left">
                {runningSteps[0].title}
              </span>
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />
            </>
          ) : hasError ? (
            <>
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <span className="text-sm font-medium text-destructive flex-1 text-left">
                执行出错
              </span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium text-foreground flex-1 text-left">
                已完成 {completedSteps.length} 个步骤
              </span>
            </>
          )}
          
          {/* Progress counter and duration */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {totalDuration > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(totalDuration)}
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded bg-muted">
              {completedSteps.length}/{progress.steps.length}
            </span>
          </div>
        </button>
        
        {/* Steps list - Enhanced Cursor style */}
        {!isCollapsed && (
          <div className="px-4 pb-3 space-y-1 border-t border-border/50">
            {progress.steps.map((step, index) => (
              <EnhancedTimelineStep
                key={step.id}
                step={step}
                isLast={index === progress.steps.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface EnhancedTimelineStepProps {
  step: AgentStep;
  isLast: boolean;
}

/**
 * EnhancedTimelineStep - Step with expandable details
 */
function EnhancedTimelineStep({ step, isLast }: EnhancedTimelineStepProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = step.children && step.children.length > 0;
  const hasDetails = step.summary || (hasChildren);
  
  return (
    <div className="pt-2">
      {/* Main step row */}
      <div 
        className={cn(
          "flex items-center gap-2 py-1.5 rounded-lg px-2 -mx-2 transition-colors",
          hasDetails && "cursor-pointer hover:bg-muted/50",
          step.status === 'running' && "bg-primary/5"
        )}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {/* Status indicator */}
        <div className={cn(
          "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
          step.status === 'running' && "bg-primary/20 text-primary",
          step.status === 'success' && "bg-primary/10 text-primary",
          step.status === 'error' && "bg-destructive/10 text-destructive",
          step.status === 'pending' && "bg-muted text-muted-foreground",
          step.status === 'skipped' && "bg-muted text-muted-foreground opacity-50"
        )}>
          {step.status === 'running' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : step.status === 'success' ? (
            <Check className="w-3 h-3" />
          ) : step.status === 'error' ? (
            <AlertCircle className="w-3 h-3" />
          ) : (
            getStepIcon(step.name)
          )}
        </div>
        
        {/* Expand button for items with details */}
        {hasDetails && (
          <div className="flex-shrink-0 w-4">
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        )}
        
        {/* Step title */}
        <span className={cn(
          "flex-1 text-sm truncate",
          step.status === 'running' && "text-foreground font-medium",
          step.status === 'success' && "text-foreground",
          step.status === 'error' && "text-destructive",
          step.status === 'pending' && "text-muted-foreground",
          step.status === 'skipped' && "text-muted-foreground line-through"
        )}>
          {step.title}
        </span>
        
        {/* Duration */}
        {step.duration !== undefined && step.duration > 0 && (
          <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
            {formatDuration(step.duration)}
          </span>
        )}
      </div>
      
      {/* Expanded details */}
      {expanded && (
        <div className="ml-7 mt-1 space-y-2">
          {/* Summary */}
          {step.summary && (
            <p className="text-xs text-muted-foreground leading-relaxed pl-4 border-l-2 border-muted">
              {step.summary}
            </p>
          )}
          
          {/* Children steps */}
          {hasChildren && (
            <div className="space-y-0.5 pl-2 border-l border-border">
              {step.children!.map((child, i) => (
                <EnhancedTimelineStep
                  key={child.id}
                  step={child}
                  isLast={i === step.children!.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Vertical line connector (if not last and not expanded) */}
      {!isLast && !expanded && (
        <div className="ml-[9px] h-1 w-0.5 bg-border" />
      )}
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
