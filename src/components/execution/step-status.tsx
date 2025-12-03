'use client';

import { Check, X, Clock, Loader2, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentStepStatus } from '@/types/research';

interface StepStatusProps {
  status: AgentStepStatus;
  className?: string;
  showLabel?: boolean;
}

const statusConfig: Record<AgentStepStatus, {
  icon: React.ReactNode;
  label: string;
  className: string;
  bgClassName: string;
}> = {
  waiting: {
    icon: <Clock className="w-3 h-3" />,
    label: 'Waiting',
    className: 'text-muted-foreground',
    bgClassName: 'bg-muted/50 border-dashed',
  },
  running: {
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    label: 'Running',
    className: 'text-primary',
    bgClassName: 'bg-primary/10 border-primary/30 animate-pulse',
  },
  success: {
    icon: <Check className="w-3 h-3" />,
    label: 'Success',
    className: 'text-emerald-500 dark:text-emerald-400',
    bgClassName: 'bg-emerald-500/10 border-emerald-500/30',
  },
  error: {
    icon: <X className="w-3 h-3" />,
    label: 'Error',
    className: 'text-destructive',
    bgClassName: 'bg-destructive/10 border-destructive/30',
  },
  skipped: {
    icon: <MinusCircle className="w-3 h-3" />,
    label: 'Skipped',
    className: 'text-muted-foreground line-through',
    bgClassName: 'bg-muted/30 border-muted',
  },
};

export function StepStatus({ status, className, showLabel = false }: StepStatusProps) {
  const config = statusConfig[status];
  
  return (
    <div className={cn('flex items-center gap-1.5', config.className, className)}>
      {config.icon}
      {showLabel && (
        <span className="text-xs font-medium">{config.label}</span>
      )}
    </div>
  );
}

export function StepStatusBadge({ status, className }: StepStatusProps) {
  const config = statusConfig[status];
  
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        config.bgClassName,
        config.className,
        className
      )}
    >
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
}

export function getStatusConfig(status: AgentStepStatus) {
  return statusConfig[status];
}









