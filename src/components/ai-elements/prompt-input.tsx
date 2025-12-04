'use client';

import * as React from 'react';
import { Send, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// ============================================================================
// PromptInput Context
// ============================================================================

interface PromptInputContextValue {
  onSubmit: () => void;
  isSubmitting: boolean;
  isDisabled: boolean;
}

const PromptInputContext = React.createContext<PromptInputContextValue | null>(null);

function usePromptInput() {
  const context = React.useContext(PromptInputContext);
  if (!context) {
    throw new Error('usePromptInput must be used within a PromptInput');
  }
  return context;
}

// ============================================================================
// PromptInput
// ============================================================================

interface PromptInputProps {
  children: React.ReactNode;
  onSubmit: () => void;
  isSubmitting?: boolean;
  isDisabled?: boolean;
  className?: string;
}

export function PromptInput({
  children,
  onSubmit,
  isSubmitting = false,
  isDisabled = false,
  className,
}: PromptInputProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubmitting && !isDisabled) {
      onSubmit();
    }
  };
  
  return (
    <PromptInputContext.Provider value={{ onSubmit, isSubmitting, isDisabled }}>
      <form 
        onSubmit={handleSubmit}
        className={cn(
          'relative flex flex-col gap-2',
          'rounded-2xl border border-border/50',
          'bg-background/95 backdrop-blur',
          'shadow-sm',
          'transition-all duration-200',
          'focus-within:border-primary/50 focus-within:shadow-md',
          className
        )}
      >
        {children}
      </form>
    </PromptInputContext.Provider>
  );
}

// ============================================================================
// PromptInputTextarea
// ============================================================================

interface PromptInputTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  maxRows?: number;
}

export function PromptInputTextarea({
  value,
  onChange,
  placeholder = 'Type a message...',
  className,
  maxRows = 5,
}: PromptInputTextareaProps) {
  const { onSubmit, isDisabled } = usePromptInput();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  
  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const lineHeight = 24; // Approximate line height
      const maxHeight = lineHeight * maxRows;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, [value, maxRows]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };
  
  return (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={isDisabled}
      rows={1}
      className={cn(
        'resize-none border-0 bg-transparent shadow-none',
        'focus-visible:ring-0 focus-visible:ring-offset-0',
        'px-4 py-3 min-h-[48px]',
        'placeholder:text-muted-foreground/60',
        className
      )}
    />
  );
}

// ============================================================================
// PromptInputSubmit
// ============================================================================

interface PromptInputSubmitProps {
  className?: string;
  showStop?: boolean;
  onStop?: () => void;
}

export function PromptInputSubmit({ 
  className,
  showStop = false,
  onStop,
}: PromptInputSubmitProps) {
  const { isSubmitting, isDisabled } = usePromptInput();
  
  if (showStop && isSubmitting) {
    return (
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onStop}
        className={cn('h-8 w-8 rounded-full', className)}
      >
        <Square className="h-4 w-4" />
      </Button>
    );
  }
  
  return (
    <Button
      type="submit"
      size="icon"
      variant="ghost"
      disabled={isDisabled || isSubmitting}
      className={cn(
        'h-8 w-8 rounded-full',
        'hover:bg-primary hover:text-primary-foreground',
        'disabled:opacity-50',
        className
      )}
    >
      {isSubmitting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
    </Button>
  );
}

// ============================================================================
// PromptInputButton
// ============================================================================

interface PromptInputButtonProps {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  label?: string;
  onClick?: () => void;
  className?: string;
}

export function PromptInputButton({
  children,
  icon,
  label,
  onClick,
  className,
}: PromptInputButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onClick}
      className={cn('h-8 px-2 gap-1.5', className)}
    >
      {icon}
      {label && <span className="text-xs">{label}</span>}
      {children}
    </Button>
  );
}

// ============================================================================
// PromptInputFooter
// ============================================================================

interface PromptInputFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function PromptInputFooter({ children, className }: PromptInputFooterProps) {
  return (
    <div className={cn(
      'flex items-center justify-between px-3 pb-2',
      className
    )}>
      {children}
    </div>
  );
}



