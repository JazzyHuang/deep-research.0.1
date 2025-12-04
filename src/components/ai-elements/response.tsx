'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ============================================================================
// Response
// ============================================================================

interface ResponseProps {
  children: React.ReactNode;
  isStreaming?: boolean;
  className?: string;
}

/**
 * Response - Renders AI response content with markdown support
 * 
 * Features:
 * - Markdown rendering with GFM support
 * - Streaming cursor indicator
 * - Proper prose styling
 */
export function Response({ 
  children, 
  isStreaming = false,
  className 
}: ResponseProps) {
  const content = typeof children === 'string' ? children : '';
  
  return (
    <div className={cn(
      'prose prose-sm dark:prose-invert max-w-none',
      'prose-p:leading-relaxed prose-p:my-2',
      'prose-headings:font-semibold prose-headings:mt-6 prose-headings:mb-3',
      'prose-ul:my-2 prose-ol:my-2',
      'prose-li:my-0.5',
      'prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
      'prose-pre:bg-muted prose-pre:p-3 prose-pre:rounded-lg',
      'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
      className
    )}>
      {typeof children === 'string' ? (
        <>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
          {isStreaming && (
            <span 
              className={cn(
                'inline-block w-0.5 h-4 ml-0.5 align-text-bottom',
                'bg-accent animate-cursor-blink'
              )} 
            />
          )}
        </>
      ) : (
        children
      )}
    </div>
  );
}

export default Response;







