'use client';

import { FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileChangePillProps {
  filename: string;
  linesAdded: number;
  linesRemoved: number;
  onClick?: () => void;
  className?: string;
}

/**
 * FileChangePill - Cursor 2.0 style file change indicator
 * Shows filename with +/- line counts
 */
export function FileChangePill({ 
  filename, 
  linesAdded, 
  linesRemoved, 
  onClick,
  className 
}: FileChangePillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 my-1.5 px-3 py-1.5",
        "rounded-lg bg-muted/50 border border-border",
        "hover:border-accent/50 hover:bg-muted transition-colors",
        "text-xs",
        onClick && "cursor-pointer",
        className
      )}
    >
      <FileCode className="w-4 h-4 text-muted-foreground" />
      <span className="font-medium text-foreground">{filename}</span>
      <span className="text-status-success font-mono">+{linesAdded}</span>
      <span className="text-status-error font-mono">-{linesRemoved}</span>
    </button>
  );
}







