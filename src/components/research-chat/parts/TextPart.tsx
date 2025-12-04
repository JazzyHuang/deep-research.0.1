'use client';

import { cn } from '@/lib/utils';

interface TextPartProps {
  text: string;
  state?: 'streaming' | 'done';
  className?: string;
}

/**
 * TextPart - Renders text content from a message part
 * 
 * Features:
 * - Plain text rendering with optional streaming cursor
 * - Supports markdown-like formatting
 */
export function TextPart({ text, state, className }: TextPartProps) {
  const isStreaming = state === 'streaming';
  
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
        {text}
        {/* Streaming cursor */}
        {isStreaming && (
          <span 
            className={cn(
              'inline-block w-0.5 h-4 ml-0.5 align-text-bottom',
              'bg-accent animate-cursor-blink'
            )} 
          />
        )}
      </div>
    </div>
  );
}

export default TextPart;



