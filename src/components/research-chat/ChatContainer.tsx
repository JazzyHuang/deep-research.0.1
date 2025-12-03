'use client';

import { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageStream } from './MessageStream';
import { ChatInput } from './ChatInput';
import type { Message, CheckpointData } from '@/types/conversation';
import type { InteractiveCard } from '@/types/cards';
import type { AgentExecutionState, InputButtonMode } from '@/types/agent';

interface ChatContainerProps {
  messages: Message[];
  cards: Map<string, InteractiveCard>;
  agentState: AgentExecutionState;
  inputValue: string;
  buttonMode: InputButtonMode;
  inputDisabled: boolean;
  currentCheckpoint?: CheckpointData;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onCardClick: (cardId: string) => void;
  onCheckpointAction: (checkpointId: string, action: string) => void;
}

export function ChatContainer({
  messages,
  cards,
  agentState,
  inputValue,
  buttonMode,
  inputDisabled,
  currentCheckpoint,
  onInputChange,
  onSubmit,
  onCardClick,
  onCheckpointAction,
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Messages Area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <MessageStream
            messages={messages}
            cards={cards}
            onCardClick={onCardClick}
            onCheckpointAction={onCheckpointAction}
          />
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      
      {/* Input Area */}
      <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <ChatInput
            value={inputValue}
            onChange={onInputChange}
            onSubmit={onSubmit}
            buttonMode={buttonMode}
            disabled={inputDisabled}
            placeholder={
              agentState === 'awaiting_checkpoint'
                ? '输入反馈或点击上方按钮继续...'
                : agentState === 'running'
                ? '点击停止按钮暂停...'
                : '输入指令或反馈...'
            }
          />
        </div>
      </div>
    </div>
  );
}

