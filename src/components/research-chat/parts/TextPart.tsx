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
 * Stream layout optimized:
 * - Clean text without bubble wrapper
 * - Slightly larger text for readability
 * - Streaming cursor for live updates
 */
export function TextPart({ text, state, className }: TextPartProps) {
  const isStreaming = state === 'streaming';
  
  return (
    <div className={cn('stream-text', className)}>
      <div className={cn(
        "text-[0.9375rem] text-foreground/90 whitespace-pre-wrap leading-[1.7]",
        isStreaming && "text-foreground"
      )}>
        {text}
        {/* Streaming cursor */}
        {isStreaming && (
          <span 
            className={cn(
              'inline-block w-0.5 h-[1.1em] ml-0.5 align-text-bottom rounded-full',
              'bg-primary/70 animate-cursor-blink'
            )} 
          />
        )}
      </div>
    </div>
  );
}

export default TextPart;




