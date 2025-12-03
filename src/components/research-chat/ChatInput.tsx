'use client';

import { useRef, useEffect, useState } from 'react';
import { ArrowUp, Square, Paperclip, Bot, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InputButtonMode } from '@/types/agent';

interface AttachedFile {
  id: string;
  name: string;
  type: 'paper' | 'document' | 'file';
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  buttonMode: InputButtonMode;
  disabled?: boolean;
  placeholder?: string;
  attachedFiles?: AttachedFile[];
  onRemoveFile?: (fileId: string) => void;
  onAttachFile?: () => void;
}

/**
 * ChatInput - Cursor 2.0 Composer style
 * Features: context pills, mode selector, model dropdown, attachment button
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  buttonMode,
  disabled,
  placeholder = 'Plan, search, build anything...',
  attachedFiles = [],
  onRemoveFile,
  onAttachFile,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode] = useState<'agent' | 'chat'>('agent');
  
  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${Math.max(40, newHeight)}px`;
    }
  }, [value]);
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
    // Escape to stop agent
    if (e.key === 'Escape' && buttonMode === 'stop') {
      e.preventDefault();
      onSubmit();
    }
  };
  
  const isStopMode = buttonMode === 'stop';
  const hasContent = value.trim().length > 0;
  
  return (
    <div className="space-y-1">
      {/* Main Input Container - Cursor style */}
      <div className={cn(
        "rounded-xl border bg-card transition-colors",
        "border-border focus-within:border-accent/50"
      )}>
        {/* Context Pills (attached files) */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 p-2 pb-0">
            {attachedFiles.map((file) => (
              <ContextPill
                key={file.id}
                file={file}
                onRemove={onRemoveFile ? () => onRemoveFile(file.id) : undefined}
              />
            ))}
          </div>
        )}
        
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isStopMode}
          rows={1}
          className={cn(
            "w-full bg-transparent px-3 py-3 text-sm resize-none",
            "focus:outline-none placeholder:text-muted-foreground",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "min-h-[44px] max-h-[200px]"
          )}
        />
        
        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between px-2 pb-2">
          {/* Left side - Attachment buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onAttachFile}
              disabled={isStopMode}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Right side - Mode, Send */}
          <div className="flex items-center gap-2">
            {/* Mode Selector */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              disabled={isStopMode}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{mode === 'agent' ? 'Agent' : 'Chat'}</span>
            </Button>
            
            {/* Send/Stop Button - Cursor olive style */}
            <Button
              onClick={onSubmit}
              disabled={!isStopMode && !hasContent}
              size="icon"
              className={cn(
                "h-7 w-7 rounded-lg transition-all duration-200",
                isStopMode
                  ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  : "bg-accent hover:bg-accent/90 text-accent-foreground",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {isStopMode ? (
                <Square className="h-3.5 w-3.5" fill="currentColor" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Bottom Hint - Cursor style */}
      <div className="text-center text-[10px] text-muted-foreground">
        <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">/</kbd> for commands · <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">@</kbd> for context
      </div>
    </div>
  );
}

/**
 * ContextPill - File attachment pill component
 */
function ContextPill({ 
  file, 
  onRemove 
}: { 
  file: AttachedFile; 
  onRemove?: () => void;
}) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-1 text-xs",
      "bg-muted/50 rounded-full border border-border",
      "text-foreground"
    )}>
      <FileText className="w-3 h-3 text-muted-foreground" />
      <span className="max-w-[100px] truncate">{file.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:text-foreground text-muted-foreground transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
