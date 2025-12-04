'use client';

import { useState, useEffect } from 'react';
import { 
  Check, 
  Loader2, 
  AlertCircle,
  ChevronRight,
  Brain,
  Search,
  BarChart3,
  PenLine,
  FileText,
  Sparkles,
} from 'lucide-react';
import type { AgentStep, StepStatus } from '@/types/conversation';
import { cn } from '@/lib/utils';

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

interface AgentStepInlineProps {
  step: AgentStep;
  isLast?: boolean;
  showConnector?: boolean;
  className?: string;
}

/**
 * AgentStepInline - Single step in the stream timeline
 * 
 * Features:
 * - Minimal inline design without card wrapper
 * - Connected vertical timeline
 * - Expandable details on click
 * - Subtle animations
 */
export function AgentStepInline({ 
  step, 
  isLast = false,
  showConnector = true,
  className 
}: AgentStepInlineProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = step.summary || (step.details && Object.keys(step.details).length > 0);
  
  return (
    <div 
      className={cn(
        "stream-step relative pl-7",
        !isLast && showConnector && "pb-3",
        className
      )}
    >
      {/* Vertical connector line */}
      {!isLast && showConnector && (
        <div className={cn(
          "absolute left-[9px] top-5 bottom-0 w-0.5 rounded-full",
          "transition-all duration-500",
          step.status === 'success' 
            ? "bg-gradient-to-b from-primary/50 to-primary/10" 
            : step.status === 'running'
            ? "bg-gradient-to-b from-primary/40 to-transparent"
            : "bg-border/40"
        )} />
      )}
      
      {/* Step indicator dot */}
      <div className={cn(
        "absolute left-0 w-5 h-5 rounded-full flex items-center justify-center",
        "transition-all duration-300",
        step.status === 'running' && [
          "bg-primary/10 border-2 border-primary",
          "stream-step-pulse"
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
            "flex-shrink-0 transition-colors",
            step.status === 'running' && "text-primary",
            step.status === 'success' && "text-muted-foreground/60",
            step.status === 'error' && "text-destructive",
            step.status === 'pending' && "text-muted-foreground/30",
            step.status === 'skipped' && "text-muted-foreground/20"
          )}>
            {getStepIcon(step.name)}
          </div>
          
          {/* Step title */}
          <span className={cn(
            "text-sm flex-1 transition-colors",
            step.status === 'running' && "text-foreground font-medium",
            step.status === 'success' && "text-muted-foreground/70",
            step.status === 'error' && "text-destructive font-medium",
            step.status === 'pending' && "text-muted-foreground/40",
            step.status === 'skipped' && "text-muted-foreground/30 line-through"
          )}>
            {step.title}
          </span>
          
          {/* Duration badge */}
          {step.duration !== undefined && step.duration > 0 && (
            <span className={cn(
              "text-[10px] tabular-nums flex-shrink-0",
              "text-muted-foreground/40"
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
        {expanded && hasDetails && (
          <div className="mt-2 ml-5 space-y-2 animate-collapsible-down">
            {/* Summary */}
            {step.summary && (
              <p className="text-xs text-muted-foreground/60 leading-relaxed pl-2 border-l-2 border-border/50">
                {step.summary}
              </p>
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

// ============================================================================
// AgentStepsGroup - Groups multiple steps with shared timeline
// ============================================================================

interface AgentStepsGroupProps {
  steps: AgentStep[];
  className?: string;
}

/**
 * AgentStepsGroup - Renders a group of agent steps with connected timeline
 * Used to display multiple steps that occur between cards
 */
export function AgentStepsGroup({ steps, className }: AgentStepsGroupProps) {
  if (steps.length === 0) return null;
  
  return (
    <div className={cn("stream-steps-group py-2", className)}>
      {steps.map((step, index) => (
        <AgentStepInline
          key={step.id}
          step={step}
          isLast={index === steps.length - 1}
          showConnector={true}
        />
      ))}
    </div>
  );
}

export default AgentStepInline;



