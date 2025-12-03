'use client';

interface UserMessageProps {
  content: string;
  timestamp: number;
}

/**
 * UserMessage - Cursor 2.0 style
 * Features: subtle border container, no avatar, no bubble
 */
export function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="py-4 message-enter">
      {/* User message: subtle border container, no avatar */}
      <div className="rounded-xl border border-border bg-card/50 px-4 py-3">
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {content}
        </p>
      </div>
    </div>
  );
}
