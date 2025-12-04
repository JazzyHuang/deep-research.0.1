'use client';

import * as React from 'react';
import { Brain, Search, FileText, PenTool, BarChart3, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Contextual Loader Types
// ============================================================================

export type LoaderContext = 
  | 'default'
  | 'thinking'
  | 'searching'
  | 'analyzing'
  | 'writing'
  | 'processing';

interface LoaderContextConfig {
  icon: React.ReactNode;
  text: string;
  color: string;
}

const LOADER_CONTEXTS: Record<LoaderContext, LoaderContextConfig> = {
  default: {
    icon: <Loader2 className="w-4 h-4" />,
    text: '处理中',
    color: 'text-primary',
  },
  thinking: {
    icon: <Brain className="w-4 h-4" />,
    text: '思考中',
    color: 'text-primary',
  },
  searching: {
    icon: <Search className="w-4 h-4" />,
    text: '检索中',
    color: 'text-blue-500',
  },
  analyzing: {
    icon: <BarChart3 className="w-4 h-4" />,
    text: '分析中',
    color: 'text-amber-500',
  },
  writing: {
    icon: <PenTool className="w-4 h-4" />,
    text: '撰写中',
    color: 'text-green-500',
  },
  processing: {
    icon: <FileText className="w-4 h-4" />,
    text: '处理中',
    color: 'text-primary',
  },
};

// ============================================================================
// Loader
// ============================================================================

interface LoaderProps {
  text?: string;
  context?: LoaderContext;
  className?: string;
  variant?: 'dots' | 'spinner' | 'pulse';
}

/**
 * Loader - Contextual loading indicator for AI responses
 * 
 * Features:
 * - Context-aware icons and text
 * - Multiple animation variants
 * - Shows current action being performed
 */
export function Loader({ 
  text, 
  context = 'default', 
  className,
  variant = 'spinner'
}: LoaderProps) {
  const config = LOADER_CONTEXTS[context];
  const displayText = text ?? config.text;
  
  return (
    <div className={cn(
      'flex items-center gap-3 py-3',
      className
    )}>
      {/* Icon with animation */}
      <div className={cn(
        'flex-shrink-0',
        config.color,
        variant === 'spinner' && 'animate-spin',
        variant === 'pulse' && 'animate-pulse'
      )}>
        {variant === 'dots' ? (
          <LoaderDots />
        ) : (
          config.icon
        )}
      </div>
      
      {/* Text with animated dots */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <span>{displayText}</span>
        <AnimatedEllipsis />
      </div>
    </div>
  );
}

// ============================================================================
// Animated Ellipsis
// ============================================================================

function AnimatedEllipsis() {
  return (
    <span className="inline-flex w-6">
      <span className="animate-ellipsis-dot" style={{ animationDelay: '0ms' }}>.</span>
      <span className="animate-ellipsis-dot" style={{ animationDelay: '200ms' }}>.</span>
      <span className="animate-ellipsis-dot" style={{ animationDelay: '400ms' }}>.</span>
    </span>
  );
}

// ============================================================================
// Loader Dots
// ============================================================================

function LoaderDots() {
  return (
    <div className="flex gap-1">
      <span 
        className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" 
        style={{ animationDelay: '0ms' }} 
      />
      <span 
        className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" 
        style={{ animationDelay: '150ms' }} 
      />
      <span 
        className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" 
        style={{ animationDelay: '300ms' }} 
      />
    </div>
  );
}

// ============================================================================
// Skeleton Loader for Cards
// ============================================================================

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-border/50 bg-card overflow-hidden',
      'animate-in fade-in duration-300',
      className
    )}>
      {/* Header skeleton */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <div className="w-4 h-4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
        <div className="ml-auto w-4 h-4 rounded bg-muted animate-pulse" />
      </div>
      
      {/* Content skeleton */}
      <div className="px-4 py-3 space-y-3">
        <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
        <div className="flex gap-2 mt-4">
          <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
          <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Research Loader - Full page/section loading state
// ============================================================================

interface ResearchLoaderProps {
  stage?: string;
  message?: string;
  className?: string;
}

export function ResearchLoader({ stage, message, className }: ResearchLoaderProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 text-center',
      className
    )}>
      {/* Animated icon */}
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Brain className="w-8 h-8 text-primary animate-pulse" />
        </div>
        {/* Rotating ring */}
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
      </div>
      
      {/* Stage indicator */}
      {stage && (
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 rounded-full bg-primary/10">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-medium text-primary">{stage}</span>
        </div>
      )}
      
      {/* Message */}
      <p className="text-sm text-muted-foreground">
        {message || '正在准备深度研究...'}
      </p>
    </div>
  );
}

export default Loader;
