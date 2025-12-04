'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';

// ============================================================================
// Message Context
// ============================================================================

interface MessageContextValue {
  from: 'user' | 'assistant';
}

const MessageContext = React.createContext<MessageContextValue | null>(null);

function useMessage() {
  const context = React.useContext(MessageContext);
  if (!context) {
    throw new Error('useMessage must be used within a Message');
  }
  return context;
}

// ============================================================================
// Message
// ============================================================================

interface MessageProps {
  children: React.ReactNode;
  from: 'user' | 'assistant';
  className?: string;
}

/**
 * Message - Container for user or assistant messages
 * 
 * Redesigned for Deep Research:
 * - User messages: compact, right-aligned with small avatar
 * - Assistant messages: full-width, no avatar, clean text
 */
export function Message({ children, from, className }: MessageProps) {
  return (
    <MessageContext.Provider value={{ from }}>
      <div
        className={cn(
          'message-enter',
          from === 'user' && 'flex justify-end',
          from === 'assistant' && 'w-full',
          className
        )}
      >
        {children}
      </div>
    </MessageContext.Provider>
  );
}

// ============================================================================
// MessageAvatar
// ============================================================================

interface MessageAvatarProps {
  src?: string;
  name?: string;
  className?: string;
}

/**
 * MessageAvatar - Shows avatar for user messages only
 * Assistant messages should not use this component
 */
export function MessageAvatar({ src, name, className }: MessageAvatarProps) {
  const { from } = useMessage();
  
  // Don't render avatar for assistant messages (Cursor/Claude style)
  if (from === 'assistant') {
    return null;
  }
  
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';
  
  return (
    <Avatar className={cn('h-7 w-7 shrink-0', className)}>
      {src && <AvatarImage src={src} alt={name || 'User'} />}
      <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
        {src ? initials : <User className="h-3.5 w-3.5" />}
      </AvatarFallback>
    </Avatar>
  );
}

// ============================================================================
// MessageContent
// ============================================================================

interface MessageContentProps {
  children: React.ReactNode;
  variant?: 'plain' | 'contained';
  className?: string;
}

/**
 * MessageContent - Content wrapper with appropriate styling
 * 
 * - User messages: contained bubble style
 * - Assistant messages: plain text, no bubble
 */
export function MessageContent({ 
  children, 
  variant,
  className 
}: MessageContentProps) {
  const { from } = useMessage();
  
  // Auto-determine variant based on role if not specified
  const effectiveVariant = variant ?? (from === 'user' ? 'contained' : 'plain');
  
  return (
    <div
      className={cn(
        from === 'assistant' && 'w-full',
        from === 'user' && 'flex items-start gap-2',
        className
      )}
    >
      <div className={cn(
        effectiveVariant === 'contained' && from === 'user' && [
          'bg-primary/10 rounded-2xl px-4 py-2.5',
          'max-w-[85%] text-sm text-foreground'
        ],
        effectiveVariant === 'plain' && from === 'assistant' && [
          'text-sm text-foreground leading-relaxed'
        ]
      )}>
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// AssistantMessageWrapper
// ============================================================================

interface AssistantMessageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * AssistantMessageWrapper - Clean wrapper for assistant message content
 * No avatar, full-width content with proper spacing
 */
export function AssistantMessageWrapper({ children, className }: AssistantMessageWrapperProps) {
  return (
    <Message from="assistant" className={className}>
      <MessageContent variant="plain">
        {children}
      </MessageContent>
    </Message>
  );
}

// ============================================================================
// UserMessageWrapper
// ============================================================================

interface UserMessageWrapperProps {
  children: React.ReactNode;
  avatarSrc?: string;
  className?: string;
}

/**
 * UserMessageWrapper - Convenient wrapper for user messages with avatar
 */
export function UserMessageWrapper({ children, avatarSrc, className }: UserMessageWrapperProps) {
  return (
    <Message from="user" className={className}>
      <MessageContent variant="contained">
        {children}
      </MessageContent>
      <MessageAvatar src={avatarSrc} />
    </Message>
  );
}
