'use client';

import { Copy, RotateCcw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HoverActionsProps {
  onCopy?: () => void;
  onRetry?: () => void;
  onThumbsUp?: () => void;
  onThumbsDown?: () => void;
  className?: string;
  showRetry?: boolean;
  showFeedback?: boolean;
}

/**
 * HoverActions - Cursor 2.0 style hover action buttons
 * Appears on hover over messages
 */
export function HoverActions({ 
  onCopy, 
  onRetry, 
  onThumbsUp, 
  onThumbsDown,
  className,
  showRetry = true,
  showFeedback = true,
}: HoverActionsProps) {
  return (
    <div className={cn(
      "flex items-center gap-0.5 bg-card rounded-lg border border-border p-0.5 shadow-md",
      className
    )}>
      {/* Copy */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={onCopy}
        title="复制"
      >
        <Copy className="w-3 h-3" />
      </Button>
      
      {/* Retry */}
      {showRetry && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onRetry}
          title="重新生成"
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
      )}
      
      {/* Feedback */}
      {showFeedback && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-status-success"
            onClick={onThumbsUp}
            title="有帮助"
          >
            <ThumbsUp className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-status-error"
            onClick={onThumbsDown}
            title="没帮助"
          >
            <ThumbsDown className="w-3 h-3" />
          </Button>
        </>
      )}
    </div>
  );
}







