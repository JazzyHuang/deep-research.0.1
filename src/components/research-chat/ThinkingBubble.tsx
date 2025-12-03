'use client';

import { useState, useEffect, useRef } from 'react';
import { Brain, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThinkingBubbleProps {
  content: string;
  title?: string;
  isStreaming?: boolean;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

/**
 * ThinkingBubble - Displays AI thinking/reasoning process
 * With streaming animation and collapsible support
 */
export function ThinkingBubble({
  content,
  title = '思考中',
  isStreaming = false,
  isCollapsible = true,
  defaultExpanded = true,
  className,
}: ThinkingBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming]);
  
  return (
    <div className={cn(
      "rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10",
      "overflow-hidden transition-all duration-300",
      className
    )}>
      {/* Header */}
      <button
        onClick={() => isCollapsible && setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-2 px-4 py-3",
          "text-left transition-colors",
          isCollapsible && "hover:bg-primary/5 cursor-pointer"
        )}
        disabled={!isCollapsible}
      >
        {/* Icon with animation */}
        <div className="relative">
          <Brain className={cn(
            "w-4 h-4 text-primary",
            isStreaming && "animate-pulse"
          )} />
          {isStreaming && (
            <Sparkles className="absolute -top-1 -right-1 w-2.5 h-2.5 text-primary animate-ping" />
          )}
        </div>
        
        {/* Title */}
        <span className="text-sm font-medium text-foreground flex-1">
          {title}
          {isStreaming && (
            <span className="ml-2 text-xs text-muted-foreground">
              正在分析...
            </span>
          )}
        </span>
        
        {/* Expand/Collapse icon */}
        {isCollapsible && (
          <div className="text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
        )}
      </button>
      
      {/* Content */}
      {isExpanded && (
        <div
          ref={contentRef}
          className={cn(
            "px-4 pb-4 overflow-y-auto",
            "max-h-[300px]",
            "scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent"
          )}
        >
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {content}
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-primary/70 animate-blink" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ThinkingStep - A single step in the thinking process
 */
interface ThinkingStepProps {
  step: number;
  title: string;
  content: string;
  status: 'pending' | 'running' | 'complete';
  className?: string;
}

export function ThinkingStep({
  step,
  title,
  content,
  status,
  className,
}: ThinkingStepProps) {
  return (
    <div className={cn(
      "flex gap-3 py-2",
      status === 'pending' && "opacity-50",
      className
    )}>
      {/* Step number */}
      <div className={cn(
        "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
        status === 'complete' && "bg-primary/20 text-primary",
        status === 'running' && "bg-primary text-primary-foreground animate-pulse",
        status === 'pending' && "bg-muted text-muted-foreground"
      )}>
        {step}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium",
          status === 'complete' && "text-foreground",
          status === 'running' && "text-primary",
          status === 'pending' && "text-muted-foreground"
        )}>
          {title}
        </p>
        {content && status !== 'pending' && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {content}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * ThinkingTimeline - Multi-step thinking visualization
 */
interface ThinkingTimelineProps {
  steps: Array<{
    id: string;
    title: string;
    content: string;
    status: 'pending' | 'running' | 'complete';
  }>;
  isCollapsed?: boolean;
  className?: string;
}

export function ThinkingTimeline({
  steps,
  isCollapsed = false,
  className,
}: ThinkingTimelineProps) {
  const [expanded, setExpanded] = useState(!isCollapsed);
  const runningStep = steps.find(s => s.status === 'running');
  const completedCount = steps.filter(s => s.status === 'complete').length;
  
  return (
    <div className={cn(
      "rounded-xl border border-border bg-card overflow-hidden",
      className
    )}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="relative">
          <Brain className={cn(
            "w-4 h-4",
            runningStep ? "text-primary animate-pulse" : "text-muted-foreground"
          )} />
        </div>
        
        <span className="text-sm font-medium flex-1 text-left">
          {runningStep ? runningStep.title : `分析完成 (${completedCount}/${steps.length})`}
        </span>
        
        <span className="text-xs text-muted-foreground">
          {completedCount}/{steps.length}
        </span>
        
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      
      {/* Steps */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border">
          {steps.map((step, index) => (
            <ThinkingStep
              key={step.id}
              step={index + 1}
              title={step.title}
              content={step.content}
              status={step.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}



