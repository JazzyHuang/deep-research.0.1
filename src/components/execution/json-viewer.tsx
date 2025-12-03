'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface JsonViewerProps {
  data: unknown;
  className?: string;
  maxHeight?: string;
  collapsed?: boolean;
  label?: string;
}

export function JsonViewer({ 
  data, 
  className, 
  maxHeight = '200px',
  collapsed = false,
  label 
}: JsonViewerProps) {
  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);
  const lineCount = jsonString.split('\n').length;
  const isLarge = lineCount > 10;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (data === undefined || data === null) {
    return (
      <span className="text-xs text-muted-foreground italic">
        {data === null ? 'null' : 'undefined'}
      </span>
    );
  }

  return (
    <div className={cn('relative group', className)}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        </div>
      )}
      
      {isLarge && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          <span>{isExpanded ? 'Collapse' : `Expand (${lineCount} lines)`}</span>
        </button>
      )}
      
      <div 
        className={cn(
          'overflow-hidden transition-all duration-200',
          !isExpanded && isLarge && 'max-h-[100px]'
        )}
        style={{ maxHeight: isExpanded ? maxHeight : undefined }}
      >
        <pre className="text-xs font-mono bg-muted/50 rounded-md p-3 overflow-auto">
          <code className="text-foreground/80">
            <JsonSyntaxHighlight json={jsonString} />
          </code>
        </pre>
      </div>
      
      {!isExpanded && isLarge && (
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      )}
    </div>
  );
}

function JsonSyntaxHighlight({ json }: { json: string }) {
  // Simple syntax highlighting
  const highlighted = json
    .replace(/"([^"]+)":/g, '<span class="text-primary">"$1"</span>:')
    .replace(/: "([^"]*)"([,\n])/g, ': <span class="text-emerald-600 dark:text-emerald-400">"$1"</span>$2')
    .replace(/: (\d+)([,\n])/g, ': <span class="text-amber-600 dark:text-amber-400">$1</span>$2')
    .replace(/: (true|false)([,\n])/g, ': <span class="text-purple-600 dark:text-purple-400">$1</span>$2')
    .replace(/: (null)([,\n])/g, ': <span class="text-muted-foreground">$1</span>$2');

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
}

interface CompactJsonProps {
  data: unknown;
  maxLength?: number;
  className?: string;
}

export function CompactJson({ data, maxLength = 100, className }: CompactJsonProps) {
  const json = JSON.stringify(data);
  const truncated = json.length > maxLength;
  const displayJson = truncated ? json.slice(0, maxLength) + '...' : json;

  return (
    <code className={cn('text-xs font-mono text-muted-foreground', className)}>
      {displayJson}
    </code>
  );
}









