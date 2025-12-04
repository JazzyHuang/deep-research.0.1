/**
 * Global Session Manager for Deep Research
 * Manages session state, abort controllers, checkpoints, and user messages
 */

import type { CheckpointData } from '@/types/conversation';

export type SessionStatus = 'idle' | 'running' | 'paused' | 'awaiting_checkpoint' | 'completed' | 'error';

export interface CheckpointResolution {
  action: string;
  data?: Record<string, unknown>;
  message?: string;
  resolvedAt: number;
}

export interface UserMessage {
  id: string;
  content: string;
  timestamp: number;
  processed: boolean;
}

export interface SessionState {
  sessionId: string;
  query: string;
  status: SessionStatus;
  abortController: AbortController;
  createdAt: number;
  updatedAt: number;
  
  // Checkpoint management
  pendingCheckpoint?: CheckpointData;
  checkpointResolution?: CheckpointResolution;
  checkpointHistory: Array<{
    checkpoint: CheckpointData;
    resolution: CheckpointResolution;
  }>;
  
  // User message queue
  userMessages: UserMessage[];
  unprocessedMessages: UserMessage[];
  
  // Error tracking
  lastError?: string;
  errorCount: number;
}

/**
 * SessionManager - Singleton class managing all research sessions
 */
class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private checkpointListeners: Map<string, Set<(resolution: CheckpointResolution) => void>> = new Map();
  private messageListeners: Map<string, Set<(message: UserMessage) => void>> = new Map();
  private maxSessions = 100;
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  /**
   * Create a new session
   */
  create(sessionId: string, query: string): SessionState {
    // Clean up old sessions if needed
    this.cleanup();
    
    // Check if session already exists
    if (this.sessions.has(sessionId)) {
      const existing = this.sessions.get(sessionId)!;
      // If existing session is not running, recreate it
      if (existing.status !== 'running' && existing.status !== 'awaiting_checkpoint') {
        this.remove(sessionId);
      } else {
        return existing;
      }
    }
    
    const state: SessionState = {
      sessionId,
      query,
      status: 'idle',
      abortController: new AbortController(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      checkpointHistory: [],
      userMessages: [],
      unprocessedMessages: [],
      errorCount: 0,
    };
    
    this.sessions.set(sessionId, state);
    return state;
  }

  /**
   * Get a session by ID
   */
  get(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Check if a session exists
   */
  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Update session status
   */
  setStatus(sessionId: string, status: SessionStatus): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      session.updatedAt = Date.now();
    }
  }

  /**
   * Start a session (set to running)
   */
  start(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'running';
      session.updatedAt = Date.now();
      // Create fresh abort controller
      session.abortController = new AbortController();
    }
  }

  /**
   * Abort/Stop a session
   */
  abort(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.abortController.abort();
      session.status = 'paused';
      session.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Check if session is aborted
   */
  isAborted(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.abortController.signal.aborted ?? false;
  }

  /**
   * Get abort signal for a session
   */
  getAbortSignal(sessionId: string): AbortSignal | undefined {
    return this.sessions.get(sessionId)?.abortController.signal;
  }

  /**
   * Set a checkpoint that requires user action
   */
  setCheckpoint(sessionId: string, checkpoint: CheckpointData): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pendingCheckpoint = checkpoint;
      session.checkpointResolution = undefined;
      session.status = 'awaiting_checkpoint';
      session.updatedAt = Date.now();
    }
  }

  /**
   * Resolve a checkpoint with user action
   */
  resolveCheckpoint(
    sessionId: string,
    action: string,
    data?: Record<string, unknown>,
    message?: string
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (session && session.pendingCheckpoint) {
      const resolution: CheckpointResolution = {
        action,
        data,
        message,
        resolvedAt: Date.now(),
      };
      
      // Store resolution
      session.checkpointResolution = resolution;
      
      // Add to history
      session.checkpointHistory.push({
        checkpoint: session.pendingCheckpoint,
        resolution,
      });
      
      // Notify listeners
      const listeners = this.checkpointListeners.get(sessionId);
      if (listeners) {
        listeners.forEach(listener => listener(resolution));
      }
      
      session.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Clear pending checkpoint (after processing)
   */
  clearCheckpoint(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.pendingCheckpoint = undefined;
      session.checkpointResolution = undefined;
      if (session.status === 'awaiting_checkpoint') {
        session.status = 'running';
      }
      session.updatedAt = Date.now();
    }
  }

  /**
   * Wait for checkpoint resolution
   */
  waitForCheckpoint(sessionId: string, timeout = 300000): Promise<CheckpointResolution> {
    return new Promise((resolve, reject) => {
      const session = this.sessions.get(sessionId);
      if (!session) {
        reject(new Error(`Session ${sessionId} not found`));
        return;
      }

      // If already resolved, return immediately
      if (session.checkpointResolution) {
        resolve(session.checkpointResolution);
        return;
      }

      // Set up listener
      const listener = (resolution: CheckpointResolution) => {
        clearTimeout(timeoutId);
        this.removeCheckpointListener(sessionId, listener);
        resolve(resolution);
      };

      this.addCheckpointListener(sessionId, listener);

      // Set up timeout - auto-approve after timeout
      const timeoutId = setTimeout(() => {
        this.removeCheckpointListener(sessionId, listener);
        const autoResolution: CheckpointResolution = {
          action: 'approve',
          resolvedAt: Date.now(),
        };
        
        // Store the auto-resolution
        if (session.pendingCheckpoint) {
          session.checkpointResolution = autoResolution;
          session.checkpointHistory.push({
            checkpoint: session.pendingCheckpoint,
            resolution: autoResolution,
          });
        }
        
        resolve(autoResolution);
      }, timeout);

      // Also resolve if session is aborted
      const checkAbort = setInterval(() => {
        if (session.abortController.signal.aborted) {
          clearInterval(checkAbort);
          clearTimeout(timeoutId);
          this.removeCheckpointListener(sessionId, listener);
          reject(new Error('Session aborted'));
        }
      }, 100);
    });
  }

  /**
   * Add a listener for checkpoint resolution
   */
  private addCheckpointListener(
    sessionId: string,
    listener: (resolution: CheckpointResolution) => void
  ): void {
    if (!this.checkpointListeners.has(sessionId)) {
      this.checkpointListeners.set(sessionId, new Set());
    }
    this.checkpointListeners.get(sessionId)!.add(listener);
  }

  /**
   * Remove a checkpoint listener
   */
  private removeCheckpointListener(
    sessionId: string,
    listener: (resolution: CheckpointResolution) => void
  ): void {
    const listeners = this.checkpointListeners.get(sessionId);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Add a user message to the session
   */
  addUserMessage(sessionId: string, content: string): UserMessage | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const message: UserMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      content,
      timestamp: Date.now(),
      processed: false,
    };

    session.userMessages.push(message);
    session.unprocessedMessages.push(message);
    session.updatedAt = Date.now();

    // Notify message listeners
    const listeners = this.messageListeners.get(sessionId);
    if (listeners) {
      listeners.forEach(listener => listener(message));
    }

    // If there's a pending checkpoint, auto-resolve with feedback
    if (session.pendingCheckpoint && session.status === 'awaiting_checkpoint') {
      this.resolveCheckpoint(sessionId, 'feedback', { feedback: content }, content);
    }

    return message;
  }

  /**
   * Get unprocessed messages and mark them as processed
   */
  consumeMessages(sessionId: string): UserMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const messages = [...session.unprocessedMessages];
    
    // Mark as processed
    messages.forEach(msg => {
      msg.processed = true;
    });
    
    session.unprocessedMessages = [];
    session.updatedAt = Date.now();

    return messages;
  }

  /**
   * Add a listener for new user messages
   */
  addMessageListener(
    sessionId: string,
    listener: (message: UserMessage) => void
  ): () => void {
    if (!this.messageListeners.has(sessionId)) {
      this.messageListeners.set(sessionId, new Set());
    }
    this.messageListeners.get(sessionId)!.add(listener);

    // Return cleanup function
    return () => {
      const listeners = this.messageListeners.get(sessionId);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  /**
   * Record an error
   */
  setError(sessionId: string, error: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastError = error;
      session.errorCount++;
      session.status = 'error';
      session.updatedAt = Date.now();
    }
  }

  /**
   * Complete a session
   */
  complete(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.updatedAt = Date.now();
    }
  }

  /**
   * Remove a session
   */
  remove(sessionId: string): boolean {
    // Clean up listeners
    this.checkpointListeners.delete(sessionId);
    this.messageListeners.delete(sessionId);
    
    return this.sessions.delete(sessionId);
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.entries())
      .filter(([_, state]) => state.status === 'running' || state.status === 'awaiting_checkpoint')
      .map(([id]) => id);
  }

  /**
   * Get session statistics
   */
  getStats(): {
    total: number;
    running: number;
    awaiting: number;
    completed: number;
    error: number;
  } {
    const stats = {
      total: 0,
      running: 0,
      awaiting: 0,
      completed: 0,
      error: 0,
    };

    this.sessions.forEach(session => {
      stats.total++;
      switch (session.status) {
        case 'running':
          stats.running++;
          break;
        case 'awaiting_checkpoint':
          stats.awaiting++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'error':
          stats.error++;
          break;
      }
    });

    return stats;
  }

  /**
   * Clean up old/expired sessions
   */
  private cleanup(): void {
    const now = Date.now();
    const sessionsToRemove: string[] = [];

    // Remove expired sessions
    this.sessions.forEach((session, id) => {
      const age = now - session.updatedAt;
      const isInactive = session.status === 'completed' || session.status === 'error';
      
      if (age > this.sessionTimeout && isInactive) {
        sessionsToRemove.push(id);
      }
    });

    // Remove oldest sessions if over limit
    if (this.sessions.size - sessionsToRemove.length > this.maxSessions) {
      const sortedSessions = Array.from(this.sessions.entries())
        .filter(([id]) => !sessionsToRemove.includes(id))
        .sort((a, b) => a[1].updatedAt - b[1].updatedAt);

      const toRemove = sortedSessions.slice(0, this.sessions.size - this.maxSessions);
      toRemove.forEach(([id, session]) => {
        if (session.status !== 'running' && session.status !== 'awaiting_checkpoint') {
          sessionsToRemove.push(id);
        }
      });
    }

    sessionsToRemove.forEach(id => this.remove(id));
  }
}

// Global singleton pattern for Next.js
// This ensures the same instance is used across all API routes
// even when modules are re-evaluated by Turbopack/Webpack

declare global {
  // eslint-disable-next-line no-var
  var __sessionManager: SessionManager | undefined;
}

// Export singleton instance using global to persist across module reloads
export const sessionManager: SessionManager = globalThis.__sessionManager ?? new SessionManager();

// Store in global for persistence in development
if (process.env.NODE_ENV !== 'production') {
  globalThis.__sessionManager = sessionManager;
}

// Export type
export type { SessionManager };



