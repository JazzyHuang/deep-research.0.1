'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Copy, Check, RotateCcw, ThumbsUp, ThumbsDown } from 'lucide-react';

interface AssistantMessageProps {
  content: string;
  timestamp?: number;
  isStreaming?: boolean;
  onCopy?: () => void;
  onRetry?: () => void;
  className?: string;
}

/**
 * AssistantMessage - Modern minimalist style
 * Features: Clean text flow, floating action pill on hover
 */
export function AssistantMessage({ 
  content, 
  isStreaming,
  onCopy,
  onRetry,
  className,
}: AssistantMessageProps) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  }, [content, onCopy]);
  
  return (
    <div className={cn("py-3 message-enter group relative", className)}>
      {/* Floating Action Pill - appears on hover */}
      {!isStreaming && (
        <div className={cn(
          "absolute -top-3 right-0 z-10",
          "opacity-0 group-hover:opacity-100",
          "translate-y-1 group-hover:translate-y-0",
          "transition-all duration-200 ease-out"
        )}>
          <div className={cn(
            "flex items-center gap-0.5 p-1",
            "rounded-full glass-subtle",
            "border border-border/50"
          )}>
            <ActionButton
              icon={copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
              onClick={handleCopy}
              title="复制"
            />
            {onRetry && (
              <ActionButton
                icon={<RotateCcw className="w-3 h-3" />}
                onClick={onRetry}
                title="重试"
              />
            )}
            <div className="w-px h-3 bg-border/50 mx-0.5" />
            <ActionButton
              icon={<ThumbsUp className="w-3 h-3" />}
              onClick={() => {}}
              title="有帮助"
            />
            <ActionButton
              icon={<ThumbsDown className="w-3 h-3" />}
              onClick={() => {}}
              title="无帮助"
            />
          </div>
        </div>
      )}
      
      {/* AI message: clean text flow */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <div className={cn(
          "text-[0.9375rem] text-foreground/90 whitespace-pre-wrap leading-[1.7]",
          isStreaming && "text-foreground"
        )}>
          {content}
          {/* Streaming cursor */}
          {isStreaming && (
            <span className="inline-block w-0.5 h-[1.1em] ml-1 align-text-bottom rounded-full bg-primary/70 animate-cursor-blink" />
          )}
        </div>
      </div>
    </div>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
}

function ActionButton({ icon, onClick, title }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded-full",
        "text-muted-foreground hover:text-foreground",
        "hover:bg-muted/80",
        "transition-colors duration-150"
      )}
    >
      {icon}
    </button>
  );
}
