import type { Paper } from '@/types/paper';
import type { 
  ResearchPlan, 
  SearchRound, 
  ResearchReport,
  QualityMetrics,
  CriticAnalysis,
} from '@/types/research';

/**
 * Processed topic tracking to avoid duplicate content
 */
export interface ProcessedTopic {
  topic: string;
  searchQueries: string[];
  paperIds: string[];
  coverage: number; // 0-100 how well covered
  iteration: number;
  timestamp: Date;
}

/**
 * Embedding summary for semantic retrieval
 */
export interface EmbeddingSummary {
  id: string;
  type: 'finding' | 'gap' | 'insight' | 'paper_summary';
  content: string;
  embedding?: number[]; // Vector embedding for semantic search
  sourceIds: string[]; // Paper IDs or other sources
  relevanceScore?: number;
  timestamp: Date;
}

/**
 * Gap tracking with status
 */
export interface TrackedGap {
  id: string;
  description: string;
  status: 'open' | 'in_progress' | 'addressed' | 'wont_fix';
  searchesAttempted: string[];
  papersFound: string[];
  iteration: number;
  addressedIteration?: number;
  notes?: string;
}

/**
 * Research memory for maintaining context across iterations
 */
export interface ResearchMemoryState {
  sessionId: string;
  query: string;
  plan: ResearchPlan | null;
  searchRounds: SearchRound[];
  papers: Map<string, Paper>;
  citations: Map<string, { paperId: string; claims: string[] }>;
  reportVersions: Array<{
    content: string;
    iteration: number;
    timestamp: Date;
    metrics?: QualityMetrics;
    analysis?: CriticAnalysis;
  }>;
  insights: string[];
  gaps: string[];
  iteration: number;
  startTime: Date;
  lastUpdateTime: Date;
  
  // Enhanced memory features
  processedTopics: Map<string, ProcessedTopic>;
  embeddingSummaries: Map<string, EmbeddingSummary>;
  trackedGaps: Map<string, TrackedGap>;
  topicCoverage: Map<string, number>; // topic -> coverage percentage
}

/**
 * In-memory research context manager
 */
export class ResearchMemory {
  private state: ResearchMemoryState;

  constructor(sessionId: string, query: string) {
    this.state = {
      sessionId,
      query,
      plan: null,
      searchRounds: [],
      papers: new Map(),
      citations: new Map(),
      reportVersions: [],
      insights: [],
      gaps: [],
      iteration: 0,
      startTime: new Date(),
      lastUpdateTime: new Date(),
      // Enhanced memory features
      processedTopics: new Map(),
      embeddingSummaries: new Map(),
      trackedGaps: new Map(),
      topicCoverage: new Map(),
    };
  }

  // Getters
  get sessionId(): string { return this.state.sessionId; }
  get query(): string { return this.state.query; }
  get plan(): ResearchPlan | null { return this.state.plan; }
  get iteration(): number { return this.state.iteration; }
  get papers(): Paper[] { return Array.from(this.state.papers.values()); }
  get searchRounds(): SearchRound[] { return this.state.searchRounds; }
  get insights(): string[] { return this.state.insights; }
  get gaps(): string[] { return this.state.gaps; }

  /**
   * Set the research plan
   */
  setPlan(plan: ResearchPlan): void {
    this.state.plan = plan;
    this.touch();
  }

  /**
   * Add a search round
   */
  addSearchRound(round: SearchRound): void {
    this.state.searchRounds.push(round);
    
    // Add papers to the collection
    for (const paper of round.papers) {
      if (!this.state.papers.has(paper.id)) {
        this.state.papers.set(paper.id, paper);
      }
    }
    
    this.touch();
  }

  /**
   * Add papers directly
   */
  addPapers(papers: Paper[]): void {
    for (const paper of papers) {
      if (!this.state.papers.has(paper.id)) {
        this.state.papers.set(paper.id, paper);
      }
    }
    this.touch();
  }

  /**
   * Get a specific paper by ID
   */
  getPaper(id: string): Paper | undefined {
    return this.state.papers.get(id);
  }

  /**
   * Record a citation usage
   */
  recordCitation(citationId: string, paperId: string, claim: string): void {
    const existing = this.state.citations.get(citationId);
    if (existing) {
      existing.claims.push(claim);
    } else {
      this.state.citations.set(citationId, { paperId, claims: [claim] });
    }
    this.touch();
  }

  /**
   * Save a report version
   */
  saveReportVersion(
    content: string,
    metrics?: QualityMetrics,
    analysis?: CriticAnalysis,
  ): void {
    this.state.reportVersions.push({
      content,
      iteration: this.state.iteration,
      timestamp: new Date(),
      metrics,
      analysis,
    });
    this.touch();
  }

  /**
   * Get the latest report version
   */
  getLatestReport(): string | null {
    if (this.state.reportVersions.length === 0) return null;
    return this.state.reportVersions[this.state.reportVersions.length - 1].content;
  }

  /**
   * Get previous report version for comparison
   */
  getPreviousReport(): string | null {
    if (this.state.reportVersions.length < 2) return null;
    return this.state.reportVersions[this.state.reportVersions.length - 2].content;
  }

  /**
   * Get all report versions
   */
  getReportHistory(): ResearchMemoryState['reportVersions'] {
    return [...this.state.reportVersions];
  }

  /**
   * Add an insight from analysis
   */
  addInsight(insight: string): void {
    if (!this.state.insights.includes(insight)) {
      this.state.insights.push(insight);
    }
    this.touch();
  }

  /**
   * Add a gap identified by critic
   */
  addGap(gap: string): void {
    if (!this.state.gaps.includes(gap)) {
      this.state.gaps.push(gap);
    }
    this.touch();
  }

  /**
   * Mark a gap as addressed (legacy method)
   */
  resolveGap(gap: string): void {
    const index = this.state.gaps.indexOf(gap);
    if (index !== -1) {
      this.state.gaps.splice(index, 1);
    }
    
    // Also update tracked gap if exists
    for (const [id, trackedGap] of this.state.trackedGaps) {
      if (trackedGap.description === gap) {
        trackedGap.status = 'addressed';
        trackedGap.addressedIteration = this.state.iteration;
        break;
      }
    }
    
    this.touch();
  }
  
  // ============================================
  // Enhanced Memory Features
  // ============================================
  
  /**
   * Track a processed topic to avoid duplicate searches
   */
  trackProcessedTopic(
    topic: string,
    searchQuery: string,
    paperIds: string[],
    coverage: number = 50
  ): void {
    const normalizedTopic = topic.toLowerCase().trim();
    const existing = this.state.processedTopics.get(normalizedTopic);
    
    if (existing) {
      // Update existing topic
      if (!existing.searchQueries.includes(searchQuery)) {
        existing.searchQueries.push(searchQuery);
      }
      existing.paperIds = [...new Set([...existing.paperIds, ...paperIds])];
      existing.coverage = Math.max(existing.coverage, coverage);
      existing.iteration = this.state.iteration;
    } else {
      // Create new topic tracking
      this.state.processedTopics.set(normalizedTopic, {
        topic: normalizedTopic,
        searchQueries: [searchQuery],
        paperIds,
        coverage,
        iteration: this.state.iteration,
        timestamp: new Date(),
      });
    }
    
    this.state.topicCoverage.set(normalizedTopic, 
      Math.max(this.state.topicCoverage.get(normalizedTopic) || 0, coverage)
    );
    
    this.touch();
  }
  
  /**
   * Check if a topic has already been processed
   */
  isTopicProcessed(topic: string, minCoverage: number = 50): boolean {
    const normalizedTopic = topic.toLowerCase().trim();
    const processed = this.state.processedTopics.get(normalizedTopic);
    return processed !== undefined && processed.coverage >= minCoverage;
  }
  
  /**
   * Get topics that need more coverage
   */
  getUncoveredTopics(threshold: number = 70): ProcessedTopic[] {
    return Array.from(this.state.processedTopics.values())
      .filter(t => t.coverage < threshold)
      .sort((a, b) => a.coverage - b.coverage);
  }
  
  /**
   * Store an embedding summary for semantic retrieval
   */
  addEmbeddingSummary(
    type: EmbeddingSummary['type'],
    content: string,
    sourceIds: string[],
    embedding?: number[]
  ): string {
    const id = `emb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    
    this.state.embeddingSummaries.set(id, {
      id,
      type,
      content,
      embedding,
      sourceIds,
      timestamp: new Date(),
    });
    
    this.touch();
    return id;
  }
  
  /**
   * Get embedding summaries by type
   */
  getEmbeddingSummaries(type?: EmbeddingSummary['type']): EmbeddingSummary[] {
    const summaries = Array.from(this.state.embeddingSummaries.values());
    return type ? summaries.filter(s => s.type === type) : summaries;
  }
  
  /**
   * Add a tracked gap with status
   */
  addTrackedGap(description: string, notes?: string): string {
    const id = `gap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    
    // Also add to legacy gaps array for backward compatibility
    if (!this.state.gaps.includes(description)) {
      this.state.gaps.push(description);
    }
    
    this.state.trackedGaps.set(id, {
      id,
      description,
      status: 'open',
      searchesAttempted: [],
      papersFound: [],
      iteration: this.state.iteration,
      notes,
    });
    
    this.touch();
    return id;
  }
  
  /**
   * Update gap status and record search attempts
   */
  updateGapStatus(
    gapId: string,
    status: TrackedGap['status'],
    searchQuery?: string,
    papersFound?: string[]
  ): void {
    const gap = this.state.trackedGaps.get(gapId);
    if (!gap) return;
    
    gap.status = status;
    
    if (searchQuery && !gap.searchesAttempted.includes(searchQuery)) {
      gap.searchesAttempted.push(searchQuery);
    }
    
    if (papersFound) {
      gap.papersFound = [...new Set([...gap.papersFound, ...papersFound])];
    }
    
    if (status === 'addressed') {
      gap.addressedIteration = this.state.iteration;
      
      // Remove from legacy gaps array
      const index = this.state.gaps.indexOf(gap.description);
      if (index !== -1) {
        this.state.gaps.splice(index, 1);
      }
    }
    
    this.touch();
  }
  
  /**
   * Get open gaps that need attention
   */
  getOpenGaps(): TrackedGap[] {
    return Array.from(this.state.trackedGaps.values())
      .filter(g => g.status === 'open' || g.status === 'in_progress');
  }
  
  /**
   * Get relevant context for the next iteration
   * Prioritizes recent insights, open gaps, and uncovered topics
   */
  getRelevantContext(maxTokens: number = 2000): {
    summary: string;
    keyFindings: string[];
    openGaps: TrackedGap[];
    uncoveredTopics: ProcessedTopic[];
    recentInsights: string[];
  } {
    const openGaps = this.getOpenGaps();
    const uncoveredTopics = this.getUncoveredTopics();
    const recentInsights = this.state.insights.slice(-10);
    
    // Get key findings from embedding summaries
    const keyFindings = this.getEmbeddingSummaries('finding')
      .slice(-10)
      .map(s => s.content);
    
    // Build summary
    let summary = `Research Progress Summary (Iteration ${this.state.iteration}):\n`;
    summary += `- Papers collected: ${this.state.papers.size}\n`;
    summary += `- Open gaps: ${openGaps.length}\n`;
    summary += `- Uncovered topics: ${uncoveredTopics.length}\n`;
    
    if (openGaps.length > 0) {
      summary += `\nOpen Gaps to Address:\n`;
      openGaps.slice(0, 5).forEach(g => {
        summary += `- ${g.description} (${g.searchesAttempted.length} searches attempted)\n`;
      });
    }
    
    if (uncoveredTopics.length > 0) {
      summary += `\nTopics Needing More Coverage:\n`;
      uncoveredTopics.slice(0, 5).forEach(t => {
        summary += `- ${t.topic} (${t.coverage}% covered)\n`;
      });
    }
    
    if (recentInsights.length > 0) {
      summary += `\nRecent Insights:\n`;
      recentInsights.slice(-5).forEach(i => {
        summary += `- ${i}\n`;
      });
    }
    
    return {
      summary,
      keyFindings,
      openGaps,
      uncoveredTopics,
      recentInsights,
    };
  }
  
  /**
   * Check if a search query is redundant
   */
  isSearchRedundant(query: string): boolean {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Check if this exact query was used before
    for (const round of this.state.searchRounds) {
      if (round.query.toLowerCase().trim() === normalizedQuery) {
        return true;
      }
    }
    
    // Check if topic was already well-covered
    const words = normalizedQuery.split(/\s+/).filter(w => w.length > 3);
    for (const word of words) {
      if (this.isTopicProcessed(word, 80)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get gaps that haven't been adequately addressed
   */
  getUnaddressedGaps(): string[] {
    const addressed = new Set(
      Array.from(this.state.trackedGaps.values())
        .filter(g => g.status === 'addressed')
        .map(g => g.description)
    );
    
    return this.state.gaps.filter(g => !addressed.has(g));
  }

  /**
   * Increment iteration counter
   */
  incrementIteration(): number {
    this.state.iteration++;
    this.touch();
    return this.state.iteration;
  }

  /**
   * Get summary statistics
   */
  getStats(): {
    totalPapers: number;
    totalSearchRounds: number;
    totalIterations: number;
    totalReportVersions: number;
    uniqueCitations: number;
    elapsedMinutes: number;
  } {
    const elapsedMs = Date.now() - this.state.startTime.getTime();
    
    return {
      totalPapers: this.state.papers.size,
      totalSearchRounds: this.state.searchRounds.length,
      totalIterations: this.state.iteration,
      totalReportVersions: this.state.reportVersions.length,
      uniqueCitations: this.state.citations.size,
      elapsedMinutes: Math.round(elapsedMs / 60000),
    };
  }

  /**
   * Get context summary for prompts
   */
  getContextSummary(): string {
    const stats = this.getStats();
    
    let summary = `Research Session: ${this.state.sessionId}\n`;
    summary += `Query: "${this.state.query}"\n`;
    summary += `Duration: ${stats.elapsedMinutes} minutes\n`;
    summary += `Progress: Iteration ${stats.totalIterations}, ${stats.totalPapers} papers collected\n`;
    
    if (this.state.plan) {
      summary += `\nResearch Plan:\n`;
      summary += `- Main Question: ${this.state.plan.mainQuestion}\n`;
      summary += `- Sub-questions: ${this.state.plan.subQuestions.length}\n`;
    }
    
    if (this.state.gaps.length > 0) {
      summary += `\nIdentified Gaps:\n`;
      this.state.gaps.slice(0, 5).forEach(gap => {
        summary += `- ${gap}\n`;
      });
    }
    
    if (this.state.insights.length > 0) {
      summary += `\nKey Insights:\n`;
      this.state.insights.slice(0, 5).forEach(insight => {
        summary += `- ${insight}\n`;
      });
    }
    
    return summary;
  }

  /**
   * Export state for persistence
   */
  export(): object {
    return {
      ...this.state,
      papers: Array.from(this.state.papers.entries()),
      citations: Array.from(this.state.citations.entries()),
      processedTopics: Array.from(this.state.processedTopics.entries()),
      embeddingSummaries: Array.from(this.state.embeddingSummaries.entries()),
      trackedGaps: Array.from(this.state.trackedGaps.entries()),
      topicCoverage: Array.from(this.state.topicCoverage.entries()),
    };
  }

  /**
   * Import state from persistence
   */
  static import(data: ReturnType<ResearchMemory['export']>): ResearchMemory {
    const memory = new ResearchMemory('', '');
    const imported = data as unknown as {
      sessionId: string;
      query: string;
      plan: ResearchPlan | null;
      searchRounds: SearchRound[];
      papers: [string, Paper][];
      citations: [string, { paperId: string; claims: string[] }][];
      reportVersions: ResearchMemoryState['reportVersions'];
      insights: string[];
      gaps: string[];
      iteration: number;
      startTime: string | Date;
      lastUpdateTime: string | Date;
      processedTopics?: [string, ProcessedTopic][];
      embeddingSummaries?: [string, EmbeddingSummary][];
      trackedGaps?: [string, TrackedGap][];
      topicCoverage?: [string, number][];
    };
    
    memory.state = {
      sessionId: imported.sessionId,
      query: imported.query,
      plan: imported.plan,
      searchRounds: imported.searchRounds,
      papers: new Map(imported.papers),
      citations: new Map(imported.citations),
      reportVersions: imported.reportVersions,
      insights: imported.insights,
      gaps: imported.gaps,
      iteration: imported.iteration,
      startTime: new Date(imported.startTime),
      lastUpdateTime: new Date(imported.lastUpdateTime),
      // Enhanced memory features (with defaults for backward compatibility)
      processedTopics: new Map(imported.processedTopics || []),
      embeddingSummaries: new Map(imported.embeddingSummaries || []),
      trackedGaps: new Map(imported.trackedGaps || []),
      topicCoverage: new Map(imported.topicCoverage || []),
    };
    
    return memory;
  }

  /**
   * Update last modified time
   */
  private touch(): void {
    this.state.lastUpdateTime = new Date();
  }
}

/**
 * Memory manager for multiple research sessions
 */
export class MemoryManager {
  private sessions: Map<string, ResearchMemory> = new Map();
  private maxSessions: number;

  constructor(maxSessions: number = 100) {
    this.maxSessions = maxSessions;
  }

  /**
   * Create or get a research session
   */
  getSession(sessionId: string, query?: string): ResearchMemory {
    let session = this.sessions.get(sessionId);
    
    if (!session && query) {
      session = new ResearchMemory(sessionId, query);
      this.sessions.set(sessionId, session);
      
      // Cleanup old sessions if needed
      this.cleanup();
    }
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    return session;
  }

  /**
   * Check if session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Remove a session
   */
  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Cleanup old sessions to stay within limits
   */
  private cleanup(): void {
    if (this.sessions.size <= this.maxSessions) return;
    
    // Remove oldest sessions
    const sessionsToRemove = this.sessions.size - this.maxSessions;
    const sessionIds = Array.from(this.sessions.keys());
    
    for (let i = 0; i < sessionsToRemove; i++) {
      this.sessions.delete(sessionIds[i]);
    }
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }
}

// Global memory manager instance
export const memoryManager = new MemoryManager();









