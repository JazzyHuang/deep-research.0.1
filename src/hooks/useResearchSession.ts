'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  ResearchSessionState,
  AgentExecutionState,
  ResearchPhase,
  InputButtonMode,
  AgentCommand,
} from '@/types/agent';
import type { Message, ConversationEvent, CheckpointData } from '@/types/conversation';
import type { InteractiveCard, CardType } from '@/types/cards';

interface UseResearchSessionOptions {
  sessionId: string;
  initialQuery?: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface UseResearchSessionReturn {
  // State
  state: ResearchSessionState;
  
  // Actions
  sendMessage: (content: string) => void;
  stopAgent: () => void;
  respondToCheckpoint: (checkpointId: string, action: string, data?: Record<string, unknown>) => void;
  updateCard: (cardId: string, updates: Record<string, unknown>) => void;
  
  // Side panel
  openSidePanel: (cardId: string) => void;
  closeSidePanel: () => void;
  saveSidePanelChanges: (cardId: string, changes: Record<string, unknown>) => void;
  
  // Input
  setInputValue: (value: string) => void;
  
  // Connection
  connect: () => void;
  disconnect: () => void;
}

export function useResearchSession({
  sessionId,
  initialQuery = '',
  onComplete,
  onError,
}: UseResearchSessionOptions): UseResearchSessionReturn {
  // Main state
  const [messages, setMessages] = useState<Message[]>([]);
  const [cards, setCards] = useState<Map<string, InteractiveCard>>(new Map());
  const [agentState, setAgentState] = useState<AgentExecutionState>('idle');
  const [phase, setPhase] = useState<ResearchPhase>('initializing');
  const [currentCheckpoint, setCurrentCheckpoint] = useState<CheckpointData | undefined>();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [inputValue, setInputValue] = useState('');
  
  // Side panel state
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelCardId, setSidePanelCardId] = useState<string | undefined>();
  
  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Compute button mode
  const buttonMode: InputButtonMode = agentState === 'running' ? 'stop' : 'send';
  const inputDisabled = agentState === 'running';
  
  // Get card type for side panel
  const sidePanelCardType = sidePanelCardId ? cards.get(sidePanelCardId)?.type : undefined;
  
  // Build state object
  const state: ResearchSessionState = {
    sessionId,
    query: initialQuery,
    agentState,
    phase,
    currentCheckpoint,
    messages,
    cards,
    sidePanel: {
      isOpen: sidePanelOpen,
      cardId: sidePanelCardId,
      cardType: sidePanelCardType,
    },
    inputState: {
      value: inputValue,
      buttonMode,
      disabled: inputDisabled,
    },
    isConnected,
    error,
  };
  
  // Handle SSE events
  const handleEvent = useCallback((event: ConversationEvent) => {
    switch (event.type) {
      case 'message_start':
        setMessages(prev => [
          ...prev,
          {
            id: event.messageId,
            type: event.messageType,
            role: event.role,
            timestamp: Date.now(),
            content: '',
            isStreaming: true,
          },
        ]);
        break;
        
      case 'message_content':
        setMessages(prev =>
          prev.map(msg =>
            msg.id === event.messageId
              ? { ...msg, content: (msg.content || '') + event.content }
              : msg
          )
        );
        break;
        
      case 'message_complete':
        setMessages(prev =>
          prev.map(msg =>
            msg.id === event.messageId ? { ...msg, isStreaming: false } : msg
          )
        );
        break;
        
      case 'step_start':
        // Update agent progress in messages
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.type === 'agent_progress' && lastMsg.progress) {
            return prev.map((msg, i) =>
              i === prev.length - 1
                ? {
                    ...msg,
                    progress: {
                      ...msg.progress!,
                      steps: [...msg.progress!.steps, event.step],
                      currentStepId: event.step.id,
                    },
                  }
                : msg
            );
          }
          // Create new progress message
          return [
            ...prev,
            {
              id: `progress-${Date.now()}`,
              type: 'agent_progress' as const,
              timestamp: Date.now(),
              progress: {
                steps: [event.step],
                currentStepId: event.step.id,
                isCollapsed: false,
              },
            },
          ];
        });
        break;
        
      case 'step_update':
        setMessages(prev =>
          prev.map(msg =>
            msg.type === 'agent_progress' && msg.progress
              ? {
                  ...msg,
                  progress: {
                    ...msg.progress,
                    steps: msg.progress.steps.map(step =>
                      step.id === event.stepId ? { ...step, ...event.updates } : step
                    ),
                  },
                }
              : msg
          )
        );
        break;
        
      case 'step_complete':
        setMessages(prev =>
          prev.map(msg =>
            msg.type === 'agent_progress' && msg.progress
              ? {
                  ...msg,
                  progress: {
                    ...msg.progress,
                    steps: msg.progress.steps.map(step =>
                      step.id === event.stepId
                        ? { ...step, status: event.status, duration: event.duration }
                        : step
                    ),
                    currentStepId:
                      msg.progress.currentStepId === event.stepId
                        ? undefined
                        : msg.progress.currentStepId,
                  },
                }
              : msg
          )
        );
        break;
        
      case 'card_created':
        setCards(prev => new Map(prev).set(event.card.id, event.card));
        setMessages(prev => [
          ...prev,
          {
            id: `card-msg-${event.card.id}`,
            type: 'card',
            timestamp: Date.now(),
            card: event.card,
          },
        ]);
        break;
        
      case 'card_updated':
        setCards(prev => {
          const newCards = new Map(prev);
          const existing = newCards.get(event.cardId);
          if (existing) {
            newCards.set(event.cardId, { ...existing, ...event.updates });
          }
          return newCards;
        });
        break;
        
      case 'checkpoint_reached':
        setCurrentCheckpoint(event.checkpoint);
        setAgentState('awaiting_checkpoint');
        setMessages(prev => [
          ...prev,
          {
            id: `checkpoint-${event.checkpoint.id}`,
            type: 'checkpoint',
            timestamp: Date.now(),
            checkpoint: event.checkpoint,
          },
        ]);
        break;
        
      case 'checkpoint_resolved':
        setCurrentCheckpoint(undefined);
        setAgentState('running');
        break;
        
      case 'agent_paused':
        setAgentState('paused');
        break;
        
      case 'agent_resumed':
        setAgentState('running');
        break;
        
      case 'session_complete':
        setAgentState('completed');
        onComplete?.();
        break;
        
      case 'session_error':
        setAgentState('error');
        setError(event.error);
        onError?.(event.error);
        break;
    }
  }, [onComplete, onError]);
  
  // Connect to SSE stream
  const connect = useCallback(() => {
    if (eventSourceRef.current) return;
    
    // Start the session via POST first
    abortControllerRef.current = new AbortController();
    
    fetch(`/api/research/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: initialQuery, sessionId }),
      signal: abortControllerRef.current.signal,
    })
      .then(response => {
        if (!response.ok) throw new Error('Failed to start session');
        if (!response.body) throw new Error('No response body');
        
        setIsConnected(true);
        setAgentState('running');
        
        // Add initial user message
        setMessages([
          {
            id: `user-${Date.now()}`,
            type: 'user',
            role: 'user',
            timestamp: Date.now(),
            content: initialQuery,
          },
        ]);
        
        // Read SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        const read = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const event = JSON.parse(line.slice(6));
                    handleEvent(event);
                  } catch {
                    // Ignore parse errors
                  }
                }
              }
            }
          } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
              setError(err.message);
              setAgentState('error');
            }
          } finally {
            setIsConnected(false);
          }
        };
        
        read();
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setAgentState('error');
          onError?.(err.message);
        }
      });
  }, [sessionId, initialQuery, handleEvent, onError]);
  
  // Disconnect
  const disconnect = useCallback(() => {
    abortControllerRef.current?.abort();
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setIsConnected(false);
  }, []);
  
  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    
    // Add user message
    setMessages(prev => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        type: 'user',
        role: 'user',
        timestamp: Date.now(),
        content,
      },
    ]);
    
    setInputValue('');
    
    try {
      await fetch(`/api/research/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  }, [sessionId]);
  
  // Stop agent
  const stopAgent = useCallback(async () => {
    try {
      await fetch(`/api/research/sessions/${sessionId}/stop`, {
        method: 'POST',
      });
      setAgentState('paused');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop agent');
    }
  }, [sessionId]);
  
  // Respond to checkpoint
  const respondToCheckpoint = useCallback(async (
    checkpointId: string,
    action: string,
    data?: Record<string, unknown>
  ) => {
    try {
      await fetch(`/api/research/sessions/${sessionId}/checkpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpointId, action, data }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond to checkpoint');
    }
  }, [sessionId]);
  
  // Update card
  const updateCard = useCallback(async (
    cardId: string,
    updates: Record<string, unknown>
  ) => {
    try {
      await fetch(`/api/research/sessions/${sessionId}/cards/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      // Optimistically update local state
      setCards(prev => {
        const newCards = new Map(prev);
        const existing = newCards.get(cardId);
        if (existing) {
          newCards.set(cardId, { ...existing, ...updates } as InteractiveCard);
        }
        return newCards;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update card');
    }
  }, [sessionId]);
  
  // Side panel actions
  const openSidePanel = useCallback((cardId: string) => {
    setSidePanelCardId(cardId);
    setSidePanelOpen(true);
  }, []);
  
  const closeSidePanel = useCallback(() => {
    setSidePanelOpen(false);
    setSidePanelCardId(undefined);
  }, []);
  
  const saveSidePanelChanges = useCallback((
    cardId: string,
    changes: Record<string, unknown>
  ) => {
    updateCard(cardId, changes);
    closeSidePanel();
  }, [updateCard, closeSidePanel]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);
  
  return {
    state,
    sendMessage,
    stopAgent,
    respondToCheckpoint,
    updateCard,
    openSidePanel,
    closeSidePanel,
    saveSidePanelChanges,
    setInputValue,
    connect,
    disconnect,
  };
}







