'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Loader2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentStepData } from '@/types/ui-message';

interface FloatingProgressProps {
  steps: AgentStepData[];
  isActive: boolean;
  className?: string;
}

/**
 * FloatingProgress - Floating pill showing current step progress
 * 
 * Positioned near the bottom of the viewport, shows:
 * - Current step being executed
 * - Step X of Y progress
 * - Expandable to show recent steps
 */
export function FloatingProgress({ steps, isActive, className }: FloatingProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const completedSteps = steps.filter(s => s.status === 'success');
  const runningStep = steps.find(s => s.status === 'running');
  const errorStep = steps.find(s => s.status === 'error');
  const totalSteps = steps.length;
  
  // Don't show if no steps or not active and no completed steps
  if (totalSteps === 0 || (!isActive && completedSteps.length === 0)) {
    return null;
  }
  
  const currentStepNumber = completedSteps.length + (runningStep ? 1 : 0);
  const currentStepTitle = runningStep?.title || errorStep?.title || (completedSteps.length > 0 ? '已完成' : '准备中');
  
  // Recent steps for expanded view (last 5)
  const recentSteps = steps.slice(-5).reverse();
  
  return (
    <div className={cn(
      "fixed bottom-24 left-1/2 -translate-x-1/2 z-30",
      "transition-all duration-300 ease-out",
      className
    )}>
      {/* Expanded panel */}
      {isExpanded && (
        <div className="mb-2 w-80 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
          <div className="px-4 py-2 border-b border-border bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground">执行进度</span>
          </div>
          <div className="p-2 max-h-48 overflow-y-auto">
            {recentSteps.map((step) => (
              <div 
                key={step.id}
                className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
              >
                <div className="flex-shrink-0">
                  {step.status === 'success' ? (
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                  ) : step.status === 'running' ? (
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  ) : step.status === 'error' ? (
                    <div className="w-5 h-5 rounded-full bg-destructive/10 flex items-center justify-center">
                      <AlertCircle className="w-3 h-3 text-destructive" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm truncate",
                    step.status === 'running' && "text-foreground font-medium",
                    step.status === 'success' && "text-muted-foreground",
                    step.status === 'error' && "text-destructive",
                    step.status === 'pending' && "text-muted-foreground/50"
                  )}>
                    {step.title}
                  </p>
                </div>
                {step.duration !== undefined && step.duration > 0 && (
                  <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                    {formatDuration(step.duration)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Main pill */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-3 px-4 py-2 rounded-full",
          "bg-card border border-border shadow-lg",
          "hover:shadow-xl hover:border-primary/30 transition-all duration-200",
          "group"
        )}
      >
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {errorStep ? (
            <AlertCircle className="w-4 h-4 text-destructive" />
          ) : isActive && runningStep ? (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          ) : (
            <Check className="w-4 h-4 text-primary" />
          )}
          
          <span className={cn(
            "text-sm font-medium max-w-40 truncate",
            errorStep ? "text-destructive" : "text-foreground"
          )}>
            {currentStepTitle}
          </span>
        </div>
        
        {/* Progress count */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">
          <span className="tabular-nums">{currentStepNumber}</span>
          <span>/</span>
          <span className="tabular-nums">{totalSteps}</span>
        </div>
        
        {/* Expand icon */}
        <div className="text-muted-foreground group-hover:text-foreground transition-colors">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </div>
      </button>
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

export default FloatingProgress;




