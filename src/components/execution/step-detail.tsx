'use client';

import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { JsonViewer } from './json-viewer';
import { LogViewer } from './log-viewer';
import type { AgentStep } from '@/types/research';

interface StepDetailProps {
  step: AgentStep;
  className?: string;
}

export function StepDetail({ step, className }: StepDetailProps) {
  const hasInput = step.input?.prompt || step.input?.params;
  const hasOutput = step.output?.result || step.output?.summary;
  const hasLogs = step.logs.length > 0;
  const hasError = step.error;

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className={cn('space-y-4 py-3', className)}>
      {/* Description */}
      {step.description && (
        <div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Description
          </span>
          <p className="text-sm text-foreground/80 mt-1">
            {step.description}
          </p>
        </div>
      )}

      {/* Timing info */}
      {step.duration && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Duration: <span className="font-medium text-foreground">{formatDuration(step.duration)}</span>
          </span>
          {step.startTime && (
            <span>
              Started: {new Date(step.startTime).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {/* Input Section */}
      {hasInput && (
        <>
          <Separator />
          <div className="space-y-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Input
            </span>
            
            {step.input?.prompt && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Prompt</span>
                <div className="bg-muted/50 rounded-md p-3 text-sm text-foreground/80 whitespace-pre-wrap max-h-[200px] overflow-auto">
                  {step.input.prompt}
                </div>
              </div>
            )}
            
            {step.input?.params && Object.keys(step.input.params).length > 0 && (
              <JsonViewer 
                data={step.input.params} 
                label="Parameters"
                collapsed={true}
              />
            )}
          </div>
        </>
      )}

      {/* Output Section */}
      {hasOutput && (
        <>
          <Separator />
          <div className="space-y-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Output
              {step.output?.truncated && (
                <span className="ml-2 text-amber-500 normal-case">(truncated)</span>
              )}
            </span>
            
            {step.output?.summary && (
              <div className="text-sm text-foreground/80 bg-emerald-500/5 border border-emerald-500/20 rounded-md p-3">
                {step.output.summary}
              </div>
            )}
            
            {step.output?.result !== undefined && (
              <JsonViewer 
                data={step.output.result} 
                label="Result"
                collapsed={true}
              />
            )}
          </div>
        </>
      )}

      {/* Error Section */}
      {hasError && (
        <>
          <Separator />
          <div className="space-y-2">
            <span className="text-xs font-medium text-destructive uppercase tracking-wider">
              Error
            </span>
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-sm text-destructive font-medium">
                {step.error?.message}
              </p>
              {step.error?.code && (
                <p className="text-xs text-destructive/70 mt-1">
                  Code: {step.error.code}
                </p>
              )}
              {step.error?.stack && (
                <details className="mt-2">
                  <summary className="text-xs text-destructive/70 cursor-pointer hover:text-destructive">
                    Show stack trace
                  </summary>
                  <pre className="text-xs font-mono text-destructive/60 mt-2 overflow-auto max-h-[150px]">
                    {step.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </>
      )}

      {/* Logs Section */}
      {hasLogs && (
        <>
          <Separator />
          <LogViewer logs={step.logs} />
        </>
      )}

      {/* Empty state */}
      {!hasInput && !hasOutput && !hasLogs && !hasError && !step.description && (
        <div className="text-sm text-muted-foreground italic py-2">
          No details available for this step.
        </div>
      )}
    </div>
  );
}

