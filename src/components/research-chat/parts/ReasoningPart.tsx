'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, ChevronRight, ChevronDown, Maximize2, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReasoningPartProps {
  text: string;
  state?: 'streaming' | 'done';
  duration?: number;
  className?: string;
}

/**
 * ReasoningPart - Modern AI reasoning/thinking display
 * 
 * Features:
 * - Animated accordion with spring transitions
 * - Pulsing "thinking" indicator during streaming
 * - Smart auto-collapse with user preference memory
 * - Full-view modal for long content
 */
export function ReasoningPart({ 
  text, 
  state,
  duration,
  className 
}: ReasoningPartProps) {
  const isStreaming = state === 'streaming';
  const isComplete = state === 'done';
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [startTime] = useState(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showFullView, setShowFullView] = useState(false);
  
  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [text, isStreaming]);
  
  // Track elapsed time during streaming
  useEffect(() => {
    if (!isStreaming) return;
    
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isStreaming, startTime]);
  
  // Auto-collapse after completion (with delay)
  useEffect(() => {
    if (isComplete && !hasUserInteracted) {
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, hasUserInteracted]);
  
  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
    setHasUserInteracted(true);
  }, []);
  
  const displayDuration = duration ?? elapsedSeconds;
  const isLongContent = text.length > 600;
  const wordCount = text.split(/\s+/).length;
  
  return (
    <div 
      className={cn(
        'reasoning-accordion',
        isStreaming && 'reasoning-accordion-streaming',
        className
      )}
      data-state={isStreaming ? 'streaming' : isComplete ? 'complete' : 'idle'}
    >
      {/* Header - Always visible */}
      <button
        onClick={handleToggle}
        className={cn(
          'w-full flex items-center gap-3 py-3 px-4',
          'transition-all duration-200',
          'hover:bg-muted/30',
          isExpanded && 'border-b border-border/30'
        )}
        disabled={isStreaming}
      >
        {/* Expand/Collapse Indicator */}
        <div className={cn(
          'transition-transform duration-300',
          isExpanded && 'rotate-90'
        )}>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
        </div>
        
        {/* Brain Icon with Animation */}
        <div className="relative">
          <Brain className={cn(
            'w-4 h-4 transition-colors duration-300',
            isStreaming ? 'text-primary thinking-brain' : 'text-primary/50'
          )} />
          {isStreaming && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-ping" />
          )}
        </div>
        
        {/* Label */}
        <div className="flex-1 flex items-center gap-2 text-left">
          {isStreaming ? (
            <span className="text-sm font-medium text-foreground flex items-center gap-2">
              思考中
              <span className="typing-dots">
                <span />
                <span />
                <span />
              </span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              思考过程
              <span className="mx-1.5 text-muted-foreground/40">·</span>
              <span className="text-xs">{displayDuration}s</span>
              {wordCount > 50 && (
                <>
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  <span className="text-xs">{wordCount} 字</span>
                </>
              )}
            </span>
          )}
        </div>
        
        {/* Actions */}
        {!isStreaming && isLongContent && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFullView(true);
            }}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md",
              "text-xs text-muted-foreground/60",
              "hover:text-muted-foreground hover:bg-muted/50",
              "transition-colors duration-150"
            )}
          >
            <Maximize2 className="w-3 h-3" />
            展开
          </button>
        )}
      </button>
      
      {/* Content - Collapsible */}
      <div className={cn(
        'overflow-hidden transition-all duration-300',
        isExpanded ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
      )}>
        <div
          ref={contentRef}
          className={cn(
            'px-4 py-3 max-h-[280px] overflow-y-auto scrollbar-thin'
          )}
        >
          <div 
            className={cn(
              'reasoning-text whitespace-pre-wrap',
              isStreaming && 'text-foreground/80'
            )}
            data-streaming={isStreaming}
          >
            {text}
            {isStreaming && <span className="reasoning-cursor" />}
          </div>
        </div>
      </div>
      
      {/* Full View Modal */}
      {showFullView && (
        <FullViewModal 
          text={text} 
          duration={displayDuration}
          wordCount={wordCount}
          onClose={() => setShowFullView(false)} 
        />
      )}
    </div>
  );
}

interface FullViewModalProps {
  text: string;
  duration: number;
  wordCount: number;
  onClose: () => void;
}

function FullViewModal({ text, duration, wordCount, onClose }: FullViewModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);
  
  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        "bg-background/60 backdrop-blur-md",
        "animate-in fade-in duration-200"
      )}
      onClick={onClose}
    >
      <div 
        className={cn(
          "w-full max-w-2xl max-h-[85vh]",
          "bg-card border border-border/50",
          "rounded-2xl shadow-2xl overflow-hidden",
          "animate-in zoom-in-95 slide-in-from-bottom-2 duration-300"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium">完整思考过程</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {duration}s · {wordCount} 字
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "p-2 rounded-lg",
              "text-muted-foreground hover:text-foreground",
              "hover:bg-muted/50 transition-colors"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Modal Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto scrollbar-thin">
          <div className="text-sm text-foreground/85 whitespace-pre-wrap leading-[1.8] font-mono">
            {text}
          </div>
        </div>
        
        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border/50 bg-muted/10">
          <button
            onClick={() => {
              navigator.clipboard.writeText(text);
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm",
              "text-muted-foreground hover:text-foreground",
              "border border-border/50 hover:border-border",
              "transition-colors"
            )}
          >
            复制内容
          </button>
          <button
            onClick={onClose}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium",
              "bg-primary text-primary-foreground",
              "hover:bg-primary/90 transition-colors"
            )}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReasoningPart;
