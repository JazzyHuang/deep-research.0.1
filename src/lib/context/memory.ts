import type { Paper } from '@/types/paper';
import type { 
  ResearchPlan, 
  SearchRound, 
  ResearchReport,
  QualityMetrics,
  CriticAnalysis,
} from '@/types/research';

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
   * Mark a gap as addressed
   */
  resolveGap(gap: string): void {
    const index = this.state.gaps.indexOf(gap);
    if (index !== -1) {
      this.state.gaps.splice(index, 1);
    }
    this.touch();
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









