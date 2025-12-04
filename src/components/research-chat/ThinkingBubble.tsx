'use client';

import { useState, useEffect, useRef } from 'react';
import { Brain, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThinkingBubbleProps {
  content: string;
  duration?: number;         // Duration in seconds (when complete)
  isStreaming?: boolean;
  isComplete?: boolean;
  className?: string;
}

/**
 * ThinkingBubble - Redesigned for execution log UI
 * Features:
 * - No container/border - just gray text
 * - Auto-scroll during streaming
 * - Auto-collapse after streaming completes to "Thought for Xs"
 * - Click to expand/view full content
 */
export function ThinkingBubble({
  content,
  duration,
  isStreaming = false,
  isComplete = false,
  className,
}: ThinkingBubbleProps) {
  // Auto-collapse when streaming completes
  const [isExpanded, setIsExpanded] = useState(!isComplete);
  const contentRef = useRef<HTMLDivElement>(null);
  const [startTime] = useState(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming]);
  
  // Track elapsed time during streaming
  useEffect(() => {
    if (!isStreaming) return;
    
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isStreaming, startTime]);
  
  // Auto-collapse when complete
  useEffect(() => {
    if (isComplete && !isStreaming) {
      setIsExpanded(false);
    }
  }, [isComplete, isStreaming]);
  
  const displayDuration = duration ?? elapsedSeconds;
  
  // Collapsed state - single line "Thought for Xs"
  if (!isExpanded && isComplete) {
    return (
      <div 
        className={cn("thinking-container", className)}
        onClick={() => setIsExpanded(true)}
      >
        <div className="thinking-collapsed">
          <ChevronRight className="w-3 h-3" />
          <Brain className="w-3 h-3" />
          <span>Thought for {displayDuration}s</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn("thinking-container py-2", className)}>
      {/* Header - Collapsible toggle */}
      <button
        onClick={() => isComplete && setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 mb-1",
          "text-xs text-muted-foreground/50",
          isComplete && "cursor-pointer hover:text-muted-foreground/70"
        )}
        disabled={!isComplete}
      >
        {isComplete ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <div className="w-3 h-3" /> // Spacer
        )}
        <Brain className={cn(
          "w-3 h-3",
          isStreaming && "animate-pulse"
        )} />
        <span>
          {isStreaming ? `Thinking...` : `Thought for ${displayDuration}s`}
        </span>
      </button>
      
      {/* Content - Scrollable */}
      <div
        ref={contentRef}
        className={cn(
          "thinking-expanded ml-5",
          "scrollbar-thin"
        )}
      >
        <div className="thinking-text whitespace-pre-wrap">
          {content}
          {/* Streaming cursor */}
          {isStreaming && (
            <span className="thinking-cursor" />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ThinkingIndicator - Simple inline indicator when thinking
 */
interface ThinkingIndicatorProps {
  className?: string;
}

export function ThinkingIndicator({ className }: ThinkingIndicatorProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 py-1",
      "text-xs text-muted-foreground/50",
      className
    )}>
      <Brain className="w-3 h-3 animate-pulse" />
      <span>Thinking...</span>
      <span className="thinking-cursor" />
    </div>
  );
}

export default ThinkingBubble;
