'use client';

import { Copy, RotateCcw, ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';

interface HoverActionsProps {
  onCopy?: () => void;
  onRetry?: () => void;
  onThumbsUp?: () => void;
  onThumbsDown?: () => void;
  className?: string;
  showRetry?: boolean;
  showFeedback?: boolean;
  content?: string;
}

/**
 * HoverActions - Modern floating pill style
 * Glassmorphism design with smooth transitions
 */
export function HoverActions({ 
  onCopy, 
  onRetry, 
  onThumbsUp, 
  onThumbsDown,
  className,
  showRetry = true,
  showFeedback = true,
  content,
}: HoverActionsProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  
  const handleCopy = useCallback(() => {
    if (content) {
      navigator.clipboard.writeText(content);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  }, [content, onCopy]);
  
  const handleThumbsUp = useCallback(() => {
    setFeedback('up');
    onThumbsUp?.();
  }, [onThumbsUp]);
  
  const handleThumbsDown = useCallback(() => {
    setFeedback('down');
    onThumbsDown?.();
  }, [onThumbsDown]);
  
  return (
    <div className={cn(
      "flex items-center gap-0.5 p-1",
      "rounded-full glass-subtle",
      "border border-border/50",
      "shadow-lg",
      className
    )}>
      {/* Copy */}
      <ActionButton
        icon={copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
        onClick={handleCopy}
        title="复制"
      />
      
      {/* Retry */}
      {showRetry && (
        <ActionButton
          icon={<RotateCcw className="w-3 h-3" />}
          onClick={onRetry}
          title="重新生成"
        />
      )}
      
      {/* Divider */}
      {showFeedback && <div className="w-px h-3 bg-border/50 mx-0.5" />}
      
      {/* Feedback */}
      {showFeedback && (
        <>
          <ActionButton
            icon={<ThumbsUp className="w-3 h-3" />}
            onClick={handleThumbsUp}
            title="有帮助"
            active={feedback === 'up'}
            activeColor="text-primary"
          />
          <ActionButton
            icon={<ThumbsDown className="w-3 h-3" />}
            onClick={handleThumbsDown}
            title="没帮助"
            active={feedback === 'down'}
            activeColor="text-destructive"
          />
        </>
      )}
    </div>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  title: string;
  active?: boolean;
  activeColor?: string;
}

function ActionButton({ icon, onClick, title, active, activeColor }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded-full",
        "transition-all duration-150",
        active 
          ? activeColor 
          : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
      )}
    >
      {icon}
    </button>
  );
}







