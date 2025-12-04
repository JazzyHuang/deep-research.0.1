/**
 * Session Persistence Service
 * 
 * Handles saving and restoring research session state to Supabase
 * for checkpoint/resume functionality.
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ResearchPlan, SearchRound, Citation, QualityMetrics } from '@/types/research';
import type { Paper } from '@/types/paper';
import type { VerifiableChecklist } from '@/lib/agents/verifiable-checklist';
import type { EvidenceAuditResult } from '@/lib/agents/evidence-auditor';

// ============================================
// Types
// ============================================

export type WorkflowState = 
  | 'initializing'
  | 'planning'
  | 'searching'
  | 'analyzing'
  | 'writing'
  | 'reviewing'
  | 'iterating'
  | 'validating'
  | 'complete'
  | 'error';

export interface PersistedSessionState {
  id: string;
  userId: string;
  query: string;
  title?: string;
  workflowState: WorkflowState;
  iterationCount: number;
  plan?: ResearchPlan;
  searchRounds: SearchRound[];
  collectedPapers: string[];  // Paper IDs
  reportVersions: string[];   // Report content versions
  citations: Citation[];
  qualityMetrics?: QualityMetrics;
  checklist?: VerifiableChecklist;
  evidenceAudit?: EvidenceAuditResult;
  gaps: string[];
  isResumable: boolean;
  lastCheckpoint?: {
    snapshotId: string;
    snapshotType: string;
    workflowState: WorkflowState;
    iteration: number;
    createdAt: string;
  };
  finalReport?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSnapshot {
  id: string;
  sessionId: string;
  snapshotType: 'checkpoint' | 'iteration_complete' | 'search_complete' | 'manual';
  workflowState: WorkflowState;
  iteration: number;
  memoryState: Record<string, unknown>;
  createdAt: string;
}

export interface SaveSessionOptions {
  createSnapshot?: boolean;
  snapshotType?: SessionSnapshot['snapshotType'];
}

// ============================================
// Session Persistence Service
// ============================================

export class SessionPersistenceService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    this.initSupabase();
  }

  private initSupabase(): void {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Check if persistence is available
   */
  isAvailable(): boolean {
    return this.supabase !== null;
  }

  /**
   * Create a new session in the database
   */
  async createSession(
    userId: string,
    query: string,
    sessionId?: string,
  ): Promise<string | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('research_sessions')
        .insert({
          id: sessionId,
          user_id: userId,
          query,
          workflow_state: 'initializing',
          iteration_count: 0,
          search_rounds: [],
          collected_papers: [],
          report_versions: [],
          citations: [],
          gaps: [],
          is_resumable: false,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[SessionPersistence] Failed to create session:', error);
        return null;
      }

      return data?.id || null;
    } catch (error) {
      console.error('[SessionPersistence] Error creating session:', error);
      return null;
    }
  }

  /**
   * Save session state to database
   */
  async saveSession(
    sessionId: string,
    state: Partial<PersistedSessionState>,
    options: SaveSessionOptions = {},
  ): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      // Convert state to database columns
      const updateData: Record<string, unknown> = {};

      if (state.workflowState) updateData.workflow_state = state.workflowState;
      if (state.iterationCount !== undefined) updateData.iteration_count = state.iterationCount;
      if (state.plan) updateData.plan = state.plan;
      if (state.searchRounds) updateData.search_rounds = state.searchRounds;
      if (state.collectedPapers) updateData.collected_papers = state.collectedPapers;
      if (state.reportVersions) updateData.report_versions = state.reportVersions;
      if (state.citations) updateData.citations = state.citations;
      if (state.qualityMetrics) updateData.quality_metrics = state.qualityMetrics;
      if (state.checklist) updateData.checklist = state.checklist;
      if (state.evidenceAudit) updateData.evidence_audit = state.evidenceAudit;
      if (state.gaps) updateData.gaps = state.gaps;
      if (state.isResumable !== undefined) updateData.is_resumable = state.isResumable;
      if (state.finalReport) updateData.final_report = state.finalReport;
      if (state.title) updateData.title = state.title;

      // Update status based on workflow state
      if (state.workflowState) {
        const statusMap: Record<WorkflowState, string> = {
          initializing: 'pending',
          planning: 'planning',
          searching: 'searching',
          analyzing: 'analyzing',
          writing: 'writing',
          reviewing: 'writing',
          iterating: 'writing',
          validating: 'writing',
          complete: 'complete',
          error: 'error',
        };
        updateData.status = statusMap[state.workflowState];
      }

      const { error: updateError } = await this.supabase
        .from('research_sessions')
        .update(updateData)
        .eq('id', sessionId);

      if (updateError) {
        console.error('[SessionPersistence] Failed to update session:', updateError);
        return false;
      }

      // Create snapshot if requested
      if (options.createSnapshot && options.snapshotType) {
        await this.createSnapshot(
          sessionId,
          options.snapshotType,
          state.workflowState || 'initializing',
          state.iterationCount || 0,
          state,
        );
      }

      return true;
    } catch (error) {
      console.error('[SessionPersistence] Error saving session:', error);
      return false;
    }
  }

  /**
   * Load session state from database
   */
  async loadSession(sessionId: string): Promise<PersistedSessionState | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('research_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !data) {
        console.error('[SessionPersistence] Failed to load session:', error);
        return null;
      }

      return {
        id: data.id,
        userId: data.user_id,
        query: data.query,
        title: data.title,
        workflowState: data.workflow_state as WorkflowState,
        iterationCount: data.iteration_count,
        plan: data.plan,
        searchRounds: data.search_rounds || [],
        collectedPapers: data.collected_papers || [],
        reportVersions: data.report_versions || [],
        citations: data.citations || [],
        qualityMetrics: data.quality_metrics,
        checklist: data.checklist,
        evidenceAudit: data.evidence_audit,
        gaps: data.gaps || [],
        isResumable: data.is_resumable,
        lastCheckpoint: data.last_checkpoint,
        finalReport: data.final_report,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (error) {
      console.error('[SessionPersistence] Error loading session:', error);
      return null;
    }
  }

  /**
   * Create a session snapshot for resume
   */
  async createSnapshot(
    sessionId: string,
    snapshotType: SessionSnapshot['snapshotType'],
    workflowState: WorkflowState,
    iteration: number,
    memoryState: Record<string, unknown>,
  ): Promise<string | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .rpc('create_session_snapshot', {
          p_session_id: sessionId,
          p_snapshot_type: snapshotType,
          p_workflow_state: workflowState,
          p_iteration: iteration,
          p_memory_state: memoryState,
        });

      if (error) {
        console.error('[SessionPersistence] Failed to create snapshot:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[SessionPersistence] Error creating snapshot:', error);
      return null;
    }
  }

  /**
   * Get the latest snapshot for a session
   */
  async getLatestSnapshot(sessionId: string): Promise<SessionSnapshot | null> {
    if (!this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .rpc('get_latest_snapshot', { p_session_id: sessionId });

      if (error || !data || data.length === 0) {
        return null;
      }

      const snapshot = data[0];
      return {
        id: snapshot.id,
        sessionId,
        snapshotType: snapshot.snapshot_type,
        workflowState: snapshot.workflow_state as WorkflowState,
        iteration: snapshot.iteration,
        memoryState: snapshot.memory_state,
        createdAt: snapshot.created_at,
      };
    } catch (error) {
      console.error('[SessionPersistence] Error getting snapshot:', error);
      return null;
    }
  }

  /**
   * Get all resumable sessions for a user
   */
  async getResumableSessions(userId: string): Promise<PersistedSessionState[]> {
    if (!this.supabase) return [];

    try {
      const { data, error } = await this.supabase
        .from('research_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_resumable', true)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error || !data) {
        return [];
      }

      return data.map(row => ({
        id: row.id,
        userId: row.user_id,
        query: row.query,
        title: row.title,
        workflowState: row.workflow_state as WorkflowState,
        iterationCount: row.iteration_count,
        plan: row.plan,
        searchRounds: row.search_rounds || [],
        collectedPapers: row.collected_papers || [],
        reportVersions: row.report_versions || [],
        citations: row.citations || [],
        qualityMetrics: row.quality_metrics,
        checklist: row.checklist,
        evidenceAudit: row.evidence_audit,
        gaps: row.gaps || [],
        isResumable: row.is_resumable,
        lastCheckpoint: row.last_checkpoint,
        finalReport: row.final_report,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.error('[SessionPersistence] Error getting resumable sessions:', error);
      return [];
    }
  }

  /**
   * Mark session as complete (not resumable)
   */
  async completeSession(sessionId: string, finalReport: string): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { error } = await this.supabase
        .from('research_sessions')
        .update({
          workflow_state: 'complete',
          status: 'complete',
          is_resumable: false,
          final_report: finalReport,
        })
        .eq('id', sessionId);

      return !error;
    } catch (error) {
      console.error('[SessionPersistence] Error completing session:', error);
      return false;
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { error } = await this.supabase
        .from('research_sessions')
        .delete()
        .eq('id', sessionId);

      return !error;
    } catch (error) {
      console.error('[SessionPersistence] Error deleting session:', error);
      return false;
    }
  }

  /**
   * Save paper embeddings
   */
  async savePaperEmbeddings(
    papers: Array<{ paperId: string; embedding: number[]; textHash: string }>,
  ): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { error } = await this.supabase
        .from('paper_embeddings')
        .upsert(
          papers.map(p => ({
            paper_id: p.paperId,
            embedding: JSON.stringify(p.embedding), // pgvector accepts JSON array
            text_hash: p.textHash,
          })),
          { onConflict: 'paper_id' }
        );

      return !error;
    } catch (error) {
      console.error('[SessionPersistence] Error saving embeddings:', error);
      return false;
    }
  }

  /**
   * Find similar papers using vector search
   */
  async findSimilarPapers(
    queryEmbedding: number[],
    threshold: number = 0.5,
    limit: number = 10,
  ): Promise<Array<{ paperId: string; similarity: number }>> {
    if (!this.supabase) return [];

    try {
      const { data, error } = await this.supabase
        .rpc('find_similar_papers', {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: threshold,
          match_count: limit,
        });

      if (error || !data) {
        return [];
      }

      return data.map((row: { paper_id: string; similarity: number }) => ({
        paperId: row.paper_id,
        similarity: row.similarity,
      }));
    } catch (error) {
      console.error('[SessionPersistence] Error finding similar papers:', error);
      return [];
    }
  }
}

// Export singleton instance
export const sessionPersistence = new SessionPersistenceService();




