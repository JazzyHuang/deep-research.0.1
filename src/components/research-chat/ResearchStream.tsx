'use client';

import { useMemo } from 'react';
import type { UIMessage } from 'ai';
import type { InteractiveCard, CheckpointData, AgentStepData, AgentEventData } from '@/types/ui-message';
import { cn } from '@/lib/utils';
import { AgentStepInline } from './AgentStepInline';
import { StageGroup } from './StageGroup';
import { BaseCard } from '@/components/cards';
import { TextPart } from './parts/TextPart';
import { ReasoningPart } from './parts/ReasoningPart';
import { SourcePart } from './parts/SourcePart';
import { createCheckpointActions } from '@/types/cards';

// ============================================================================
// Types
// ============================================================================

type StreamItemType = 
  | 'user-message' 
  | 'agent-step' 
  | 'agent-event-group'
  | 'card' 
  | 'text' 
  | 'reasoning'
  | 'source';

interface StreamItem {
  id: string;
  type: StreamItemType;
  data: unknown;
}

interface ResearchStreamProps {
  messages: UIMessage[];
  cards: Map<string, InteractiveCard>;
  currentCheckpoint?: CheckpointData;
  /** Unified agent events for SOTA timeline */
  agentEvents?: AgentEventData[];
  onCardClick?: (cardId: string) => void;
  onCheckpointAction?: (checkpointId: string, action: string) => void;
  locale?: 'en' | 'zh';
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getUserMessageText(message: UIMessage): string {
  if (message.parts) {
    const textParts = message.parts.filter(p => p.type === 'text');
    if (textParts.length > 0) {
      return textParts.map(p => (p as { text: string }).text).join(' ');
    }
  }
  return '';
}

// Card types that should be rendered as interactive cards
const CARD_PART_TYPES = ['data-plan', 'data-paper-list', 'data-quality', 'data-document'];

// Parts to skip (handled elsewhere or not displayed)
const SKIP_PART_TYPES = [
  'data-step-complete',
  'data-session-complete', 
  'data-session-error',
  'data-agent-paused',
  'data-notification',
  'data-todo',
  'data-checkpoint', // Handled at card level
  // We don't skip agent-event parts, but we handle them specifically in the loop
];

// ============================================================================
// Sub-components
// ============================================================================

function UserMessageBubble({ content }: { content: string }) {
  return (
    <div className="stream-user-message py-4">
      <div className={cn(
        "inline-block",
        "rounded-2xl",
        "bg-primary/8 dark:bg-primary/12",
        "px-5 py-3.5",
        "border border-primary/15",
        "shadow-sm"
      )}>
        <p className="text-[0.9375rem] text-foreground whitespace-pre-wrap leading-relaxed">
          {content}
        </p>
      </div>
    </div>
  );
}

/**
 * Renders a group of consecutive agent steps with shared timeline
 */
function AgentStepsGroup({ 
  steps, 
  isLastGroup 
}: { 
  steps: AgentStepData[]; 
  isLastGroup: boolean;
}) {
  if (steps.length === 0) return null;
  
  return (
    <div className="stream-agent-group py-2">
      {steps.map((step, index) => (
        <AgentStepInline
          key={step.id}
          step={step}
          isLast={index === steps.length - 1 && isLastGroup}
          showConnector={!(index === steps.length - 1 && isLastGroup)}
        />
      ))}
    </div>
  );
}

/**
 * Renders a group of agent events using StageGroup
 */
function AgentEventGroup({
  events,
  locale = 'zh'
}: {
  events: AgentEventData[];
  locale?: 'en' | 'zh';
}) {
  if (events.length === 0) return null;

  // Group events by stage to render appropriate StageGroups
  // Since this is an interleaved stream, we might have events from different stages if the stream transitions
  // e.g. Planning -> Searching within one block
  
  const groupedByStage = useMemo(() => {
    const groups: { stage: AgentEventData['stage'], events: AgentEventData[] }[] = [];
    let currentStage: AgentEventData['stage'] | null = null;
    let currentEvents: AgentEventData[] = [];

    for (const event of events) {
      if (currentStage !== event.stage) {
        if (currentStage && currentEvents.length > 0) {
          groups.push({ stage: currentStage, events: [...currentEvents] });
        }
        currentStage = event.stage;
        currentEvents = [event];
      } else {
        currentEvents.push(event);
      }
    }

    if (currentStage && currentEvents.length > 0) {
      groups.push({ stage: currentStage, events: currentEvents });
    }

    return groups;
  }, [events]);

  return (
    <div className="stream-agent-event-group py-2 space-y-2">
      {groupedByStage.map((group, index) => (
        <StageGroup
          key={`${group.stage}-${index}`}
          stage={group.stage}
          events={group.events}
          isActive={group.events.some(e => e.status === 'running')}
          locale={locale}
        />
      ))}
    </div>
  );
}

/**
 * Renders an interactive card with embedded actions
 */
function StreamCard({ 
  card,
  onCardClick,
  onAction,
}: { 
  card: InteractiveCard;
  onCardClick?: (cardId: string) => void;
  onAction?: (action: string) => void;
}) {
  // If card is a checkpoint or should show actions, add default actions based on type
  const cardWithActions: InteractiveCard = {
    ...card,
    isCheckpoint: true, // Always show actions for interactivity
    actions: card.actions || createCheckpointActions(card.type),
  };
  
  return (
    <div className="stream-card py-3">
      <BaseCard
        card={cardWithActions}
        onTitleClick={() => onCardClick?.(card.id)}
        onAction={onAction}
        animate={true}
      />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ResearchStream - True interleaved stream renderer
 * 
 * Processes message parts in sequence to achieve natural interleaving:
 * [User Message] → [Agent Steps] → [Card] → [Agent Steps] → [Card] → ...
 * 
 * Key behavior:
 * - Groups consecutive agent steps/events
 * - Renders cards inline when they appear in the stream
 * - Cards always have embedded action buttons
 * - Supports both legacy AgentSteps and SOTA AgentEvents (interleaved)
 */
export function ResearchStream({
  messages,
  cards,
  currentCheckpoint,
  agentEvents = [],
  onCardClick,
  onCheckpointAction,
  locale = 'zh',
  className,
}: ResearchStreamProps) {
  // Use unified events if available
  const hasUnifiedEvents = agentEvents.length > 0;
  
  // Create a map of latest event states for fast lookup
  const eventMap = useMemo(() => {
    return new Map(agentEvents.map(e => [e.id, e]));
  }, [agentEvents]);
  
  // Build interleaved stream items from message parts
  const streamItems = useMemo(() => {
    const items: StreamItem[] = [];
    let itemIndex = 0;
    
    // Track checkpoints to associate with cards
    const checkpointMap = new Map<string, CheckpointData>();
    
    // First pass: collect all checkpoints
    for (const message of messages) {
      if (!message.parts) continue;
      for (const part of message.parts) {
        if (part.type === 'data-checkpoint') {
          const checkpointData = (part as { data: CheckpointData }).data;
          if (checkpointData.cardId) {
            checkpointMap.set(checkpointData.cardId, checkpointData);
          }
        }
      }
    }
    
    // Also add current checkpoint
    if (currentCheckpoint?.cardId) {
      checkpointMap.set(currentCheckpoint.cardId, currentCheckpoint);
    }
    
    // Track processed events to avoid duplicates in the stream
    const seenEventIds = new Set<string>();
    
    // Second pass: build stream items
    for (const message of messages) {
      // User message
      if (message.role === 'user') {
        const text = getUserMessageText(message);
        if (text) {
          items.push({
            id: `user-${message.id}`,
            type: 'user-message',
            data: text,
          });
        }
        continue;
      }
      
      // Assistant message - process parts in order
      if (message.role === 'assistant' && message.parts) {
        let currentAgentSteps: AgentStepData[] = [];
        let currentEventIds: string[] = [];
        
        const flushAgentContent = () => {
          // Flush legacy steps
          if (currentAgentSteps.length > 0) {
            items.push({
              id: `steps-${itemIndex++}`,
              type: 'agent-step',
              data: [...currentAgentSteps],
            });
            currentAgentSteps = [];
          }
          
          // Flush unified events
          if (currentEventIds.length > 0) {
            const events = currentEventIds
              .map(id => eventMap.get(id))
              .filter((e): e is AgentEventData => !!e);
              
            if (events.length > 0) {
              items.push({
                id: `events-${itemIndex++}`,
                type: 'agent-event-group',
                data: events,
              });
            }
            currentEventIds = [];
          }
        };
        
        for (const part of message.parts) {
          const partType = part.type;
          
          // Skip certain part types
          if (SKIP_PART_TYPES.includes(partType)) {
            continue;
          }
          
          // Legacy Agent Step
          if (partType === 'data-agent-step') {
            // If we have unified events, we ignore legacy steps to avoid double rendering
            if (!hasUnifiedEvents) {
              const stepData = (part as { data: AgentStepData }).data;
              if (stepData) {
                currentAgentSteps.push(stepData);
              }
            }
            continue;
          }
          
          // Unified Agent Event (SOTA)
          // We trigger on 'data-agent-event' which signifies creation/start
          if (partType === 'data-agent-event') {
            const eventPart = part as { data: AgentEventData };
            const eventId = eventPart.data?.id;
            
            if (eventId && !seenEventIds.has(eventId)) {
              seenEventIds.add(eventId);
              currentEventIds.push(eventId);
            }
            continue;
          }
          
          // Card types - flush agent content first, then render card
          if (CARD_PART_TYPES.includes(partType)) {
            flushAgentContent();
            
            // Get card from map or build from part
            const partWithId = part as { id?: string; data: unknown };
            const cardId = partWithId.id;
            
            if (cardId) {
              let card = cards.get(cardId);
              
              if (!card) {
                // Build card from part data
                const cardType = partType.replace('data-', '').replace('-', '_') as InteractiveCard['type'];
                const partData = (partWithId.data && typeof partWithId.data === 'object') 
                  ? partWithId.data as Record<string, unknown>
                  : {};
                card = {
                  id: cardId,
                  type: cardType as InteractiveCard['type'],
                  title: getCardTitle(cardType, partWithId.data),
                  data: { type: cardType, ...partData } as InteractiveCard['data'],
                  status: 'pending',
                  isCollapsed: false,
                  isCheckpoint: false,
                  createdAt: Date.now(),
                };
              }
              
              // Check if this card has an associated checkpoint
              const checkpoint = checkpointMap.get(cardId);
              if (checkpoint && !checkpoint.resolvedAt) {
                card = {
                  ...card,
                  isCheckpoint: true,
                  checkpointId: checkpoint.id,
                  actions: checkpoint.options.map(opt => ({
                    id: opt.id,
                    label: opt.label,
                    description: opt.description,
                    variant: opt.variant,
                    action: opt.action,
                  })),
                };
              }
              
              items.push({
                id: `card-${cardId}`,
                type: 'card',
                data: card,
              });
            }
            continue;
          }
          
          // Text content
          if (partType === 'text') {
            flushAgentContent();
            
            const textPart = part as { text: string; state?: string };
            items.push({
              id: `text-${message.id}-${itemIndex++}`,
              type: 'text',
              data: textPart,
            });
            continue;
          }
          
          // Reasoning/thinking
          if (partType === 'reasoning') {
            flushAgentContent();
            
            const reasoningPart = part as { text: string; state?: string };
            items.push({
              id: `reasoning-${message.id}-${itemIndex++}`,
              type: 'reasoning',
              data: reasoningPart,
            });
            continue;
          }
          
          // Source URLs
          if (partType === 'source-url') {
            // Sources usually are attached to text, no need to flush? 
            // Or flush to keep strict order? Let's flush to be safe.
            flushAgentContent();

            const sourcePart = part as { sourceId: string; url: string; title?: string };
            items.push({
              id: `source-${message.id}-${itemIndex++}`,
              type: 'source',
              data: sourcePart,
            });
            continue;
          }
        }
        
        // Flush any remaining agent content at end of message
        flushAgentContent();
      }
    }
    
    return items;
  }, [messages, cards, currentCheckpoint, agentEvents, eventMap, hasUnifiedEvents]);
  
  // Handle card action
  const handleCardAction = (cardId: string, action: string) => {
    // Find the checkpoint associated with this card
    for (const message of messages) {
      if (!message.parts) continue;
      for (const part of message.parts) {
        if (part.type === 'data-checkpoint') {
          const checkpoint = (part as { data: CheckpointData }).data;
          if (checkpoint.cardId === cardId && !checkpoint.resolvedAt) {
            onCheckpointAction?.(checkpoint.id, action);
            return;
          }
        }
      }
    }
    
    // Also check current checkpoint
    if (currentCheckpoint?.cardId === cardId && !currentCheckpoint.resolvedAt) {
      onCheckpointAction?.(currentCheckpoint.id, action);
    }
  };
  
  return (
    <div className={cn("research-stream", className)}>
      {streamItems.map((item, index) => {
        const isLastItem = index === streamItems.length - 1;
        
        switch (item.type) {
          case 'user-message':
            return (
              <UserMessageBubble 
                key={item.id} 
                content={item.data as string} 
              />
            );
          
          case 'agent-step':
            return (
              <AgentStepsGroup 
                key={item.id} 
                steps={item.data as AgentStepData[]}
                isLastGroup={isLastItem}
              />
            );

          case 'agent-event-group':
            return (
              <AgentEventGroup
                key={item.id}
                events={item.data as AgentEventData[]}
                locale={locale}
              />
            );
          
          case 'card':
            const card = item.data as InteractiveCard;
            return (
              <StreamCard
                key={item.id}
                card={card}
                onCardClick={onCardClick}
                onAction={(action) => handleCardAction(card.id, action)}
              />
            );
          
          case 'text':
            const textData = item.data as { text: string; state?: string };
            return (
              <div key={item.id} className="stream-text-content py-1">
                <TextPart 
                  text={textData.text} 
                  state={textData.state as 'streaming' | 'done' | undefined}
                />
              </div>
            );
          
          case 'reasoning':
            const reasoningData = item.data as { text: string; state?: string };
            return (
              <div key={item.id} className="stream-reasoning py-2">
                <ReasoningPart 
                  text={reasoningData.text} 
                  state={reasoningData.state as 'streaming' | 'done' | undefined}
                />
              </div>
            );
          
          case 'source':
            const sourceData = item.data as { sourceId: string; url: string; title?: string };
            return (
              <div key={item.id} className="stream-source">
                <SourcePart 
                  sourceId={sourceData.sourceId}
                  url={sourceData.url}
                  title={sourceData.title}
                />
              </div>
            );
          
          default:
            return null;
        }
      })}
    </div>
  );
}

function getCardTitle(type: string, data: unknown): string {
  switch (type) {
    case 'plan':
      return '研究计划';
    case 'paper_list':
    case 'paper-list':
      const paperData = data as { roundNumber?: number };
      return `检索结果 · Round ${paperData?.roundNumber || 1}`;
    case 'quality':
      return '质量评估报告';
    case 'document':
      return '研究报告';
    default:
      return type;
  }
}

export default ResearchStream;
