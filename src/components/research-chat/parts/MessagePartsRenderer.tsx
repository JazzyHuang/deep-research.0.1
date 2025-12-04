'use client';

import type { UIMessage } from 'ai';
import { TextPart } from './TextPart';
import { ReasoningPart } from './ReasoningPart';
import { SourcePart } from './SourcePart';
import { ToolInvocationPart } from './ToolInvocationPart';
import { DataPart } from './DataPart';

interface MessagePartsRendererProps {
  message: UIMessage;
  onCardClick?: (cardId: string) => void;
  onCheckpointAction?: (checkpointId: string, action: string) => void;
}

// Type definitions for message parts in AI SDK v5
interface TextPartType {
  type: 'text';
  text: string;
  state?: 'streaming' | 'done';
}

interface ReasoningPartType {
  type: 'reasoning';
  text: string;
  state?: 'streaming' | 'done';
}

interface SourceUrlPartType {
  type: 'source-url';
  sourceId: string;
  url: string;
  title?: string;
}

interface ToolPartType {
  type: `tool-${string}`;
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: 'input-streaming' | 'call' | 'partial-call' | 'result';
  result?: unknown;
}

interface FilePartType {
  type: 'file';
  mediaType?: string;
  filename?: string;
  url?: string;
}

interface DataPartType {
  type: `data-${string}`;
  id?: string;
  data: unknown;
}

/**
 * MessagePartsRenderer - Renders all parts of a UIMessage
 * 
 * Optimized for stream layout:
 * - Text content renders without bubble (stream style)
 * - Reasoning/thinking uses collapsible accordion
 * - Cards render with bubble styling
 * - Agent steps are filtered (rendered separately in AgentStepsBlock)
 * 
 * Supported part types:
 * - text: Regular text content (no bubble)
 * - reasoning: AI thinking/reasoning (collapsible)
 * - source-url: Citations and references
 * - tool-*: Tool calls and results
 * - data-*: Custom data parts (cards with bubble, checkpoints, etc.)
 */
export function MessagePartsRenderer({
  message,
  onCardClick,
  onCheckpointAction,
}: MessagePartsRendererProps) {
  const parts = message.parts || [];
  
  // If no parts, return null (AI SDK v5 uses parts exclusively)
  if (parts.length === 0) {
    return null;
  }
  
  return (
    <div className="stream-parts space-y-2">
      {parts.map((part, index) => {
        const key = `${message.id}-${index}`;
        
        // Type guard for part type checking
        const partType = part.type;
        
        // Handle different part types
        if (partType === 'text') {
          const textPart = part as TextPartType;
          return (
            <div key={key} className="stream-text-part">
              <TextPart 
                text={textPart.text} 
                state={textPart.state}
              />
            </div>
          );
        }
        
        if (partType === 'reasoning') {
          const reasoningPart = part as ReasoningPartType;
          return (
            <div key={key} className="stream-reasoning-part py-2">
              <ReasoningPart
                text={reasoningPart.text}
                state={reasoningPart.state}
              />
            </div>
          );
        }
        
        if (partType === 'source-url') {
          const sourceUrlPart = part as SourceUrlPartType;
          return (
            <div key={key} className="stream-source-part">
              <SourcePart
                sourceId={sourceUrlPart.sourceId}
                url={sourceUrlPart.url}
                title={sourceUrlPart.title}
              />
            </div>
          );
        }
        
        // Tool invocations (tool-* pattern)
        if (partType.startsWith('tool-')) {
          const toolPart = part as unknown as ToolPartType;
          return (
            <div key={key} className="stream-tool-part py-1">
              <ToolInvocationPart
                toolCallId={toolPart.toolCallId}
                toolName={toolPart.toolName || partType.replace('tool-', '')}
                args={toolPart.args || {}}
                state={toolPart.state || 'call'}
                result={toolPart.state === 'result' ? toolPart.result : undefined}
              />
            </div>
          );
        }
        
        // File parts (images, etc.)
        if (partType === 'file') {
          const filePart = part as FilePartType;
          // Handle file attachments
          if (filePart.url && filePart.mediaType?.startsWith('image/')) {
            return (
              <div key={key} className="stream-file-part py-2">
                <img
                  src={filePart.url}
                  alt={filePart.filename || 'Attached image'}
                  className="max-w-full h-auto rounded-xl border border-border/50"
                />
              </div>
            );
          }
          return null;
        }
        
        // Custom data-* parts (cards, checkpoints, etc.)
        if (partType.startsWith('data-')) {
          const dataPart = part as DataPartType;
          return (
            <DataPart
              key={key}
              type={dataPart.type}
              id={dataPart.id}
              data={dataPart.data}
              onCardClick={onCardClick}
              onCheckpointAction={onCheckpointAction}
            />
          );
        }
        
        // Unknown part type - log in development
        if (process.env.NODE_ENV === 'development') {
          console.warn('Unknown message part type:', partType);
        }
        return null;
      })}
    </div>
  );
}

export default MessagePartsRenderer;
