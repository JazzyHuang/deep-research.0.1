'use client';

import * as React from 'react';
import { Brain, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// ============================================================================
// Reasoning Context
// ============================================================================

interface ReasoningContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isStreaming: boolean;
  isComplete: boolean;
  duration?: number;
}

const ReasoningContext = React.createContext<ReasoningContextValue | null>(null);

function useReasoning() {
  const context = React.useContext(ReasoningContext);
  if (!context) {
    throw new Error('useReasoning must be used within a Reasoning');
  }
  return context;
}

// ============================================================================
// Reasoning
// ============================================================================

interface ReasoningProps {
  children: React.ReactNode;
  isStreaming?: boolean;
  isComplete?: boolean;
  duration?: number;
  defaultOpen?: boolean;
  className?: string;
}

export function Reasoning({
  children,
  isStreaming = false,
  isComplete = true,
  duration,
  defaultOpen,
  className,
}: ReasoningProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen ?? !isComplete);
  
  // Auto-collapse when complete
  React.useEffect(() => {
    if (isComplete && !isStreaming) {
      setIsOpen(false);
    }
  }, [isComplete, isStreaming]);
  
  return (
    <ReasoningContext.Provider value={{ isOpen, setIsOpen, isStreaming, isComplete, duration }}>
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className={cn('py-1', className)}
      >
        {children}
      </Collapsible>
    </ReasoningContext.Provider>
  );
}

// ============================================================================
// ReasoningTrigger
// ============================================================================

interface ReasoningTriggerProps {
  children?: React.ReactNode;
  className?: string;
}

export function ReasoningTrigger({ children, className }: ReasoningTriggerProps) {
  const { isOpen, isStreaming, isComplete, duration } = useReasoning();
  
  const defaultContent = isStreaming 
    ? 'Thinking...' 
    : duration 
    ? `Thought for ${Math.round(duration / 1000)}s` 
    : 'View reasoning';
  
  return (
    <CollapsibleTrigger
      className={cn(
        'flex items-center gap-2',
        'text-xs text-muted-foreground/60',
        'hover:text-muted-foreground transition-colors',
        'cursor-pointer',
        className
      )}
    >
      {isOpen ? (
        <ChevronDown className="w-3 h-3" />
      ) : (
        <ChevronRight className="w-3 h-3" />
      )}
      <Brain className={cn(
        'w-3 h-3',
        isStreaming && 'animate-pulse'
      )} />
      <span>{children || defaultContent}</span>
    </CollapsibleTrigger>
  );
}

// ============================================================================
// ReasoningContent
// ============================================================================

interface ReasoningContentProps {
  children: React.ReactNode;
  duration?: number;
  className?: string;
}

export function ReasoningContent({ 
  children, 
  className 
}: ReasoningContentProps) {
  const { isStreaming } = useReasoning();
  const contentRef = React.useRef<HTMLDivElement>(null);
  
  // Auto-scroll during streaming
  React.useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [children, isStreaming]);
  
  return (
    <CollapsibleContent>
      <div
        ref={contentRef}
        className={cn(
          'ml-5 mt-1.5 max-h-40 overflow-y-auto',
          'text-xs text-muted-foreground/60 whitespace-pre-wrap',
          'scrollbar-thin',
          className
        )}
      >
        {children}
        {isStreaming && (
          <span className="inline-block w-0.5 h-3 ml-0.5 align-text-bottom bg-muted-foreground/40 animate-cursor-blink" />
        )}
      </div>
    </CollapsibleContent>
  );
}



