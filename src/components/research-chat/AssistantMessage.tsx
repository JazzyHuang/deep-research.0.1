'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { HoverActions } from './HoverActions';

interface AssistantMessageProps {
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  onCopy?: () => void;
  onRetry?: () => void;
}

/**
 * AssistantMessage - Cursor 2.0 style
 * Features: no container/bubble, no avatar, plain text with streaming cursor
 * Includes hover actions for copy/retry/feedback
 */
export function AssistantMessage({ 
  content, 
  isStreaming,
  onCopy,
  onRetry,
}: AssistantMessageProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    onCopy?.();
  };
  
  return (
    <div 
      className="py-4 message-enter group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hover Actions - appears on hover */}
      {!isStreaming && isHovered && (
        <div className="absolute -top-2 right-0 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <HoverActions
            onCopy={handleCopy}
            onRetry={onRetry}
            showRetry={!!onRetry}
          />
        </div>
      )}
      
      {/* AI message: completely no container, direct text */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {content}
          {/* Streaming cursor - Cursor 2.0 style */}
          {isStreaming && (
            <span 
              className={cn(
                "inline-block w-0.5 h-4 ml-0.5 align-text-bottom",
                "bg-accent animate-cursor-blink"
              )} 
            />
          )}
        </div>
      </div>
    </div>
  );
}
