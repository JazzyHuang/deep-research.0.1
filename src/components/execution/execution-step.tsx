'use client';

import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StepIcon } from './step-icon';
import { StepStatus, getStatusConfig } from './step-status';
import { StepDetail } from './step-detail';
import type { AgentStep } from '@/types/research';

interface ExecutionStepProps {
  step: AgentStep;
  depth?: number;
  isLast?: boolean;
  children?: React.ReactNode;
  onToggle?: (stepId: string) => void;
}

export const ExecutionStep = memo(function ExecutionStep({
  step,
  depth = 0,
  isLast = false,
  children,
  onToggle,
}: ExecutionStepProps) {
  const statusConfig = getStatusConfig(step.status);
  const hasChildren = step.children.length > 0;
  const isExpanded = !step.collapsed;

  const handleToggle = () => {
    onToggle?.(step.id);
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return null;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div 
      className={cn(
        'relative',
        depth > 0 && 'ml-6'
      )}
    >
      {/* Vertical connecting line for nested items */}
      {depth > 0 && (
        <div 
          className={cn(
            'absolute left-[-16px] top-0 w-px bg-border',
            isLast ? 'h-5' : 'h-full'
          )}
        />
      )}
      
      {/* Horizontal connecting line for nested items */}
      {depth > 0 && (
        <div className="absolute left-[-16px] top-5 w-4 h-px bg-border" />
      )}

      <Collapsible open={isExpanded} onOpenChange={handleToggle}>
        {/* Step Header */}
        <div
          className={cn(
            'group relative rounded-lg border transition-all duration-200',
            'hover:border-primary/30 hover:shadow-sm',
            statusConfig.bgClassName,
            step.status === 'running' && 'shadow-md shadow-primary/10'
          )}
        >
          <CollapsibleTrigger asChild>
            <button
              className="w-full flex items-center gap-3 p-3 text-left"
              aria-expanded={isExpanded}
            >
              {/* Expand/Collapse indicator */}
              <ChevronRight
                className={cn(
                  'w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0',
                  isExpanded && 'rotate-90'
                )}
              />

              {/* Step Icon */}
              <div
                className={cn(
                  'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                  'bg-background/80 border shadow-sm',
                  step.status === 'running' && 'border-primary/50'
                )}
              >
                <StepIcon type={step.type} size="md" />
              </div>

              {/* Step Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {step.title}
                  </span>
                  <StepStatus status={step.status} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground font-mono">
                    {step.name}
                  </span>
                  {step.duration && (
                    <span className="text-xs text-muted-foreground">
                      • {formatDuration(step.duration)}
                    </span>
                  )}
                </div>
              </div>

              {/* Children indicator */}
              {hasChildren && (
                <div className="flex-shrink-0 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {step.children.length} step{step.children.length !== 1 ? 's' : ''}
                </div>
              )}
            </button>
          </CollapsibleTrigger>

          {/* Expanded Content */}
          <CollapsibleContent>
            <div className="border-t border-border/50 px-3">
              <StepDetail step={step} />
            </div>
          </CollapsibleContent>
        </div>

        {/* Child Steps */}
        {hasChildren && children && (
          <div className="mt-2">
            {children}
          </div>
        )}
      </Collapsible>
    </div>
  );
});









