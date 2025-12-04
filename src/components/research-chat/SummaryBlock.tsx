'use client';

import { cn } from '@/lib/utils';
import type { SummaryBlockData } from '@/types/conversation';

interface SummaryBlockProps {
  data: SummaryBlockData;
  className?: string;
}

/**
 * SummaryBlock - White/foreground key summaries with left accent
 * No full container, just left border accent
 */
export function SummaryBlock({ data, className }: SummaryBlockProps) {
  return (
    <div className={cn(
      "py-3 pl-4 my-3",
      "border-l-2 border-primary/60",
      "summary-block-enter",
      className
    )}>
      {/* Optional Title */}
      {data.title && (
        <div className="text-xs font-medium text-primary/80 uppercase tracking-wider mb-1.5">
          {data.title}
        </div>
      )}
      
      {/* Main Content */}
      <div className="summary-text">
        {data.content}
      </div>
      
      {/* Bullet Points */}
      {data.bulletPoints && data.bulletPoints.length > 0 && (
        <ul className="mt-2 space-y-1">
          {data.bulletPoints.map((point, index) => (
            <li 
              key={index}
              className="flex items-start gap-2 text-sm text-foreground/90"
            >
              <span className="text-primary/60 mt-1">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SummaryBlock;







