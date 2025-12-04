'use client';

import { useState, useCallback } from 'react';
import { 
  HoverCard, 
  HoverCardContent, 
  HoverCardTrigger 
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { 
  ExternalLink, 
  Copy, 
  Check, 
  BookOpen, 
  Users, 
  Calendar,
  FileText,
  Quote
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Citation } from '@/types/research';

interface CitationHoverCardProps {
  /** Citation number (1-indexed) */
  number: number;
  /** Citation data */
  citation?: Citation;
  /** Click handler */
  onClick?: () => void;
  /** Custom trigger element */
  children?: React.ReactNode;
  /** Style variant */
  variant?: 'superscript' | 'bracket' | 'badge';
  className?: string;
}

/**
 * CitationHoverCard - Modern citation with hover preview
 * 
 * Displays an interactive citation that reveals paper details on hover.
 * Supports multiple display variants (superscript, bracket, badge).
 */
export function CitationHoverCard({
  number,
  citation,
  onClick,
  children,
  variant = 'superscript',
  className,
}: CitationHoverCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!citation) return;
    
    const text = `${citation.title} - ${citation.authors.join(', ')} (${citation.year})`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [citation]);

  const handleOpenSource = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!citation) return;
    
    const url = citation.doi 
      ? `https://doi.org/${citation.doi}` 
      : citation.url;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [citation]);

  // Default trigger based on variant
  const trigger = children || (
    <span className={cn(
      'citation-trigger cursor-pointer transition-all duration-150',
      variant === 'superscript' && [
        'inline-flex items-center justify-center',
        'text-[0.65em] font-medium',
        'min-w-[1.2em] h-[1.2em]',
        'align-super',
        'text-primary/80 hover:text-primary',
        'hover:underline underline-offset-2',
      ],
      variant === 'bracket' && [
        'text-xs font-mono',
        'text-primary/70 hover:text-primary',
        'before:content-["["] after:content-["]"]',
      ],
      variant === 'badge' && [
        'inline-flex items-center justify-center',
        'text-[10px] font-medium',
        'px-1.5 py-0.5 rounded-md',
        'bg-primary/10 text-primary',
        'hover:bg-primary/20',
      ],
      className
    )}>
      {number}
    </span>
  );

  if (!citation) {
    return trigger;
  }

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild onClick={onClick}>
        {trigger}
      </HoverCardTrigger>
      <HoverCardContent 
        className={cn(
          'w-80 p-0 overflow-hidden',
          'glass-card',
          'hover-card-content'
        )}
        side="top"
        align="center"
        sideOffset={8}
      >
        {/* Header with number */}
        <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">
              [{number}]
            </Badge>
            <span className="text-xs text-muted-foreground">
              引用来源
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <h4 className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {citation.title}
          </h4>

          {/* Authors */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-1">
              {citation.authors.slice(0, 3).join(', ')}
              {citation.authors.length > 3 && ` +${citation.authors.length - 3}`}
            </span>
          </div>

          {/* Year & Journal */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {citation.year}
            </span>
            {citation.journal && (
              <span className="flex items-center gap-1.5 truncate">
                <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate italic">{citation.journal}</span>
              </span>
            )}
          </div>

          {/* Journal info if available */}
          {citation.journal && (
            <div className="pt-2 border-t border-border/50">
              <div className="flex gap-2 text-xs">
                <Quote className="w-3.5 h-3.5 text-primary/60 flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground italic line-clamp-2">
                  {citation.journal}
                  {citation.volume && `, Vol. ${citation.volume}`}
                  {citation.pages && `, pp. ${citation.pages}`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-2.5 border-t border-border/50 bg-muted/20 flex items-center justify-between">
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md',
              'text-xs text-muted-foreground',
              'hover:text-foreground hover:bg-muted/50',
              'transition-colors duration-150'
            )}
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-primary" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                复制
              </>
            )}
          </button>

          {(citation.doi || citation.url) && (
            <button
              onClick={handleOpenSource}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md',
                'text-xs text-primary',
                'hover:bg-primary/10',
                'transition-colors duration-150'
              )}
            >
              <ExternalLink className="w-3 h-3" />
              查看来源
            </button>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * InlineCitationGroup - Group multiple citations together
 */
interface InlineCitationGroupProps {
  numbers: number[];
  citations: Map<number, Citation>;
  onCitationClick?: (number: number) => void;
}

export function InlineCitationGroup({ 
  numbers, 
  citations, 
  onCitationClick 
}: InlineCitationGroupProps) {
  // Sort numbers and format as range if consecutive
  const sorted = [...numbers].sort((a, b) => a - b);
  
  // Check if all consecutive
  const isConsecutive = sorted.every((n, i) => 
    i === 0 || n === sorted[i - 1] + 1
  );
  
  if (isConsecutive && sorted.length > 2) {
    // Show as range: [1-5]
    return (
      <span className="citation-group text-xs font-mono text-primary/70">
        [{sorted[0]}-{sorted[sorted.length - 1]}]
      </span>
    );
  }
  
  // Show individual citations
  return (
    <span className="citation-group">
      {sorted.map((num, i) => (
        <span key={num}>
          <CitationHoverCard
            number={num}
            citation={citations.get(num)}
            onClick={() => onCitationClick?.(num)}
            variant="superscript"
          />
          {i < sorted.length - 1 && (
            <span className="text-[0.65em] align-super text-muted-foreground">,</span>
          )}
        </span>
      ))}
    </span>
  );
}

export default CitationHoverCard;

