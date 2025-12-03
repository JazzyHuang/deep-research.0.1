'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ChatContainer } from '@/components/research-chat';
import { SidePanel } from '@/components/sidebar';
import { HistorySidebar, type HistoryItemData } from '@/components/history-sidebar';
import { useResearchSession } from '@/hooks/useResearchSession';
import { Settings, Download, PanelLeftClose, PanelLeft, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

/**
 * ResearchSessionPage - Cursor 2.0 style layout
 * Features: History sidebar (left), Main chat (center), Detail panel (right, push)
 */
export default function ResearchSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const initialQuery = searchParams.get('q') || '';
  
  const [hasStarted, setHasStarted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userSessions, setUserSessions] = useState<HistoryItemData[]>([]);
  
  // Load history from localStorage (shared with home page)
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
  
  // Save history to localStorage (shared with home page)
  const saveSharedHistory = useCallback((sessions: SharedHistorySession[]) => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      // Ignore storage errors
    }
  }, []);
  
  // Convert shared format to sidebar format
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
  
  // Load user sessions from shared localStorage
  useEffect(() => {
    const sharedSessions = loadSharedHistory();
    setUserSessions(convertToSidebarFormat(sharedSessions));
  }, [loadSharedHistory, convertToSidebarFormat]);
  
  // Update session status when entering with a query (session should already exist from home page)
  useEffect(() => {
    if (initialQuery) {
      const sharedSessions = loadSharedHistory();
      const existingIndex = sharedSessions.findIndex(s => s.id === sessionId);
      
      if (existingIndex >= 0) {
        // Update status to running
        sharedSessions[existingIndex].status = 'running';
        saveSharedHistory(sharedSessions);
        setUserSessions(convertToSidebarFormat(sharedSessions));
      }
    }
  }, [sessionId, initialQuery, loadSharedHistory, saveSharedHistory, convertToSidebarFormat]);
  
  // History list - real user sessions only
  const historyList: HistoryItemData[] = useMemo(() => {
    // Update status of current session if it's in userSessions
    const updatedUserSessions = userSessions.map(session => ({
      ...session,
      status: session.id === sessionId ? 'running' as const : session.status,
    }));
    
    // Sort by createdAt descending
    updatedUserSessions.sort((a, b) => b.createdAt - a.createdAt);
    return updatedUserSessions;
  }, [sessionId, userSessions]);
  
  const {
    state,
    sendMessage,
    stopAgent,
    respondToCheckpoint,
    openSidePanel,
    closeSidePanel,
    saveSidePanelChanges,
    setInputValue,
    connect,
  } = useResearchSession({
    sessionId,
    initialQuery,
    onComplete: () => {
      console.log('Research completed');
    },
    onError: (error) => {
      console.error('Research error:', error);
    },
  });
  
  // Auto-start on mount if we have a query
  useEffect(() => {
    if (initialQuery && !hasStarted) {
      setHasStarted(true);
      connect();
    }
  }, [initialQuery, hasStarted, connect]);
  
  // Handle input submit
  const handleSubmit = () => {
    if (state.inputState.buttonMode === 'stop') {
      stopAgent();
    } else if (state.inputState.value.trim()) {
      sendMessage(state.inputState.value);
    }
  };
  
  // Handle card title click (open side panel)
  const handleCardClick = (cardId: string) => {
    openSidePanel(cardId);
  };
  
  // Handle checkpoint action
  const handleCheckpointAction = (checkpointId: string, action: string) => {
    if (action === 'edit') {
      const checkpoint = state.currentCheckpoint;
      if (checkpoint?.cardId) {
        openSidePanel(checkpoint.cardId);
      }
    } else {
      respondToCheckpoint(checkpointId, action);
    }
  };
  
  // Handle side panel save
  const handleSidePanelSave = (changes: Record<string, unknown>) => {
    if (state.sidePanel.cardId) {
      saveSidePanelChanges(state.sidePanel.cardId, changes);
      
      if (state.currentCheckpoint?.cardId === state.sidePanel.cardId) {
        respondToCheckpoint(state.currentCheckpoint.id, 'approve', changes);
      }
    }
  };
  
  // Handle history selection
  const handleHistorySelect = (id: string) => {
    if (id !== sessionId) {
      // Navigate to the selected session
      router.push(`/research/${id}`);
    }
  };
  
  // Handle new session
  const handleNewSession = () => {
    router.push('/');
  };
  
  // Handle history delete
  const handleHistoryDelete = useCallback((id: string) => {
    // Remove from shared localStorage
    const sharedSessions = loadSharedHistory();
    const updated = sharedSessions.filter(s => s.id !== id);
    saveSharedHistory(updated);
    
    // Update local state
    setUserSessions(convertToSidebarFormat(updated));
    
    // If deleting current session, navigate to home
    if (id === sessionId) {
      router.push('/');
    }
  }, [sessionId, router, loadSharedHistory, saveSharedHistory, convertToSidebarFormat]);
  
  // Get current card for side panel
  const currentCard = state.sidePanel.cardId 
    ? state.cards.get(state.sidePanel.cardId) 
    : undefined;
  
  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Left History Sidebar - Cursor style */}
      <div className={cn(
        "transition-all duration-300 ease-in-out flex-shrink-0",
        sidebarOpen ? "w-72" : "w-0 overflow-hidden"
      )}>
        {sidebarOpen && (
          <HistorySidebar
            history={historyList}
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
        {/* Compact Header - Cursor style */}
        <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-background flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Back to home button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => router.push('/')}
              title="返回主页面"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            {/* Sidebar toggle */}
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
            
            {/* Title */}
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
        
        {/* Chat Container - Takes remaining space */}
        <div className={cn(
          "flex-1 transition-all duration-300 ease-in-out min-h-0",
          state.sidePanel.isOpen && "sm:mr-[400px]"
        )}>
          <ChatContainer
            messages={state.messages}
            cards={state.cards}
            agentState={state.agentState}
            inputValue={state.inputState.value}
            buttonMode={state.inputState.buttonMode}
            inputDisabled={state.inputState.disabled}
            currentCheckpoint={state.currentCheckpoint}
            onInputChange={setInputValue}
            onSubmit={handleSubmit}
            onCardClick={handleCardClick}
            onCheckpointAction={handleCheckpointAction}
          />
        </div>
      </main>
      
      {/* Right Side Panel - Push style (no overlay) */}
      <SidePanel
        isOpen={state.sidePanel.isOpen}
        card={currentCard}
        onClose={closeSidePanel}
        onSave={handleSidePanelSave}
      />
    </div>
  );
}
