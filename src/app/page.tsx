'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { ResearchInput, HomeHistorySection, EmptyHistoryState, type HistorySession } from '@/components/research';
import type { CitationStyle } from '@/lib/citation';
import { createClient } from '@/lib/supabase/client';

// Storage key for sharing history between pages
const HISTORY_STORAGE_KEY = 'deepresearch_history';

export default function HomePage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSupabase, setHasSupabase] = useState(false);

  // Load history from localStorage
  const loadLocalHistory = useCallback((): HistorySession[] => {
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
  const saveLocalHistory = useCallback((sessions: HistorySession[]) => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    async function loadHistory() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setHasSupabase(true);
          // Fetch real history from Supabase
          const { data, error } = await supabase
            .from('research_sessions')
            .select('id, query, title, status, created_at, citations_count')
            .order('created_at', { ascending: false })
            .limit(6);

          if (!error && data) {
            const sessions: HistorySession[] = data.map((session: {
              id: string;
              query: string;
              title: string | null;
              status: string;
              created_at: string;
              citations_count: number | null;
            }) => ({
              id: session.id,
              title: session.title || '',
              query: session.query,
              status: session.status as HistorySession['status'],
              createdAt: new Date(session.created_at).getTime(),
              citationsCount: session.citations_count ?? undefined,
            }));
            setHistory(sessions);
          }
        } else {
          // Load user sessions from localStorage
          const localSessions = loadLocalHistory();
          localSessions.sort((a, b) => b.createdAt - a.createdAt);
          setHistory(localSessions);
        }
      } catch {
        // Supabase not configured, use localStorage only
        const localSessions = loadLocalHistory();
        localSessions.sort((a, b) => b.createdAt - a.createdAt);
        setHistory(localSessions);
      } finally {
        setIsLoading(false);
      }
    }

    loadHistory();
  }, [loadLocalHistory]);
  
  // Handle history deletion
  const handleDelete = useCallback((sessionId: string) => {
    setHistory(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      // Save to localStorage
      saveLocalHistory(updated);
      return updated;
    });
  }, [saveLocalHistory]);

  const handleStartResearch = (query: string, style: CitationStyle) => {
    // Generate a unique session ID
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    
    // Create new session and save to localStorage
    const newSession: HistorySession = {
      id: sessionId,
      title: query.slice(0, 50) + (query.length > 50 ? '...' : ''),
      query: query,
      status: 'running',
      createdAt: Date.now(),
      citationsCount: 0,
    };
    
    // Add to history and save
    const localSessions = loadLocalHistory();
    const updatedSessions = [newSession, ...localSessions];
    saveLocalHistory(updatedSessions);
    
    // Redirect to the new research session page
    const params = new URLSearchParams({
      q: query,
      style: style,
    });
    
    router.push(`/research/${sessionId}?${params.toString()}`);
  };

  return (
    <>
      <Header />
      <main className="container py-8 md:py-12">
        <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center">
          <ResearchInput 
            onSubmit={handleStartResearch} 
            isLoading={false}
          />
          
          {/* History Section */}
          {!isLoading && (
            history.length > 0 ? (
              <HomeHistorySection 
                sessions={history}
                onDelete={handleDelete}
                className="w-full max-w-4xl mx-auto"
              />
            ) : hasSupabase ? (
              <EmptyHistoryState />
            ) : null
          )}
        </div>
      </main>
    </>
  );
}
