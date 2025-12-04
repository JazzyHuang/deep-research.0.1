'use client';

import { useState } from 'react';
import { 
  Search, 
  Filter, 
  BarChart3, 
  PenLine, 
  Check, 
  Info, 
  AlertTriangle,
  Database,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LogLineData, LogLineIcon } from '@/types/conversation';

interface LogLineProps {
  data: LogLineData;
  className?: string;
}

const ICON_MAP: Record<LogLineIcon, React.ReactNode> = {
  search: <Search className="w-3.5 h-3.5" />,
  filter: <Filter className="w-3.5 h-3.5" />,
  analyze: <BarChart3 className="w-3.5 h-3.5" />,
  write: <PenLine className="w-3.5 h-3.5" />,
  check: <Check className="w-3.5 h-3.5" />,
  info: <Info className="w-3.5 h-3.5" />,
  warning: <AlertTriangle className="w-3.5 h-3.5" />,
  database: <Database className="w-3.5 h-3.5" />,
};

/**
 * LogLine - Minimal gray execution log entry
 * No container/border, just inline gray text
 */
export function LogLine({ data, className }: LogLineProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = !!data.details;
  
  return (
    <div className={cn("py-1.5 log-entry-enter", className)}>
      <div 
        className={cn(
          "flex items-start gap-2",
          hasDetails && "cursor-pointer hover:text-muted-foreground/80"
        )}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        {/* Expand Arrow (if has details) */}
        {hasDetails && (
          <div className="flex-shrink-0 mt-0.5 text-muted-foreground/50">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </div>
        )}
        
        {/* Icon */}
        {data.icon && (
          <div className="flex-shrink-0 mt-0.5 text-muted-foreground/60">
            {ICON_MAP[data.icon]}
          </div>
        )}
        
        {/* Text Content */}
        <div className="flex-1 min-w-0">
          <span className="log-text">
            {data.text}
          </span>
          
          {/* Inline Timestamp */}
          {data.timestamp && (
            <span className="ml-2 text-[10px] text-muted-foreground/40 tabular-nums">
              {formatTimestamp(data.timestamp)}
            </span>
          )}
        </div>
      </div>
      
      {/* Expandable Details */}
      {hasDetails && isExpanded && (
        <div className="mt-1 ml-5 pl-2 border-l border-muted text-xs text-muted-foreground/60 leading-relaxed">
          {data.details}
        </div>
      )}
    </div>
  );
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  });
}

export default LogLine;







