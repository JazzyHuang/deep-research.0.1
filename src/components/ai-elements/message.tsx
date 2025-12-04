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
 * Redesigned for Deep Research stream layout:
 * - User messages: left-aligned, no avatar, subtle bubble
 * - Assistant messages: full-width, no avatar, no bubble (stream style)
 */
export function Message({ children, from, className }: MessageProps) {
  return (
    <MessageContext.Provider value={{ from }}>
      <div
        className={cn(
          'message-enter',
          from === 'user' && 'w-full',
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
 * MessageAvatar - Not used in stream layout
 * Both user and assistant messages don't show avatars for cleaner flow
 */
export function MessageAvatar({ className }: MessageAvatarProps) {
  // Don't render avatars in stream layout for cleaner flow
  return null;
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
 * Stream layout design:
 * - User messages: left-aligned subtle bubble
 * - Assistant messages: no bubble, clean stream output
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
    <div className={cn('w-full', className)}>
      <div className={cn(
        effectiveVariant === 'contained' && from === 'user' && [
          'inline-block',
          'bg-primary/8 dark:bg-primary/12',
          'rounded-2xl px-5 py-3.5',
          'border border-primary/15',
          'shadow-sm',
          'text-[0.9375rem] text-foreground'
        ],
        effectiveVariant === 'plain' && from === 'assistant' && [
          'text-[0.9375rem] text-foreground leading-relaxed'
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
  className?: string;
}

/**
 * UserMessageWrapper - Convenient wrapper for user messages (no avatar)
 */
export function UserMessageWrapper({ children, className }: UserMessageWrapperProps) {
  return (
    <Message from="user" className={className}>
      <MessageContent variant="contained">
        {children}
      </MessageContent>
    </Message>
  );
}
