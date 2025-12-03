'use client';

import { useMemo } from 'react';
import { 
  ChevronsDownUp, 
  ChevronsUpDown, 
  Activity,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExecutionStep } from './execution-step';
import type { AgentStep } from '@/types/research';

interface ExecutionTimelineProps {
  steps: Map<string, AgentStep>;
  rootStepIds: string[];
  onToggle?: (stepId: string) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  className?: string;
  maxHeight?: string;
}

export function ExecutionTimeline({
  steps,
  rootStepIds,
  onToggle,
  onExpandAll,
  onCollapseAll,
  className,
  maxHeight = 'calc(100vh - 400px)',
}: ExecutionTimelineProps) {
  // Calculate stats
  const stats = useMemo(() => {
    let total = 0;
    let running = 0;
    let success = 0;
    let error = 0;
    let totalDuration = 0;

    steps.forEach(step => {
      total++;
      if (step.status === 'running') running++;
      if (step.status === 'success') success++;
      if (step.status === 'error') error++;
      if (step.duration) totalDuration += step.duration;
    });

    return { total, running, success, error, totalDuration };
  }, [steps]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Render step recursively
  const renderStep = (stepId: string, depth: number, index: number, total: number) => {
    const step = steps.get(stepId);
    if (!step) return null;

    const childSteps = step.children
      .map(childId => steps.get(childId))
      .filter((s): s is AgentStep => s !== undefined);

    return (
      <ExecutionStep
        key={step.id}
        step={step}
        depth={depth}
        isLast={index === total - 1}
        onToggle={onToggle}
      >
        {childSteps.length > 0 && (
          <div className="space-y-2">
            {childSteps.map((childStep, childIndex) =>
              renderStep(childStep.id, depth + 1, childIndex, childSteps.length)
            )}
          </div>
        )}
      </ExecutionStep>
    );
  };

  if (steps.size === 0) {
    return (
      <Card className={cn('bg-card/50 backdrop-blur', className)}>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <Activity className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">Waiting for agent execution...</p>
            <p className="text-xs mt-1 opacity-70">Steps will appear here as the agent works</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('bg-card/50 backdrop-blur', className)}>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-serif">
            <Activity className="w-5 h-5 text-primary" />
            Execution Timeline
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Stats */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground mr-2">
              {stats.running > 0 && (
                <span className="flex items-center gap-1 text-primary">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {stats.running}
                </span>
              )}
              {stats.success > 0 && (
                <span className="flex items-center gap-1 text-emerald-500">
                  <CheckCircle className="w-3 h-3" />
                  {stats.success}
                </span>
              )}
              {stats.error > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="w-3 h-3" />
                  {stats.error}
                </span>
              )}
              {stats.totalDuration > 0 && (
                <span className="text-muted-foreground">
                  {formatDuration(stats.totalDuration)}
                </span>
              )}
            </div>
            
            {/* Expand/Collapse buttons */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onExpandAll}
              className="h-7 px-2"
              title="Expand all"
            >
              <ChevronsUpDown className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCollapseAll}
              className="h-7 px-2"
              title="Collapse all"
            >
              <ChevronsDownUp className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea style={{ maxHeight }} className="min-h-[200px]">
          <div className="p-4 space-y-2">
            {rootStepIds.map((stepId, index) =>
              renderStep(stepId, 0, index, rootStepIds.length)
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Lightweight timeline for sidebar/compact view
interface CompactTimelineProps {
  steps: Map<string, AgentStep>;
  rootStepIds: string[];
  className?: string;
}

export function CompactTimeline({ steps, rootStepIds, className }: CompactTimelineProps) {
  const activeSteps = useMemo(() => {
    const active: AgentStep[] = [];
    steps.forEach(step => {
      if (step.status === 'running') {
        active.push(step);
      }
    });
    return active;
  }, [steps]);

  const recentSteps = useMemo(() => {
    const all = Array.from(steps.values());
    return all
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 5);
  }, [steps]);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Currently running */}
      {activeSteps.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-primary uppercase tracking-wider flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Running
          </span>
          {activeSteps.map(step => (
            <div
              key={step.id}
              className="text-xs bg-primary/10 border border-primary/20 rounded px-2 py-1 animate-pulse"
            >
              {step.title}
            </div>
          ))}
        </div>
      )}

      {/* Recent steps */}
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Recent ({steps.size} total)
        </span>
        {recentSteps.map(step => (
          <div
            key={step.id}
            className={cn(
              'text-xs rounded px-2 py-1 flex items-center gap-2',
              step.status === 'success' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
              step.status === 'error' && 'bg-destructive/10 text-destructive',
              step.status === 'running' && 'bg-primary/10 text-primary',
              step.status === 'waiting' && 'bg-muted text-muted-foreground'
            )}
          >
            <span className="truncate flex-1">{step.title}</span>
            {step.duration && (
              <span className="text-[10px] opacity-70">
                {step.duration < 1000 ? `${step.duration}ms` : `${(step.duration / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}



