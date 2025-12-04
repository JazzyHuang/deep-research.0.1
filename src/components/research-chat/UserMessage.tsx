'use client';

import { cn } from '@/lib/utils';

interface UserMessageProps {
  content: string;
  timestamp?: number;
  className?: string;
}

/**
 * UserMessage - Clean left-aligned style
 * Features: Subtle bubble container, consistent width, no avatar
 */
export function UserMessage({ content, className }: UserMessageProps) {
  return (
    <div className={cn("py-4 message-enter", className)}>
      {/* User message: left-aligned, subtle bubble, consistent width */}
      <div className={cn(
        "inline-block",
        "rounded-2xl",
        "bg-primary/8 dark:bg-primary/12",
        "px-5 py-3.5",
        "border border-primary/15",
        "shadow-sm",
        "transition-all duration-200"
      )}>
        <p className="text-[0.9375rem] text-foreground whitespace-pre-wrap leading-relaxed">
          {content}
        </p>
      </div>
    </div>
  );
}
