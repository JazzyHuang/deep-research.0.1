'use client';

import { ExternalLink, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SourcePartProps {
  sourceId: string;
  url: string;
  title?: string;
  className?: string;
}

/**
 * SourcePart - Renders source/citation references
 * 
 * Features:
 * - Clickable link to source
 * - Displays title or URL
 * - Visual indicator for external links
 */
export function SourcePart({ 
  sourceId, 
  url, 
  title,
  className 
}: SourcePartProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md',
        'text-xs text-muted-foreground',
        'bg-muted/50 hover:bg-muted transition-colors',
        'border border-border/50',
        className
      )}
    >
      <FileText className="w-3 h-3" />
      <span className="max-w-[200px] truncate">
        {title || url}
      </span>
      <ExternalLink className="w-3 h-3 opacity-50" />
    </a>
  );
}

export default SourcePart;







