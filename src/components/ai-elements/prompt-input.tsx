'use client';

import * as React from 'react';
import { Send, Square, Loader2, ArrowUp, Paperclip, Mic } from 'lucide-react';
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
// PromptInput - Floating Capsule Design
// ============================================================================

interface PromptInputProps {
  children: React.ReactNode;
  onSubmit: () => void;
  isSubmitting?: boolean;
  isDisabled?: boolean;
  className?: string;
  /** Use floating capsule style (detached from edges) */
  variant?: 'default' | 'floating';
}

export function PromptInput({
  children,
  onSubmit,
  isSubmitting = false,
  isDisabled = false,
  className,
  variant = 'default',
}: PromptInputProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubmitting && !isDisabled) {
      onSubmit();
    }
  };
  
  const isFloating = variant === 'floating';
  
  return (
    <PromptInputContext.Provider value={{ onSubmit, isSubmitting, isDisabled }}>
      <form 
        onSubmit={handleSubmit}
        className={cn(
          'relative flex flex-col',
          // Base styles
          'transition-all duration-300 ease-out',
          // Floating variant - glassmorphism capsule
          isFloating && [
            'floating-capsule',
            'max-w-3xl mx-auto w-full',
            'glow-ambient',
          ],
          // Default variant - subtle card
          !isFloating && [
            'rounded-2xl',
            'border border-border/40',
            'bg-card/80 backdrop-blur-lg',
            'shadow-sm',
            'focus-within:border-primary/40',
            'focus-within:shadow-lg focus-within:shadow-primary/5',
          ],
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
  maxRows = 6,
}: PromptInputTextareaProps) {
  const { onSubmit, isDisabled } = usePromptInput();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  
  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const lineHeight = 24;
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
        'px-5 py-4 min-h-[52px]',
        'text-[0.9375rem] leading-relaxed',
        'placeholder:text-muted-foreground/50',
        className
      )}
    />
  );
}

// ============================================================================
// PromptInputSubmit - Modern Submit Button
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
      <button
        type="button"
        onClick={onStop}
        className={cn(
          'h-9 w-9 rounded-xl',
          'flex items-center justify-center',
          'bg-destructive/10 text-destructive',
          'hover:bg-destructive/20',
          'transition-all duration-200',
          className
        )}
      >
        <Square className="h-4 w-4" />
      </button>
    );
  }
  
  return (
    <button
      type="submit"
      disabled={isDisabled || isSubmitting}
      className={cn(
        'h-9 w-9 rounded-xl',
        'flex items-center justify-center',
        'transition-all duration-200',
        // Active state
        !isDisabled && !isSubmitting && [
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90',
          'shadow-md shadow-primary/20',
          'hover:shadow-lg hover:shadow-primary/30',
          'hover:scale-105',
          'active:scale-95',
        ],
        // Disabled state
        (isDisabled || isSubmitting) && [
          'bg-muted text-muted-foreground',
          'cursor-not-allowed',
        ],
        className
      )}
    >
      {isSubmitting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
      )}
    </button>
  );
}

// ============================================================================
// PromptInputActions - Left side action buttons
// ============================================================================

interface PromptInputActionsProps {
  children?: React.ReactNode;
  className?: string;
  showAttach?: boolean;
  showVoice?: boolean;
  onAttach?: () => void;
  onVoice?: () => void;
}

export function PromptInputActions({
  children,
  className,
  showAttach = false,
  showVoice = false,
  onAttach,
  onVoice,
}: PromptInputActionsProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {showAttach && (
        <ActionButton
          icon={<Paperclip className="h-4 w-4" />}
          onClick={onAttach}
          title="附加文件"
        />
      )}
      {showVoice && (
        <ActionButton
          icon={<Mic className="h-4 w-4" />}
          onClick={onVoice}
          title="语音输入"
        />
      )}
      {children}
    </div>
  );
}

function ActionButton({ 
  icon, 
  onClick, 
  title 
}: { 
  icon: React.ReactNode; 
  onClick?: () => void; 
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'h-8 w-8 rounded-lg',
        'flex items-center justify-center',
        'text-muted-foreground hover:text-foreground',
        'hover:bg-muted/50',
        'transition-colors duration-150'
      )}
    >
      {icon}
    </button>
  );
}

// ============================================================================
// PromptInputButton - Generic button
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
      className={cn('h-8 px-2.5 gap-1.5 rounded-lg', className)}
    >
      {icon}
      {label && <span className="text-xs font-medium">{label}</span>}
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
      'flex items-center justify-between px-4 pb-3 pt-1',
      className
    )}>
      {children}
    </div>
  );
}



