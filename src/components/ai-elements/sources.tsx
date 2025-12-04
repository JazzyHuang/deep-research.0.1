'use client';

import * as React from 'react';
import { FileText, ExternalLink, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// ============================================================================
// Sources Context
// ============================================================================

interface SourcesContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  count: number;
}

const SourcesContext = React.createContext<SourcesContextValue | null>(null);

function useSources() {
  const context = React.useContext(SourcesContext);
  if (!context) {
    throw new Error('useSources must be used within a Sources');
  }
  return context;
}

// ============================================================================
// Sources
// ============================================================================

interface SourcesProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function Sources({ children, defaultOpen = false, className }: SourcesProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  
  // Count Source children
  const count = React.useMemo(() => {
    let sourceCount = 0;
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child)) {
        if (child.type === SourcesContent) {
          const contentChild = child as React.ReactElement<{ children?: React.ReactNode }>;
          React.Children.forEach(contentChild.props.children, (sourceChild) => {
            if (React.isValidElement(sourceChild) && sourceChild.type === Source) {
              sourceCount++;
            }
          });
        }
      }
    });
    return sourceCount;
  }, [children]);
  
  return (
    <SourcesContext.Provider value={{ isOpen, setIsOpen, count }}>
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className={cn('py-1', className)}
      >
        {children}
      </Collapsible>
    </SourcesContext.Provider>
  );
}

// ============================================================================
// SourcesTrigger
// ============================================================================

interface SourcesTriggerProps {
  children?: React.ReactNode;
  className?: string;
}

export function SourcesTrigger({ children, className }: SourcesTriggerProps) {
  const { isOpen, count } = useSources();
  
  const defaultContent = count > 0 ? `${count} source${count === 1 ? '' : 's'}` : 'Sources';
  
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
      <FileText className="w-3 h-3" />
      <span>{children || defaultContent}</span>
    </CollapsibleTrigger>
  );
}

// ============================================================================
// SourcesContent
// ============================================================================

interface SourcesContentProps {
  children: React.ReactNode;
  className?: string;
}

export function SourcesContent({ children, className }: SourcesContentProps) {
  return (
    <CollapsibleContent>
      <div className={cn(
        'ml-5 mt-2 flex flex-wrap gap-2',
        className
      )}>
        {children}
      </div>
    </CollapsibleContent>
  );
}

// ============================================================================
// Source
// ============================================================================

interface SourceProps {
  children: React.ReactNode;
  href: string;
  className?: string;
}

export function Source({ children, href, className }: SourceProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md',
        'text-xs text-muted-foreground',
        'bg-muted/50 hover:bg-muted transition-colors',
        'border border-border/50',
        'max-w-[200px]',
        className
      )}
    >
      <FileText className="w-3 h-3 shrink-0" />
      <span className="truncate">{children}</span>
      <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
    </a>
  );
}

