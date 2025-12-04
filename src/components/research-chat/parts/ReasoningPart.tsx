'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, ChevronRight, ChevronDown, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReasoningPartProps {
  text: string;
  state?: 'streaming' | 'done';
  duration?: number;
  className?: string;
}

/**
 * ReasoningPart - Enhanced AI reasoning/thinking display
 * 
 * Redesigned for better visibility:
 * - More prominent during streaming
 * - Larger font and better contrast
 * - Smart collapse behavior (doesn't auto-collapse during active research)
 * - "View Full" button for long content
 */
export function ReasoningPart({ 
  text, 
  state,
  duration,
  className 
}: ReasoningPartProps) {
  const isStreaming = state === 'streaming';
  const isComplete = state === 'done';
  
  // Don't auto-collapse during streaming or shortly after
  const [isExpanded, setIsExpanded] = useState(true);
  const [hasBeenCollapsed, setHasBeenCollapsed] = useState(false);
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
  
  // Only collapse after a delay when complete and user hasn't interacted
  useEffect(() => {
    if (isComplete && !hasBeenCollapsed) {
      // Auto-collapse after 3 seconds of completion
      const timer = setTimeout(() => {
        setIsExpanded(false);
        setHasBeenCollapsed(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, hasBeenCollapsed]);
  
  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
    setHasBeenCollapsed(true);
  }, []);
  
  const displayDuration = duration ?? elapsedSeconds;
  const isLongContent = text.length > 500;
  
  // Collapsed state - single line with expand button
  if (!isExpanded && isComplete) {
    return (
      <div 
        className={cn('reasoning-collapsed cursor-pointer group', className)}
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2.5 py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
          <Brain className="w-3.5 h-3.5 text-primary/60" />
          <span className="text-sm text-muted-foreground">
            思考了 {displayDuration}s
          </span>
          <span className="text-xs text-muted-foreground/50 ml-auto">
            点击展开
          </span>
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn('reasoning-container', className)}>
      {/* Header */}
      <button
        onClick={handleToggle}
        className={cn(
          'w-full flex items-center gap-2.5 py-2 px-3 rounded-t-lg',
          'bg-muted/30 hover:bg-muted/50 transition-colors',
          !isStreaming && 'cursor-pointer'
        )}
        disabled={isStreaming}
      >
        {isComplete ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
        ) : (
          <div className="w-3.5 h-3.5" />
        )}
        
        <Brain className={cn(
          'w-3.5 h-3.5',
          isStreaming ? 'text-primary animate-pulse' : 'text-primary/60'
        )} />
        
        <span className={cn(
          'text-sm font-medium',
          isStreaming ? 'text-foreground' : 'text-muted-foreground'
        )}>
          {isStreaming ? '正在思考...' : `思考了 ${displayDuration}s`}
        </span>
        
        {/* Full view button for long content */}
        {isLongContent && !isStreaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFullView(true);
            }}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <Maximize2 className="w-3 h-3" />
            查看全部
          </button>
        )}
      </button>
      
      {/* Content */}
      <div
        ref={contentRef}
        className={cn(
          'px-3 pb-3 pt-2 rounded-b-lg bg-muted/20',
          'max-h-60 overflow-y-auto scrollbar-thin'
        )}
      >
        <div className={cn(
          'reasoning-text whitespace-pre-wrap',
          isStreaming ? 'text-sm text-foreground/80' : 'text-sm text-muted-foreground/70'
        )}>
          {text}
          {/* Streaming cursor */}
          {isStreaming && (
            <span className="reasoning-cursor" />
          )}
        </div>
      </div>
      
      {/* Full view modal */}
      {showFullView && (
        <FullViewModal 
          text={text} 
          duration={displayDuration}
          onClose={() => setShowFullView(false)} 
        />
      )}
    </div>
  );
}

interface FullViewModalProps {
  text: string;
  duration: number;
  onClose: () => void;
}

function FullViewModal({ text, duration, onClose }: FullViewModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl max-h-[80vh] bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
          <Brain className="w-4 h-4 text-primary/60" />
          <span className="text-sm font-medium">完整思考过程</span>
          <span className="text-xs text-muted-foreground/60 ml-auto">
            {duration}s
          </span>
        </div>
        
        {/* Modal content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {text}
          </div>
        </div>
        
        {/* Modal footer */}
        <div className="px-4 py-3 border-t border-border bg-muted/20">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReasoningPart;
