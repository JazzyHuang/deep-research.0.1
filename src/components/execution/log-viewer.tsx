'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Info, AlertTriangle, XCircle, Bug } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentStepLog } from '@/types/research';
import { JsonViewer } from './json-viewer';

interface LogViewerProps {
  logs: AgentStepLog[];
  className?: string;
  maxVisible?: number;
}

const logIcons = {
  info: <Info className="w-3 h-3 text-blue-500" />,
  warn: <AlertTriangle className="w-3 h-3 text-amber-500" />,
  error: <XCircle className="w-3 h-3 text-destructive" />,
  debug: <Bug className="w-3 h-3 text-muted-foreground" />,
};

const logColors = {
  info: 'border-l-blue-500/50',
  warn: 'border-l-amber-500/50',
  error: 'border-l-destructive/50',
  debug: 'border-l-muted-foreground/50',
};

export function LogViewer({ logs, className, maxVisible = 5 }: LogViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  if (logs.length === 0) {
    return (
      <div className={cn('text-xs text-muted-foreground italic py-2', className)}>
        No logs available
      </div>
    );
  }

  const visibleLogs = expanded ? logs : logs.slice(0, maxVisible);
  const hasMore = logs.length > maxVisible;

  const toggleLogData = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Logs ({logs.length})
        </span>
      </div>

      <div className="space-y-1">
        {visibleLogs.map((log) => (
          <div
            key={log.id}
            className={cn(
              'bg-muted/30 rounded-md border-l-2 transition-colors',
              logColors[log.level]
            )}
          >
            <div
              className={cn(
                'flex items-start gap-2 px-2 py-1.5',
                log.data !== undefined && 'cursor-pointer hover:bg-muted/50'
              )}
              onClick={() => log.data !== undefined && toggleLogData(log.id)}
            >
              <div className="flex-shrink-0 mt-0.5">
                {logIcons[log.level]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {formatTime(log.timestamp)}
                  </span>
                  <span className="text-xs text-foreground/90 break-words">
                    {log.message}
                  </span>
                </div>
              </div>
              {log.data !== undefined && (
                <div className="flex-shrink-0">
                  {expandedLogs.has(log.id) ? (
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
            
            {log.data !== undefined && expandedLogs.has(log.id) && (
              <div className="px-2 pb-2 pt-1 border-t border-border/50">
                <JsonViewer data={log.data} maxHeight="150px" />
              </div>
            )}
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
        >
          {expanded ? (
            <>
              <ChevronDown className="w-3 h-3" />
              <span>Show less</span>
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3" />
              <span>Show {logs.length - maxVisible} more logs</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

