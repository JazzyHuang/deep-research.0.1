'use client';

/**
 * ResearchSessionPage - Stream-based UI Implementation
 * 
 * Redesigned for continuous stream layout:
 * - User message at top with subtle bubble
 * - Agent steps inline (no bubble) with timeline connector
 * - Interactive cards with clear borders
 * - Smooth flow: User → Agent output → Card → Agent output → Card
 */

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useResearchChat } from '@/hooks/useResearchChat';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationEmptyState,
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  Loader,
  ResearchLoader,
} from '@/components/ai-elements';
import { SidePanel } from '@/components/sidebar';
import { HistorySidebar, type HistoryItemData } from '@/components/history-sidebar';
import { 
  ProgressHeader, 
  deriveStageFromSteps,
  FloatingProgress,
  TodoProgress,
  ResearchStream,
} from '@/components/research-chat';
import { Settings, Download, PanelLeftClose, PanelLeft, ArrowLeft, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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

function ResearchSessionContent() {
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
    agentEvents,
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
        {/* Header - Refined */}
        <header className={cn(
          "h-14 flex items-center justify-between px-4",
          "border-b border-border/40",
          "bg-background/80 backdrop-blur-lg",
          "flex-shrink-0"
        )}>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:bg-muted/80"
              onClick={() => router.push('/')}
              title="返回主页面"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:bg-muted/80"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
            
            <div className="h-5 w-px bg-border/50 mx-1" />
            
            <h1 className="text-sm font-medium text-foreground/80 truncate max-w-[400px]">
              {initialQuery || '新研究'}
            </h1>
          </div>
          
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-xl hover:bg-muted/80"
              title="下载报告"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-xl hover:bg-muted/80"
              title="设置"
            >
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
                <>
                  {/* Unified Research Stream */}
                  <ResearchStream
                    messages={uniqueMessages}
                    cards={cards}
                    currentCheckpoint={currentCheckpoint}
                    agentEvents={agentEvents}
                    onCardClick={handleCardClick}
                    onCheckpointAction={handleCheckpointAction}
                  />
                  
                  {/* Loading state with context */}
                  {status === 'submitted' && agentSteps.length === 0 && (
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
                </>
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
            
            {/* Input Area - Floating Capsule */}
            <div className="p-4 pb-6">
              {/* Task progress - above input */}
              {taskProgress.todos.length > 0 && (
                <div className="mb-4 max-w-3xl mx-auto">
                  <TodoProgress taskProgress={taskProgress} />
                </div>
              )}
              
              <PromptInput 
                onSubmit={handleSubmit}
                isSubmitting={status === 'streaming' || status === 'submitted'}
                isDisabled={inputDisabled}
                variant="floating"
              >
                <PromptInputTextarea
                  value={inputValue}
                  onChange={setInputValue}
                  placeholder={
                    status === 'streaming'
                      ? '研究进行中，点击停止按钮暂停...'
                      : currentCheckpoint
                      ? '输入反馈或选择上方操作继续...'
                      : '输入您的研究问题...'
                  }
                />
                <PromptInputFooter>
                  <div className="flex items-center gap-2">
                    {/* Status indicator */}
                    {isActive && (
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                        </span>
                        研究中
                      </span>
                    )}
                    {isComplete && (
                      <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
                        <span className="w-2 h-2 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="w-1 h-1 rounded-full bg-primary" />
                        </span>
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
                        className="h-8 px-3 rounded-xl"
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

/**
 * Page component with Suspense boundary for useSearchParams
 * Required for Next.js 16+ to properly handle client-side navigation hooks
 */
export default function ResearchSessionPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">正在加载研究...</p>
        </div>
      </div>
    }>
      <ResearchSessionContent />
    </Suspense>
  );
}
