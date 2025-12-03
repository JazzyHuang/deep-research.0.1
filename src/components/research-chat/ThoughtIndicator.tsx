'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThoughtIndicatorProps {
  thought: string;
  duration?: number;
  defaultExpanded?: boolean;
}

/**
 * ThoughtIndicator - Cursor 2.0 style thought process indicator
 * Features: ⬢ icon, collapsible, duration display
 */
export function ThoughtIndicator({ 
  thought, 
  duration,
  defaultExpanded = false 
}: ThoughtIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  return (
    <div className="my-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        {/* Cursor hexagon icon */}
        <span className="text-status-running">⬢</span>
        
        <span className="font-medium">
          Thought
          {duration !== undefined && (
            <span className="text-muted-foreground ml-1">{duration}s</span>
          )}
        </span>
        
        <ChevronRight className={cn(
          "w-3 h-3 transition-transform duration-200",
          isExpanded && "rotate-90"
        )} />
      </button>
      
      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-1 pl-5 text-xs text-muted-foreground border-l-2 border-border ml-1">
          <p className="py-1">{thought}</p>
        </div>
      )}
    </div>
  );
}







