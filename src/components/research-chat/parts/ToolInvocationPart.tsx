'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Wrench, Check, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolInvocationPartProps {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: 'input-streaming' | 'partial-call' | 'call' | 'result';
  result?: unknown;
  className?: string;
}

/**
 * ToolInvocationPart - Renders tool call invocations
 * 
 * Features:
 * - Shows tool name and status
 * - Expandable to show arguments and results
 * - Different states: partial, calling, complete
 */
export function ToolInvocationPart({ 
  toolCallId,
  toolName,
  args,
  state,
  result,
  className 
}: ToolInvocationPartProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isLoading = state === 'input-streaming' || state === 'partial-call' || state === 'call';
  const isComplete = state === 'result';
  const hasError = Boolean(isComplete && result && typeof result === 'object' && 'error' in (result as Record<string, unknown>));
  
  // Format tool name for display
  const displayName = toolName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());
  
  return (
    <div className={cn('py-1', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 w-full text-left',
          'text-xs text-muted-foreground hover:text-foreground transition-colors'
        )}
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        
        {/* Status icon */}
        {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
        {isComplete && !hasError && <Check className="w-3 h-3 text-green-500" />}
        {hasError && <AlertCircle className="w-3 h-3 text-destructive" />}
        
        <Wrench className="w-3 h-3 opacity-50" />
        <span className="font-medium">{displayName}</span>
        
        {isLoading && (
          <span className="text-muted-foreground/60">Running...</span>
        )}
      </button>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className="ml-5 mt-2 space-y-2">
          {/* Arguments */}
          <div className="rounded-md bg-muted/30 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">
              Arguments
            </div>
            <pre className="text-xs text-muted-foreground overflow-x-auto">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
          
          {/* Result */}
          {isComplete && result !== undefined && (
            <div className={cn(
              'rounded-md p-2',
              hasError ? 'bg-destructive/10' : 'bg-green-500/10'
            )}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                Result
              </div>
              <pre className="text-xs text-muted-foreground overflow-x-auto">
                {typeof result === 'string' ? result : JSON.stringify(result as Record<string, unknown> | null, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ToolInvocationPart;

