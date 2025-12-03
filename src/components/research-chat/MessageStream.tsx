'use client';

import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { AgentTimeline } from './AgentTimeline';
import { BaseCard } from '@/components/cards';
import type { Message } from '@/types/conversation';
import type { InteractiveCard } from '@/types/cards';

interface MessageStreamProps {
  messages: Message[];
  cards: Map<string, InteractiveCard>;
  onCardClick: (cardId: string) => void;
  onCheckpointAction: (checkpointId: string, action: string) => void;
}

export function MessageStream({
  messages,
  cards,
  onCardClick,
  onCheckpointAction,
}: MessageStreamProps) {
  return (
    <div className="space-y-4">
      {messages.map((message) => {
        switch (message.type) {
          case 'user':
            return (
              <UserMessage
                key={message.id}
                content={message.content || ''}
                timestamp={message.timestamp}
              />
            );
            
          case 'assistant':
            return (
              <AssistantMessage
                key={message.id}
                content={message.content || ''}
                timestamp={message.timestamp}
                isStreaming={message.isStreaming}
              />
            );
            
          case 'agent_progress':
            return message.progress ? (
              <AgentTimeline
                key={message.id}
                progress={message.progress}
              />
            ) : null;
            
          case 'card':
            if (!message.card) return null;
            const card = cards.get(message.card.id) || message.card;
            return (
              <BaseCard
                key={message.id}
                card={card}
                onTitleClick={() => onCardClick(card.id)}
                onAction={(action) => {
                  if (card.isCheckpoint && card.checkpointId) {
                    onCheckpointAction(card.checkpointId, action);
                  }
                }}
              />
            );
            
          case 'checkpoint':
            // Checkpoints are rendered through their associated cards
            // or as standalone prompts if no card is associated
            if (message.checkpoint && !message.checkpoint.cardId) {
              return (
                <div
                  key={message.id}
                  className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-sm font-medium text-amber-500">
                      {message.checkpoint.title}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {message.checkpoint.description}
                  </p>
                  <div className="flex gap-2">
                    {message.checkpoint.options.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => onCheckpointAction(message.checkpoint!.id, option.action)}
                        className={`
                          px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                          ${option.variant === 'primary' 
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                            : option.variant === 'secondary'
                            ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                            : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
                          }
                        `}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
            
          default:
            return null;
        }
      })}
    </div>
  );
}







