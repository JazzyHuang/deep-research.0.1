'use client';

/**
 * ResearchSessionPage - AI SDK v5 Implementation
 * 
 * Redesigned for better UI/UX:
 * - Sticky progress header showing research stages
 * - Agent timeline positioned before text output
 * - Clean message layout without assistant avatars
 * - Enhanced checkpoint and card animations
 * - Floating progress indicator
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useResearchChat } from '@/hooks/useResearchChat';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationEmptyState,
  Message,
  MessageContent,
  MessageAvatar,
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  Loader,
  ResearchLoader,
} from '@/components/ai-elements';
import { MessagePartsRenderer } from '@/components/research-chat/parts';
import { SidePanel } from '@/components/sidebar';
import { HistorySidebar, type HistoryItemData } from '@/components/history-sidebar';
import { 
  AgentTimeline, 
  ProgressHeader, 
  deriveStageFromSteps,
  FloatingProgress,
  TodoProgress 
} from '@/components/research-chat';
import { Settings, Download, PanelLeftClose, PanelLeft, ArrowLeft, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UIMessage } from 'ai';
import type { InteractiveCard } from '@/types/cards';

// Shared storage key - must match the one in home page
const HISTORY_STORAGE_KEY = 'deepresearch_history';

// Type for shared history format
interface SharedHistorySession {
  id: string;
  title: string;
  query: string;
  status: 'completed' | 'running' | 'error' | 'pending';
  createdAt: number;
  citationsCount?: number;
}

export default function ResearchSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const initialQuery = searchParams.get('q') || '';
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userSessions, setUserSessions] = useState<HistoryItemData[]>([]);
  
  // Use the AI SDK v5-based hook
  const {
    messages,
    status,
    error,
    inputValue,
    setInputValue,
    buttonMode,
    inputDisabled,
    taskProgress,
    currentCheckpoint,
    cards,
    agentSteps,
    sendMessage,
    stopResearch,
    respondToCheckpoint,
    openSidePanel,
    closeSidePanel,
    sidePanel,
    isComplete,
  } = useResearchChat({
    sessionId,
    initialQuery,
    onComplete: () => {
      console.log('Research completed');
      updateSessionStatus('completed');
    },
    onError: (err) => {
      console.error('Research error:', err);
      updateSessionStatus('error');
    },
  });
  
  // Derive research stage from agent steps
  const { currentStage, completedStages } = useMemo(() => {
    return deriveStageFromSteps(agentSteps.map(s => ({
      name: s.name,
      status: s.status
    })));
  }, [agentSteps]);
  
  // Get current step name for progress header
  const currentStepName = useMemo(() => {
    const runningStep = agentSteps.find(s => s.status === 'running');
    return runningStep?.title;
  }, [agentSteps]);
  
  // Check if research is active
  const isActive = status === 'streaming' || status === 'submitted';
  
  // Load history from localStorage
  const loadSharedHistory = useCallback((): SharedHistorySession[] => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  }, []);
  
  // Save history to localStorage
  const saveSharedHistory = useCallback((sessions: SharedHistorySession[]) => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      // Ignore storage errors
    }
  }, []);
  
  // Update session status
  const updateSessionStatus = useCallback((newStatus: SharedHistorySession['status']) => {
    const sessions = loadSharedHistory();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx >= 0) {
      sessions[idx].status = newStatus;
      saveSharedHistory(sessions);
    }
  }, [sessionId, loadSharedHistory, saveSharedHistory]);
  
  // Convert to sidebar format
  const convertToSidebarFormat = useCallback((sessions: SharedHistorySession[]): HistoryItemData[] => {
    return sessions.map(s => ({
      id: s.id,
      title: s.title,
      preview: s.query,
      status: s.status === 'pending' ? 'draft' : s.status,
      createdAt: s.createdAt,
      citationCount: s.citationsCount,
    }));
  }, []);
  
  // Load user sessions
  useEffect(() => {
    const sharedSessions = loadSharedHistory();
    setUserSessions(convertToSidebarFormat(sharedSessions));
    
    // Update current session status to running
    if (initialQuery) {
      updateSessionStatus('running');
    }
  }, [loadSharedHistory, convertToSidebarFormat, initialQuery, updateSessionStatus]);
  
  // Handle submit
  const handleSubmit = () => {
    if (buttonMode === 'stop') {
      stopResearch();
    } else if (inputValue.trim()) {
      sendMessage(inputValue);
    }
  };
  
  // Handle card click - open side panel
  const handleCardClick = useCallback((cardId: string) => {
    openSidePanel(cardId);
  }, [openSidePanel]);
  
  // Handle checkpoint action
  const handleCheckpointAction = useCallback((checkpointId: string, action: string) => {
    if (action === 'edit') {
      // For edit actions, open the side panel for the associated card
      const checkpoint = currentCheckpoint;
      if (checkpoint?.cardId) {
        openSidePanel(checkpoint.cardId);
      }
    } else {
      respondToCheckpoint(checkpointId, action);
    }
  }, [currentCheckpoint, openSidePanel, respondToCheckpoint]);
  
  // Handle history selection
  const handleHistorySelect = (id: string) => {
    if (id !== sessionId) {
      router.push(`/research/${id}`);
    }
  };
  
  // Handle new session
  const handleNewSession = () => {
    router.push('/');
  };
  
  // Handle history delete
  const handleHistoryDelete = useCallback((id: string) => {
    const sessions = loadSharedHistory();
    const updated = sessions.filter(s => s.id !== id);
    saveSharedHistory(updated);
    setUserSessions(convertToSidebarFormat(updated));
    
    if (id === sessionId) {
      router.push('/');
    }
  }, [sessionId, router, loadSharedHistory, saveSharedHistory, convertToSidebarFormat]);
  
  // Handle side panel save
  const handleSidePanelSave = useCallback((changes: Record<string, unknown>) => {
    if (sidePanel.cardId && currentCheckpoint?.cardId === sidePanel.cardId) {
      respondToCheckpoint(currentCheckpoint.id, 'approve', changes);
    }
    closeSidePanel();
  }, [sidePanel.cardId, currentCheckpoint, respondToCheckpoint, closeSidePanel]);
  
  // Get current card for side panel
  const currentCard = useMemo(() => {
    if (!sidePanel.cardId) return undefined;
    return cards.get(sidePanel.cardId);
  }, [sidePanel.cardId, cards]);
  
  // Deduplicate messages to prevent duplicate key errors
  const uniqueMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter(msg => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    });
  }, [messages]);
  
  // Build agent progress for timeline
  const agentProgress = useMemo(() => {
    if (agentSteps.length === 0) return null;
    
    return {
      steps: agentSteps.map(step => ({
        id: step.id,
        name: step.name,
        title: step.title,
        status: step.status,
        duration: step.duration,
        summary: step.summary,
        details: step.details,
      })),
      currentStepId: agentSteps.find(s => s.status === 'running')?.id,
      isCollapsed: false,
    };
  }, [agentSteps]);
  
  // Get text content from user message
  const getUserMessageText = (message: UIMessage): string => {
    if (message.parts) {
      const textParts = message.parts.filter(p => p.type === 'text');
      if (textParts.length > 0) {
        return textParts.map(p => (p as { text: string }).text).join(' ');
      }
    }
    return '';
  };
  
  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Left History Sidebar */}
      <div className={cn(
        'transition-all duration-300 ease-in-out flex-shrink-0',
        sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
      )}>
        {sidebarOpen && (
          <HistorySidebar
            history={userSessions}
            currentSessionId={sessionId}
            onSelect={handleHistorySelect}
            onNewSession={handleNewSession}
            onDelete={handleHistoryDelete}
            className="h-full"
          />
        )}
      </div>
      
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-background flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => router.push('/')}
              title="返回主页面"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
            
            <h1 className="text-sm font-medium truncate max-w-[400px]">
              {initialQuery || '新研究'}
            </h1>
          </div>
          
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </header>
        
        {/* Progress Header - Sticky below main header */}
        {(isActive || completedStages.length > 0) && (
          <ProgressHeader
            currentStage={currentStage}
            completedStages={completedStages}
            currentStepName={currentStepName}
            isActive={isActive}
          />
        )}
        
        {/* Chat Container */}
        <div className={cn(
          'flex-1 transition-all duration-300 ease-in-out min-h-0',
          sidePanel.isOpen && 'sm:mr-[400px]'
        )}>
          <Conversation className="h-full">
            <ConversationContent>
              {uniqueMessages.length === 0 && !isActive ? (
                <ConversationEmptyState
                  title="开始研究"
                  description="输入您的研究问题，AI 将帮助您深入分析"
                />
              ) : (
                <div className="space-y-4">
                  {/* Agent Timeline - positioned at the top during research */}
                  {agentProgress && agentProgress.steps.length > 0 && (
                    <div className="mb-6">
                      <AgentTimeline progress={agentProgress} mode="inline" />
                    </div>
                  )}
                  
                  {/* Messages */}
                  {uniqueMessages.map((message: UIMessage) => (
                    <div key={message.id}>
                      {message.role === 'user' ? (
                        // User message - right aligned with avatar
                        <Message from="user">
                          <MessageContent variant="contained">
                            {getUserMessageText(message)}
                          </MessageContent>
                          <MessageAvatar name="You" />
                        </Message>
                      ) : (
                        // Assistant message - full width, no avatar
                        <Message from="assistant">
                          <MessageContent variant="plain">
                            <MessagePartsRenderer
                              message={message}
                              onCardClick={handleCardClick}
                              onCheckpointAction={handleCheckpointAction}
                            />
                          </MessageContent>
                        </Message>
                      )}
                    </div>
                  ))}
                  
                  {/* Loading state with context */}
                  {status === 'submitted' && (
                    <div className="py-4">
                      <Loader 
                        context={
                          currentStage === 'planning' ? 'thinking' :
                          currentStage === 'searching' ? 'searching' :
                          currentStage === 'analyzing' ? 'analyzing' :
                          currentStage === 'writing' ? 'writing' :
                          'processing'
                        }
                      />
                    </div>
                  )}
                </div>
              )}
              
              {/* Initial loading state */}
              {uniqueMessages.length === 0 && isActive && (
                <ResearchLoader 
                  stage={currentStepName}
                  message="正在启动深度研究..."
                />
              )}
              
              {/* Error state */}
              {error && (
                <div className="py-3 px-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <p className="font-medium mb-1">研究出错</p>
                  <p className="text-destructive/80">{error.message}</p>
                </div>
              )}
            </ConversationContent>
            
            <ConversationScrollButton />
            
            {/* Floating Progress Indicator */}
            {isActive && agentSteps.length > 0 && (
              <FloatingProgress 
                steps={agentSteps} 
                isActive={isActive}
              />
            )}
            
            {/* Input Area */}
            <div className="p-4 border-t border-border bg-background/95 backdrop-blur">
              {/* Task progress - above input */}
              {taskProgress.todos.length > 0 && (
                <div className="mb-3">
                  <TodoProgress taskProgress={taskProgress} />
                </div>
              )}
              
              <PromptInput 
                onSubmit={handleSubmit}
                isSubmitting={status === 'streaming' || status === 'submitted'}
                isDisabled={inputDisabled}
              >
                <PromptInputTextarea
                  value={inputValue}
                  onChange={setInputValue}
                  placeholder={
                    status === 'streaming'
                      ? '研究进行中，点击停止按钮暂停...'
                      : currentCheckpoint
                      ? '输入反馈或选择上方操作继续...'
                      : '输入研究问题...'
                  }
                />
                <PromptInputFooter>
                  <div className="flex items-center gap-2">
                    {/* Status indicator */}
                    {isActive && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        研究中
                      </span>
                    )}
                    {isComplete && (
                      <span className="text-xs text-primary font-medium">
                        研究完成
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {buttonMode === 'stop' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={stopResearch}
                        className="h-8 px-3"
                      >
                        <Square className="h-3 w-3 mr-1.5" />
                        停止
                      </Button>
                    ) : (
                      <PromptInputSubmit />
                    )}
                  </div>
                </PromptInputFooter>
              </PromptInput>
            </div>
          </Conversation>
        </div>
      </main>
      
      {/* Right Side Panel */}
      <SidePanel
        isOpen={sidePanel.isOpen}
        card={currentCard as InteractiveCard | undefined}
        onClose={closeSidePanel}
        onSave={handleSidePanelSave}
      />
    </div>
  );
}
