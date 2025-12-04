'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { UIMessage } from 'ai';
import type {
  ResearchDataParts,
  CheckpointData,
  TodoData,
  InteractiveCard,
  CardType,
  InputButtonMode,
  AgentStepData,
  AgentEventData,
  AgentEventUpdateData,
  AgentEventCompleteData,
} from '@/types/ui-message';

// ============================================================================
// Types
// ============================================================================

export type ResearchStatus = 'idle' | 'ready' | 'submitted' | 'streaming' | 'error';

export interface UseResearchChatOptions {
  sessionId: string;
  initialQuery?: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export interface UseResearchChatReturn {
  // Core chat state from useChat
  messages: UIMessage[];
  status: ResearchStatus;
  error: Error | undefined;
  
  // Actions
  startResearch: (query: string) => void;
  sendMessage: (content: string) => void;
  stopResearch: () => void;
  respondToCheckpoint: (checkpointId: string, action: string, data?: Record<string, unknown>) => void;
  
  // Side panel
  openSidePanel: (cardId: string) => void;
  closeSidePanel: () => void;
  
  // Input
  inputValue: string;
  setInputValue: (value: string) => void;
  buttonMode: InputButtonMode;
  inputDisabled: boolean;
  
  // Derived state from message parts
  cards: Map<string, InteractiveCard>;
  currentCheckpoint: CheckpointData | undefined;
  agentSteps: AgentStepData[];
  /** Unified agent events (SOTA) - grouped by stage with reconciliation */
  agentEvents: AgentEventData[];
  taskProgress: TodoData;
  isComplete: boolean;
  isPaused: boolean;
  
  // Side panel state
  sidePanel: {
    isOpen: boolean;
    cardId: string | undefined;
    cardType: CardType | undefined;
  };
}

// ============================================================================
// Helper: Build InteractiveCard from data parts
// ============================================================================

function buildCardFromDataPart(
  type: 'plan' | 'paper-list' | 'quality' | 'document',
  id: string,
  data: unknown,
  existingCard?: InteractiveCard
): InteractiveCard {
  const baseCard = {
    id,
    status: 'pending' as const,
    isCollapsed: false,
    isCheckpoint: false,
    createdAt: existingCard?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  switch (type) {
    case 'plan':
      return {
        ...baseCard,
        type: 'plan' as const,
        title: '研究计划',
        data: { type: 'plan' as const, ...(data as Record<string, unknown>) },
      } as InteractiveCard;
    case 'paper-list':
      const paperData = data as { roundNumber?: number };
      return {
        ...baseCard,
        type: 'paper_list' as const,
        title: `检索结果 · Round ${paperData.roundNumber || 1}`,
        data: { type: 'paper_list' as const, ...(data as Record<string, unknown>) },
      } as InteractiveCard;
    case 'quality':
      return {
        ...baseCard,
        type: 'quality' as const,
        title: '质量评估报告',
        data: { type: 'quality' as const, ...(data as Record<string, unknown>) },
      } as InteractiveCard;
    case 'document':
      return {
        ...baseCard,
        type: 'document' as const,
        title: '研究报告',
        data: { type: 'document' as const, ...(data as Record<string, unknown>) },
      } as InteractiveCard;
    default:
      throw new Error(`Unknown card type: ${type}`);
  }
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useResearchChat({
  sessionId,
  initialQuery = '',
  onComplete,
  onError,
}: UseResearchChatOptions): UseResearchChatReturn {
  // Input state (managed locally since useChat API changed)
  const [inputValue, setInputValue] = useState('');
  
  // Side panel state
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelCardId, setSidePanelCardId] = useState<string | undefined>();
  
  // Track shown notifications to avoid duplicates
  const shownNotificationsRef = useRef<Set<string>>(new Set());
  
  // Track if initial research has been started (prevent duplicate requests)
  const hasStartedRef = useRef(false);
  
  // Create transport for API communication
  const transport = useMemo(() => new DefaultChatTransport({
    api: '/api/chat',
    body: { id: sessionId },
  }), [sessionId]);
  
  // Use AI SDK's useChat hook with new API
  const {
    messages,
    status: chatStatus,
    error,
    sendMessage: chatSendMessage,
    stop,
    clearError,
  } = useChat({
    id: sessionId,
    transport,
    onError: (err) => {
      // Classify error and provide user-friendly message
      let errorMessage = err.message;
      const msg = err.message.toLowerCase();
      
      // SOTA: Enhanced error logging with timestamp for debugging
      console.error('[ResearchChat] Original error:', err.message, 'at', new Date().toISOString());
      
      // SOTA: Detect stream interruption errors with more patterns
      // ERR_INCOMPLETE_CHUNKED_ENCODING is the most common cause of report generation failures
      if (msg.includes('incomplete') || msg.includes('chunked') || 
          msg.includes('err_incomplete_chunked_encoding') || msg.includes('err_incomplete')) {
        // Stream was interrupted - likely timeout on server side
        errorMessage = '数据流中断，报告生成可能超时。请刷新页面重试或简化研究问题';
        console.error('[ResearchChat] Stream interruption detected - likely ERR_INCOMPLETE_CHUNKED_ENCODING');
      } else if (msg.includes('aborted') || msg.includes('terminated') || msg.includes('the operation was aborted')) {
        // Request was explicitly aborted
        errorMessage = '请求被中断，可能是超时导致。请刷新页面重试';
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('socket')) {
        // Network-level errors
        errorMessage = '网络连接失败，请检查网络后重试';
      } else if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('api key')) {
        errorMessage = 'API 认证失败，请检查 API 密钥配置';
      } else if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many')) {
        errorMessage = '请求频率过高，请稍后重试';
      } else if (msg.includes('timeout') || msg.includes('timed out')) {
        errorMessage = '请求超时，请稍后重试或简化研究问题';
      } else if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
        errorMessage = '服务器错误，请稍后重试';
      }
      
      onError?.(errorMessage);
    },
    onFinish: ({ message }) => {
      // Check if session completed successfully
      if (message.parts) {
        const hasComplete = message.parts.some(
          (p: { type: string }) => p.type === 'data-session-complete'
        );
        if (hasComplete) {
          onComplete?.();
        }
      }
    },
    onData: (dataPart: { type: string; data?: unknown }) => {
      // Handle transient notifications
      if (dataPart.type === 'data-notification') {
        const notificationData = dataPart.data as ResearchDataParts['notification'];
        const notificationKey = `${notificationData.level}-${notificationData.message}`;
        
        if (!shownNotificationsRef.current.has(notificationKey)) {
          shownNotificationsRef.current.add(notificationKey);
          
          switch (notificationData.level) {
            case 'success':
              toast.success(notificationData.message);
              break;
            case 'error':
              toast.error(notificationData.message);
              break;
            case 'warning':
              toast.warning(notificationData.message);
              break;
            case 'info':
            default:
              toast.info(notificationData.message);
              break;
          }
          
          setTimeout(() => {
            shownNotificationsRef.current.delete(notificationKey);
          }, 5000);
        }
      }
      
      // Handle session errors with recovery guidance
      if (dataPart.type === 'data-session-error') {
        const errorData = dataPart.data as ResearchDataParts['session-error'];
        
        // SOTA: Check if error is recoverable and provide appropriate guidance
        const isRecoverable = (errorData as { recoverable?: boolean }).recoverable;
        
        if (isRecoverable) {
          // Show a less alarming toast for recoverable errors
          toast.warning(errorData.error, {
            description: '您可以尝试刷新页面重试',
            duration: 8000,
          });
        } else {
          toast.error(errorData.error, {
            duration: 10000,
          });
        }
        
        onError?.(errorData.error);
      }
    },
  });

  // Map chat status to research status
  const status: ResearchStatus = useMemo(() => {
    if (chatStatus === 'submitted' || chatStatus === 'streaming') {
      return chatStatus;
    }
    if (error) return 'error';
    if (messages.length === 0) return 'idle';
    return 'ready';
  }, [chatStatus, error, messages.length]);

  // Extract cards from message parts with reconciliation
  const cards = useMemo(() => {
    const cardMap = new Map<string, InteractiveCard>();
    
    for (const message of messages) {
      if (!message.parts) continue;
      
      for (const part of message.parts) {
        const partWithId = part as { type: string; id?: string; data?: unknown };
        
        // Handle plan cards
        if (part.type === 'data-plan' && partWithId.id) {
          const existingCard = cardMap.get(partWithId.id);
          cardMap.set(partWithId.id, buildCardFromDataPart(
            'plan',
            partWithId.id,
            partWithId.data,
            existingCard
          ));
        }
        
        // Handle paper list cards
        if (part.type === 'data-paper-list' && partWithId.id) {
          const existingCard = cardMap.get(partWithId.id);
          cardMap.set(partWithId.id, buildCardFromDataPart(
            'paper-list',
            partWithId.id,
            partWithId.data,
            existingCard
          ));
        }
        
        // Handle quality cards
        if (part.type === 'data-quality' && partWithId.id) {
          const existingCard = cardMap.get(partWithId.id);
          cardMap.set(partWithId.id, buildCardFromDataPart(
            'quality',
            partWithId.id,
            partWithId.data,
            existingCard
          ));
        }
        
        // Handle document cards
        if (part.type === 'data-document' && partWithId.id) {
          const existingCard = cardMap.get(partWithId.id);
          cardMap.set(partWithId.id, buildCardFromDataPart(
            'document',
            partWithId.id,
            partWithId.data,
            existingCard
          ));
        }
        
        // Handle checkpoint - link to card if present
        if (part.type === 'data-checkpoint') {
          const checkpointData = partWithId.data as CheckpointData;
          if (checkpointData.cardId) {
            const linkedCard = cardMap.get(checkpointData.cardId);
            if (linkedCard) {
              cardMap.set(checkpointData.cardId, {
                ...linkedCard,
                isCheckpoint: true,
                checkpointId: checkpointData.id,
                actions: checkpointData.options.map(opt => ({
                  id: opt.id,
                  label: opt.label,
                  description: opt.description,
                  variant: opt.variant,
                  action: opt.action,
                })),
              });
            }
          }
        }
      }
    }
    
    return cardMap;
  }, [messages]);

  // Extract current checkpoint from message parts
  const currentCheckpoint = useMemo(() => {
    // Find the latest unresolved checkpoint
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (!message.parts) continue;
      
      for (const part of message.parts) {
        if (part.type === 'data-checkpoint') {
          const checkpointPart = part as { type: 'data-checkpoint'; data: CheckpointData };
          // Check if this checkpoint is still active (not resolved)
          if (!checkpointPart.data.resolvedAt) {
            return checkpointPart.data;
          }
        }
      }
    }
    return undefined;
  }, [messages]);

  // Extract agent steps from message parts with proper reconciliation (legacy)
  const agentSteps = useMemo(() => {
    const stepsMap = new Map<string, AgentStepData>();
    
    for (const message of messages) {
      if (!message.parts) continue;
      
      for (const part of message.parts) {
        if (part.type === 'data-agent-step') {
          const stepPart = part as { type: 'data-agent-step'; id?: string; data: AgentStepData };
          if (stepPart.data?.id) {
            const existingStep = stepsMap.get(stepPart.data.id);
            // Merge with existing step data (reconciliation)
            stepsMap.set(stepPart.data.id, {
              ...existingStep,
              ...stepPart.data,
            });
          }
        }
        
        if (part.type === 'data-step-complete') {
          const completePart = part as { type: 'data-step-complete'; id?: string; data: { stepId: string; status: string; duration: number } };
          const stepId = completePart.data.stepId;
          const existingStep = stepsMap.get(stepId);
          if (existingStep) {
            stepsMap.set(stepId, {
              ...existingStep,
              status: completePart.data.status as AgentStepData['status'],
              duration: completePart.data.duration,
            });
          }
        }
      }
    }
    
    return Array.from(stepsMap.values());
  }, [messages]);

  // Extract unified agent events with reconciliation (SOTA)
  const agentEvents = useMemo(() => {
    const eventsMap = new Map<string, AgentEventData>();
    
    for (const message of messages) {
      if (!message.parts) continue;
      
      for (const part of message.parts) {
        // Handle new agent events
        if (part.type === 'data-agent-event') {
          const eventPart = part as { type: 'data-agent-event'; id?: string; data: AgentEventData };
          if (eventPart.data?.id) {
            const existingEvent = eventsMap.get(eventPart.data.id);
            // Merge with existing event data (reconciliation)
            eventsMap.set(eventPart.data.id, {
              ...existingEvent,
              ...eventPart.data,
              meta: existingEvent?.meta 
                ? { ...existingEvent.meta, ...eventPart.data.meta }
                : eventPart.data.meta,
            });
          }
        }
        
        // Handle event updates
        if (part.type === 'data-agent-event-update') {
          const updatePart = part as { type: 'data-agent-event-update'; id?: string; data: AgentEventUpdateData };
          const eventId = updatePart.data.id;
          const existingEvent = eventsMap.get(eventId);
          if (existingEvent) {
            eventsMap.set(eventId, {
              ...existingEvent,
              status: updatePart.data.status ?? existingEvent.status,
              iteration: updatePart.data.iteration ?? existingEvent.iteration,
              totalIterations: updatePart.data.totalIterations ?? existingEvent.totalIterations,
              meta: updatePart.data.meta 
                ? { ...existingEvent.meta, ...updatePart.data.meta }
                : existingEvent.meta,
              endTime: updatePart.data.endTime ?? existingEvent.endTime,
              duration: updatePart.data.duration ?? existingEvent.duration,
            });
          }
        }
        
        // Handle event completion
        if (part.type === 'data-agent-event-complete') {
          const completePart = part as { type: 'data-agent-event-complete'; id?: string; data: AgentEventCompleteData };
          const eventId = completePart.data.id;
          const existingEvent = eventsMap.get(eventId);
          if (existingEvent) {
            eventsMap.set(eventId, {
              ...existingEvent,
              status: completePart.data.status,
              duration: completePart.data.duration ?? existingEvent.duration,
              endTime: existingEvent.startTime + (completePart.data.duration || 0),
              meta: completePart.data.meta 
                ? { ...existingEvent.meta, ...completePart.data.meta }
                : existingEvent.meta,
            });
          }
        }

        // Handle agent logs
        if (part.type === 'data-agent-log') {
          const logPart = part as { type: 'data-agent-log'; id?: string; data: { eventId?: string; log: any } };
          const logData = logPart.data;
          
          // Strategy: Attach log to the most recent running event if exact ID match fails
          // This ensures logs are always shown even if IDs don't perfectly align
          
          let targetEventId: string | undefined = logData.eventId;
          
          // If exact ID not found, attach to currently running or last event
          if (!targetEventId || !eventsMap.has(targetEventId)) {
            // Find the currently running event (SOTA)
            // We assume logs belong to the active stage/event
            const runningEvent = Array.from(eventsMap.values()).reverse().find(e => e.status === 'running');
            
            if (runningEvent) {
              targetEventId = runningEvent.id;
            } else {
              // If no running event, attach to the last event
              const lastEvent = Array.from(eventsMap.values()).pop();
              if (lastEvent) {
                targetEventId = lastEvent.id;
              }
            }
          }
          
          if (targetEventId) {
            const existingEvent = eventsMap.get(targetEventId);
            if (existingEvent) {
              // Create a new logs array if needed
              const currentLogs = existingEvent.logs || [];
              
              // Check if log already exists (deduplication based on timestamp + text)
              const logExists = currentLogs.some(l => 
                l.timestamp === logData.log.timestamp && l.text === logData.log.text
              );
              
              if (!logExists) {
                eventsMap.set(targetEventId, {
                  ...existingEvent,
                  logs: [...currentLogs, logData.log]
                });
              }
            }
          }
        }
      }
    }
    
    // Sort events by startTime
    return Array.from(eventsMap.values()).sort((a, b) => a.startTime - b.startTime);
  }, [messages]);

  // Extract task progress
  const taskProgress = useMemo((): TodoData => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (!message.parts) continue;
      
      for (const part of message.parts) {
        if (part.type === 'data-todo') {
          const todoPart = part as { type: 'data-todo'; data: TodoData };
          return todoPart.data;
        }
      }
    }
    return { todos: [] };
  }, [messages]);

  // Check if session is complete
  const isComplete = useMemo(() => {
    for (const message of messages) {
      if (!message.parts) continue;
      for (const part of message.parts) {
        if (part.type === 'data-session-complete') {
          return true;
        }
      }
    }
    return false;
  }, [messages]);

  // Check if session is paused
  const isPaused = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (!message.parts) continue;
      for (const part of message.parts) {
        if (part.type === 'data-agent-paused') {
          return true;
        }
      }
    }
    return false;
  }, [messages]);

  // Button mode and input disabled state
  const buttonMode: InputButtonMode = status === 'streaming' || status === 'submitted' ? 'stop' : 'send';
  const inputDisabled = status === 'streaming' || status === 'submitted';

  // Side panel card type - map to cards.ts CardType
  const sidePanelCardType = useMemo(() => {
    if (!sidePanelCardId) return undefined;
    const card = cards.get(sidePanelCardId);
    return card?.type;
  }, [sidePanelCardId, cards]);

  // ============================================================================
  // Actions
  // ============================================================================

  const startResearch = useCallback((query: string) => {
    chatSendMessage({ parts: [{ type: 'text', text: query }] });
  }, [chatSendMessage]);

  const sendMessage = useCallback((content: string) => {
    if (!content.trim()) return;
    chatSendMessage({ parts: [{ type: 'text', text: content }] });
    setInputValue('');
  }, [chatSendMessage]);

  const stopResearch = useCallback(() => {
    stop();
    
    // Also notify the backend
    fetch(`/api/research/sessions/${sessionId}/stop`, {
      method: 'POST',
    }).catch(console.error);
  }, [stop, sessionId]);

  const respondToCheckpoint = useCallback(async (
    checkpointId: string,
    action: string,
    data?: Record<string, unknown>
  ) => {
    console.log('[ResearchChat] Responding to checkpoint:', { sessionId, checkpointId, action });
    
    // Validate session ID before making API call
    if (!sessionId || sessionId.trim() === '') {
      console.error('[ResearchChat] Invalid session ID');
      toast.error('会话无效，请刷新页面重试');
      return;
    }
    
    try {
      const response = await fetch(`/api/research/sessions/${sessionId}/checkpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpointId, action, data }),
      });
      
      // Handle non-JSON responses or empty body
      let result: Record<string, unknown> = {};
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text && text.trim()) {
          try {
            result = JSON.parse(text);
          } catch (parseError) {
            console.error('[ResearchChat] Failed to parse JSON response:', parseError, 'Raw text:', text);
            result = { error: '服务器响应格式错误' };
          }
        } else {
          console.warn('[ResearchChat] Empty response body from checkpoint API');
          result = { error: '服务器返回空响应' };
        }
      } else {
        console.warn('[ResearchChat] Non-JSON response from checkpoint API:', contentType);
        result = { error: '服务器响应格式错误' };
      }
      
      if (!response.ok) {
        const errorMessage = (result.error as string) || 
          (response.status === 404 ? '会话不存在或已过期' : 
           response.status === 400 ? '请求参数无效' :
           response.status >= 500 ? '服务器错误，请稍后重试' :
           '操作失败，请重试');
        console.error('[ResearchChat] Checkpoint API error:', { status: response.status, result });
        toast.error(errorMessage);
        return;
      }
      
      console.log('[ResearchChat] Checkpoint resolved:', result);
    } catch (err) {
      // Classify the error for better user feedback
      const errorMessage = err instanceof Error ? err.message.toLowerCase() : '';
      let userMessage = '操作失败，请重试';
      
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('failed to fetch')) {
        userMessage = '网络连接失败，请检查网络后重试';
      } else if (errorMessage.includes('aborted') || errorMessage.includes('timeout')) {
        userMessage = '请求超时，请重试';
      }
      
      console.error('[ResearchChat] Failed to respond to checkpoint:', err);
      toast.error(userMessage);
    }
  }, [sessionId]);

  const openSidePanel = useCallback((cardId: string) => {
    setSidePanelCardId(cardId);
    setSidePanelOpen(true);
  }, []);

  const closeSidePanel = useCallback(() => {
    setSidePanelOpen(false);
    setSidePanelCardId(undefined);
  }, []);

  // Auto-start research if initial query is provided
  // Uses ref to prevent duplicate requests in React 18 Strict Mode
  useEffect(() => {
    if (initialQuery && messages.length === 0 && status === 'idle' && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startResearch(initialQuery);
    }
  }, [initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Core state
    messages,
    status,
    error,
    
    // Actions
    startResearch,
    sendMessage,
    stopResearch,
    respondToCheckpoint,
    
    // Side panel
    openSidePanel,
    closeSidePanel,
    
    // Input
    inputValue,
    setInputValue,
    buttonMode,
    inputDisabled,
    
    // Derived state
    cards,
    currentCheckpoint,
    agentSteps,
    agentEvents,
    taskProgress,
    isComplete,
    isPaused,
    
    // Side panel state
    sidePanel: {
      isOpen: sidePanelOpen,
      cardId: sidePanelCardId,
      cardType: sidePanelCardType,
    },
  };
}

export default useResearchChat;
