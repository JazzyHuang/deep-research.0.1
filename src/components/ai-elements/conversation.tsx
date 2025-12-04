'use client';

import * as React from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

// ============================================================================
// Conversation Context
// ============================================================================

interface ConversationContextValue {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  scrollToBottom: () => void;
  isAtBottom: boolean;
}

const ConversationContext = React.createContext<ConversationContextValue | null>(null);

function useConversation() {
  const context = React.useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within a Conversation');
  }
  return context;
}

// ============================================================================
// Conversation
// ============================================================================

interface ConversationProps {
  children: React.ReactNode;
  className?: string;
}

export function Conversation({ children, className }: ConversationProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  
  const scrollToBottom = React.useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, []);
  
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    setIsAtBottom(isBottom);
  }, []);
  
  return (
    <ConversationContext.Provider value={{ scrollRef, scrollToBottom, isAtBottom }}>
      <div 
        className={cn('flex flex-col h-full relative', className)}
        onScroll={handleScroll}
      >
        {children}
      </div>
    </ConversationContext.Provider>
  );
}

// ============================================================================
// ConversationContent
// ============================================================================

interface ConversationContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ConversationContent({ children, className }: ConversationContentProps) {
  const { scrollRef } = useConversation();
  
  return (
    <ScrollArea 
      ref={scrollRef}
      className={cn('flex-1', className)}
    >
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {children}
      </div>
    </ScrollArea>
  );
}

// ============================================================================
// ConversationScrollButton
// ============================================================================

interface ConversationScrollButtonProps {
  className?: string;
}

export function ConversationScrollButton({ className }: ConversationScrollButtonProps) {
  const { scrollToBottom, isAtBottom } = useConversation();
  
  if (isAtBottom) return null;
  
  return (
    <Button
      variant="outline"
      size="icon"
      className={cn(
        'absolute bottom-24 right-6 rounded-full shadow-lg',
        'bg-background/95 backdrop-blur',
        className
      )}
      onClick={scrollToBottom}
    >
      <ChevronDown className="h-4 w-4" />
    </Button>
  );
}

// ============================================================================
// ConversationEmptyState
// ============================================================================

interface ConversationEmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function ConversationEmptyState({
  title = 'Start a conversation',
  description = 'Send a message to begin',
  icon,
  className,
}: ConversationEmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center h-full text-center py-12',
      className
    )}>
      <div className="mb-4 text-muted-foreground/40">
        {icon || <MessageSquare className="h-12 w-12" />}
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}






