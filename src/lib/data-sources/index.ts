import type { Paper, DataSourceName as PaperSourceName } from '@/types/paper';
import { DataAvailability } from '@/types/paper';
import type {
  DataSource,
  DataSourceName,
  SearchOptions,
  AggregatedSearchResult,
  SearchResult,
} from './types';
import { SemanticScholarClient, semanticScholar } from './semantic-scholar';
import { OpenAlexClient, openAlex } from './openalex';
import { ArxivClient, arxiv } from './arxiv';
import { PubMedClient, pubmed } from './pubmed';
import { CoreClient, core } from './core';

// Re-export types and clients
export * from './types';
export { SemanticScholarClient, semanticScholar } from './semantic-scholar';
export { OpenAlexClient, openAlex } from './openalex';
export { ArxivClient, arxiv } from './arxiv';
export { PubMedClient, pubmed } from './pubmed';
export { CoreClient, core } from './core';
export { PaperEnricher, paperEnricher, enrichPaper, enrichPapers, getPaperSection, getPaperSections } from './enricher';
export { PaperCache, paperCache, withCache, withBatchCache, type CacheStats, type CacheConfig } from './cache';

export interface AggregatorConfig {
  enabledSources?: DataSourceName[];
  maxResultsPerSource?: number;
  timeout?: number; // ms
  deduplicateByDoi?: boolean;
  deduplicateByTitle?: boolean;
  sortBy?: 'relevance' | 'citations' | 'date';
  minCitations?: number;
  preferOpenAccess?: boolean;
  // Retry configuration
  maxRetries?: number;
  retryDelay?: number; // ms
  // Fallback configuration
  fallbackOnAllFail?: boolean;
  minSuccessfulSources?: number;
}

const DEFAULT_CONFIG: AggregatorConfig = {
  enabledSources: ['semantic-scholar', 'openalex', 'core'],
  maxResultsPerSource: 15,
  timeout: 30000,
  deduplicateByDoi: true,
  deduplicateByTitle: true,
  sortBy: 'citations',
  minCitations: 0,
  preferOpenAccess: true,
  // Retry defaults
  maxRetries: 2,
  retryDelay: 1000,
  // Fallback defaults
  fallbackOnAllFail: true,
  minSuccessfulSources: 1,
};

// Error tracking for monitoring
interface SourceError {
  source: DataSourceName;
  error: string;
  timestamp: number;
  retryCount: number;
}

/**
 * Unified data source aggregator that queries multiple academic databases
 * in parallel and deduplicates results, with retry and fallback support
 */
export class DataSourceAggregator {
  private sources: Map<DataSourceName, DataSource>;
  private config: AggregatorConfig;
  private recentErrors: SourceError[] = [];
  private maxErrorHistory = 100;

  constructor(config: Partial<AggregatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.sources = new Map<DataSourceName, DataSource>();
    this.sources.set('semantic-scholar', semanticScholar);
    this.sources.set('openalex', openAlex);
    this.sources.set('arxiv', arxiv);
    this.sources.set('pubmed', pubmed);
    this.sources.set('core', core);
  }

  /**
   * Check which data sources are available
   */
  async checkAvailability(): Promise<Record<DataSourceName, boolean>> {
    const results: Record<string, boolean> = {};
    
    await Promise.all(
      Array.from(this.sources.entries()).map(async ([name, source]) => {
        try {
          results[name] = await source.isAvailable();
        } catch {
          results[name] = false;
        }
      })
    );
    
    return results as Record<DataSourceName, boolean>;
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute a search with retry logic
   */
  private async searchWithRetry(
    source: DataSource,
    sourceName: DataSourceName,
    options: SearchOptions,
    maxRetries: number
  ): Promise<SearchResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Add timeout wrapper
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Timeout after ${this.config.timeout}ms`)), this.config.timeout);
        });

        const searchPromise = source.search(options);
        const result = await Promise.race([searchPromise, timeoutPromise]);
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Record error
        this.recordError(sourceName, lastError.message, attempt);
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          break;
        }
        
        // Wait before retry (with exponential backoff)
        if (attempt < maxRetries) {
          const delay = (this.config.retryDelay || 1000) * Math.pow(2, attempt);
          console.warn(`[${sourceName}] Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${lastError.message}`);
          await this.sleep(delay);
        }
      }
    }
    
    // All retries failed
    throw lastError || new Error(`Unknown error from ${sourceName}`);
  }

  /**
   * Check if an error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    // Don't retry on authentication errors, rate limits (let them cool down), or invalid requests
    return (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('invalid') ||
      message.includes('not found') ||
      message.includes('400') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('404')
    );
  }

  /**
   * Record an error for monitoring
   */
  private recordError(source: DataSourceName, error: string, retryCount: number): void {
    this.recentErrors.push({
      source,
      error,
      timestamp: Date.now(),
      retryCount,
    });
    
    // Keep error history bounded
    if (this.recentErrors.length > this.maxErrorHistory) {
      this.recentErrors = this.recentErrors.slice(-this.maxErrorHistory);
    }
  }

  /**
   * Get recent errors for monitoring
   */
  getRecentErrors(): SourceError[] {
    return [...this.recentErrors];
  }

  /**
   * Clear error history
   */
  clearErrors(): void {
    this.recentErrors = [];
  }

  /**
   * Search across multiple data sources in parallel with retry and fallback
   */
  async search(options: SearchOptions): Promise<AggregatedSearchResult> {
    const enabledSources = this.config.enabledSources || [];
    const maxPerSource = this.config.maxResultsPerSource || 15;
    const maxRetries = this.config.maxRetries || 2;

    // Use Promise.allSettled for graceful degradation
    const searchPromises = enabledSources.map(async (sourceName): Promise<{
      status: 'success' | 'failed';
      source: DataSourceName;
      papers: Paper[];
      totalHits: number;
      error?: string;
    }> => {
      const source = this.sources.get(sourceName);
      if (!source) {
        return { status: 'failed', source: sourceName, papers: [], totalHits: 0, error: 'Source not found' };
      }

      try {
        const result = await this.searchWithRetry(
          source,
          sourceName,
          { ...options, limit: maxPerSource },
          maxRetries
        );
        
        return {
          status: 'success',
          source: sourceName,
          papers: result.papers,
          totalHits: result.totalHits,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`[DataSourceAggregator] All retries failed for ${sourceName}:`, errorMessage);
        
        return {
          status: 'failed',
          source: sourceName,
          papers: [],
          totalHits: 0,
          error: errorMessage,
        };
      }
    });

    // Execute all searches in parallel
    const results = await Promise.all(searchPromises);

    // Separate successful and failed results
    const successfulResults = results.filter(r => r.status === 'success');
    const failedResults = results.filter(r => r.status === 'failed');

    // Log failures for debugging
    if (failedResults.length > 0) {
      console.warn(
        `[DataSourceAggregator] ${failedResults.length}/${results.length} sources failed:`,
        failedResults.map(r => `${r.source}: ${r.error}`).join(', ')
      );
    }

    // Check if we have minimum required sources
    const minSuccessful = this.config.minSuccessfulSources || 1;
    if (successfulResults.length < minSuccessful) {
      // Try fallback sources if enabled
      if (this.config.fallbackOnAllFail) {
        const fallbackResult = await this.tryFallbackSearch(options);
        if (fallbackResult) {
          successfulResults.push(fallbackResult);
        }
      }
      
      // Still not enough sources?
      if (successfulResults.length === 0) {
        throw new Error(
          `All data sources failed. Errors: ${failedResults.map(r => `${r.source}: ${r.error}`).join('; ')}`
        );
      }
    }

    // Aggregate results
    const sourceBreakdown: Record<DataSourceName, number> = {
      'core': 0,
      'semantic-scholar': 0,
      'openalex': 0,
      'arxiv': 0,
      'pubmed': 0,
    };

    let allPapers: Paper[] = [];
    let totalHits = 0;

    for (const result of successfulResults) {
      sourceBreakdown[result.source as DataSourceName] = result.papers.length;
      allPapers = allPapers.concat(result.papers);
      totalHits += result.totalHits;
    }

    // Deduplicate
    const { papers: dedupedPapers, removedCount } = this.deduplicatePapers(allPapers);

    // Apply filters
    let filteredPapers = dedupedPapers;
    
    // Min citations filter
    if (this.config.minCitations && this.config.minCitations > 0) {
      filteredPapers = filteredPapers.filter(
        p => (p.citations || 0) >= this.config.minCitations!
      );
    }

    // Sort results
    filteredPapers = this.sortPapers(filteredPapers, this.config.sortBy || 'citations');

    return {
      papers: filteredPapers,
      totalHits,
      sourceBreakdown,
      dedupedCount: removedCount,
      // Extended metadata
      metadata: {
        successfulSources: successfulResults.map(r => r.source),
        failedSources: failedResults.map(r => ({ source: r.source, error: r.error })),
        searchTime: Date.now(),
      },
    } as AggregatedSearchResult;
  }

  /**
   * Try alternative sources as fallback
   */
  private async tryFallbackSearch(options: SearchOptions): Promise<{
    status: 'success';
    source: DataSourceName;
    papers: Paper[];
    totalHits: number;
  } | null> {
    // Try sources that weren't in the primary list
    const primarySources = new Set(this.config.enabledSources || []);
    const fallbackOrder: DataSourceName[] = ['openalex', 'semantic-scholar', 'arxiv', 'pubmed', 'core'];
    
    for (const sourceName of fallbackOrder) {
      if (primarySources.has(sourceName)) continue;
      
      const source = this.sources.get(sourceName);
      if (!source) continue;
      
      try {
        console.log(`[DataSourceAggregator] Trying fallback source: ${sourceName}`);
        const result = await source.search({
          ...options,
          limit: this.config.maxResultsPerSource || 15,
        });
        
        if (result.papers.length > 0) {
          return {
            status: 'success',
            source: sourceName,
            papers: result.papers,
            totalHits: result.totalHits,
          };
        }
      } catch (error) {
        console.warn(`[DataSourceAggregator] Fallback ${sourceName} also failed:`, error);
      }
    }
    
    return null;
  }

  /**
   * Deduplicate papers by DOI and/or title similarity
   */
  private deduplicatePapers(papers: Paper[]): { papers: Paper[]; removedCount: number } {
    const seen = new Map<string, Paper>();
    const seenTitles = new Map<string, Paper>();
    let removedCount = 0;

    for (const paper of papers) {
      // Check DOI deduplication
      if (this.config.deduplicateByDoi && paper.doi) {
        const normalizedDoi = paper.doi.toLowerCase().trim();
        if (seen.has(normalizedDoi)) {
          // Merge data, preferring paper with more info
          const existing = seen.get(normalizedDoi)!;
          seen.set(normalizedDoi, this.mergePapers(existing, paper));
          removedCount++;
          continue;
        }
        seen.set(normalizedDoi, paper);
      }

      // Check title similarity deduplication
      if (this.config.deduplicateByTitle) {
        const normalizedTitle = this.normalizeTitle(paper.title);
        if (seenTitles.has(normalizedTitle)) {
          const existing = seenTitles.get(normalizedTitle)!;
          seenTitles.set(normalizedTitle, this.mergePapers(existing, paper));
          removedCount++;
          continue;
        }
        seenTitles.set(normalizedTitle, paper);
      }

      // If neither dedup method caught it, add to results
      if (!this.config.deduplicateByDoi && !this.config.deduplicateByTitle) {
        seen.set(paper.id, paper);
      }
    }

    // Combine results
    const uniquePapers = new Map<string, Paper>();
    
    for (const paper of seen.values()) {
      const key = paper.doi?.toLowerCase() || paper.id;
      if (!uniquePapers.has(key)) {
        uniquePapers.set(key, paper);
      }
    }
    
    for (const paper of seenTitles.values()) {
      const key = paper.doi?.toLowerCase() || this.normalizeTitle(paper.title);
      if (!uniquePapers.has(key)) {
        uniquePapers.set(key, paper);
      }
    }

    return {
      papers: Array.from(uniquePapers.values()),
      removedCount,
    };
  }

  /**
   * Normalize title for comparison
   */
  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')         // Normalize whitespace
      .trim()
      .slice(0, 100);               // Use first 100 chars for matching
  }

  /**
   * Merge two papers, preferring more complete data
   * Priority: higher dataAvailability > more content > existing data
   */
  private mergePapers(existing: Paper, incoming: Paper): Paper {
    // Determine which paper has better data availability
    const existingAvailability = existing.dataAvailability || DataAvailability.METADATA_ONLY;
    const incomingAvailability = incoming.dataAvailability || DataAvailability.METADATA_ONLY;
    
    // If incoming has significantly better data, use it as base
    const useIncomingAsBase = incomingAvailability > existingAvailability;
    const [base, other] = useIncomingAsBase ? [incoming, existing] : [existing, incoming];
    
    // Merge source origins (deduplicated)
    const mergedSources = [...new Set([
      ...(existing.sourceOrigin || []),
      ...(incoming.sourceOrigin || []),
    ])] as PaperSourceName[];
    
    // Use highest data availability
    const mergedAvailability = Math.max(existingAvailability, incomingAvailability) as DataAvailability;
    
    return {
      id: existing.id, // Keep original ID for consistency
      title: base.title.length > other.title.length ? base.title : other.title,
      authors: base.authors.length >= other.authors.length ? base.authors : other.authors,
      abstract: (base.abstract?.length || 0) >= (other.abstract?.length || 0) 
        ? base.abstract 
        : other.abstract,
      year: base.year || other.year,
      publishedDate: base.publishedDate || other.publishedDate,
      doi: base.doi || other.doi,
      downloadUrl: base.downloadUrl || other.downloadUrl,
      sourceUrl: base.sourceUrl || other.sourceUrl,
      journal: base.journal || other.journal,
      publisher: base.publisher || other.publisher,
      subjects: [...new Set([...(base.subjects || []), ...(other.subjects || [])])],
      citations: Math.max(base.citations || 0, other.citations || 0),
      references: base.references || other.references,
      openAccess: base.openAccess || other.openAccess,
      language: base.language || other.language,
      fullText: base.fullText || other.fullText,
      // Extended metadata
      volume: base.volume || other.volume,
      issue: base.issue || other.issue,
      pages: base.pages || other.pages,
      isbn: base.isbn || other.isbn,
      issn: base.issn || other.issn,
      conference: base.conference || other.conference,
      edition: base.edition || other.edition,
      location: base.location || other.location,
      // New merged fields
      dataAvailability: mergedAvailability,
      sourceOrigin: mergedSources,
      lastEnriched: base.lastEnriched || other.lastEnriched,
      fullTextSections: base.fullTextSections || other.fullTextSections,
      pdfUrl: base.pdfUrl || other.pdfUrl,
    };
  }

  /**
   * Sort papers by specified criteria
   * Secondary sort by data availability (prefer papers with more data)
   */
  private sortPapers(papers: Paper[], sortBy: 'relevance' | 'citations' | 'date'): Paper[] {
    const getAvailability = (p: Paper) => p.dataAvailability || DataAvailability.METADATA_ONLY;
    
    switch (sortBy) {
      case 'citations':
        return papers.sort((a, b) => {
          // Primary sort by citations
          const citeDiff = (b.citations || 0) - (a.citations || 0);
          if (Math.abs(citeDiff) < 5) {
            // When citations are similar, prefer higher data availability
            const availDiff = getAvailability(b) - getAvailability(a);
            if (availDiff !== 0) return availDiff;
            // Then prefer open access
            if (this.config.preferOpenAccess) {
              if (a.openAccess && !b.openAccess) return -1;
              if (!a.openAccess && b.openAccess) return 1;
            }
          }
          return citeDiff;
        });
      
      case 'date':
        return papers.sort((a, b) => {
          const yearDiff = b.year - a.year;
          if (yearDiff === 0) {
            // Same year: prefer higher data availability
            return getAvailability(b) - getAvailability(a);
          }
          return yearDiff;
        });
      
      case 'relevance':
      default:
        // For relevance, prefer higher data availability, then open access
        return papers.sort((a, b) => {
          const availDiff = getAvailability(b) - getAvailability(a);
          if (availDiff !== 0) return availDiff;
          if (this.config.preferOpenAccess) {
            if (a.openAccess && !b.openAccess) return -1;
            if (!a.openAccess && b.openAccess) return 1;
          }
          return 0;
        });
    }
  }

  /**
   * Get a paper by ID from any source with retry
   */
  async getPaper(id: string): Promise<Paper | null> {
    // Determine source from ID prefix
    let source: DataSource | undefined;
    let sourceName: DataSourceName | undefined;
    
    if (id.startsWith('s2-')) {
      source = this.sources.get('semantic-scholar');
      sourceName = 'semantic-scholar';
    } else if (id.startsWith('oa-')) {
      source = this.sources.get('openalex');
      sourceName = 'openalex';
    } else if (id.startsWith('arxiv-')) {
      source = this.sources.get('arxiv');
      sourceName = 'arxiv';
    } else if (id.startsWith('pubmed-')) {
      source = this.sources.get('pubmed');
      sourceName = 'pubmed';
    } else {
      // Try CORE as default
      source = this.sources.get('core');
      sourceName = 'core';
    }

    if (source && sourceName) {
      try {
        return await this.getPaperWithRetry(source, sourceName, id);
      } catch {
        // Fall through to try other sources
      }
    }

    // If source not determined or failed, try all enabled sources
    for (const srcName of this.config.enabledSources || []) {
      if (srcName === sourceName) continue; // Already tried
      
      const src = this.sources.get(srcName);
      if (src) {
        try {
          const paper = await this.getPaperWithRetry(src, srcName, id);
          if (paper) return paper;
        } catch {
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Get paper with retry logic
   */
  private async getPaperWithRetry(
    source: DataSource,
    sourceName: DataSourceName,
    id: string
  ): Promise<Paper | null> {
    const maxRetries = this.config.maxRetries || 2;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await source.getPaper(id);
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        const delay = (this.config.retryDelay || 1000) * Math.pow(2, attempt);
        await this.sleep(delay);
      }
    }
    
    return null;
  }

  /**
   * Get paper by DOI from any source with retry
   */
  async getPaperByDoi(doi: string): Promise<Paper | null> {
    // Try OpenAlex first (best DOI coverage)
    try {
      const oaPaper = await openAlex.getPaperByDoi(doi);
      if (oaPaper) return oaPaper;
    } catch {
      // Continue to next source
    }

    // Try Semantic Scholar
    try {
      const s2Result = await semanticScholar.search({ query: `doi:${doi}`, limit: 1 });
      if (s2Result.papers.length > 0) return s2Result.papers[0];
    } catch {
      // All sources failed
    }

    return null;
  }

  /**
   * Get citation graph for a paper
   */
  async getCitationGraph(paperId: string, depth: number = 1): Promise<{
    paper: Paper;
    citations: Paper[];
    references: Paper[];
  } | null> {
    const paper = await this.getPaper(paperId);
    if (!paper) return null;

    // Get citations and references from Semantic Scholar
    const s2Id = paperId.startsWith('s2-') ? paperId.replace('s2-', '') : paperId;
    
    try {
      const [citations, references] = await Promise.all([
        semanticScholar.getCitations(s2Id, 10).catch(() => []),
        semanticScholar.getReferences(s2Id, 10).catch(() => []),
      ]);

      return { paper, citations, references };
    } catch {
      return { paper, citations: [], references: [] };
    }
  }

  /**
   * Get recommended papers based on a list of papers
   */
  async getRecommendations(paperIds: string[], limit: number = 10): Promise<Paper[]> {
    if (paperIds.length === 0) return [];
    
    // Use Semantic Scholar recommendations
    const s2Ids = paperIds.map(id => id.replace('s2-', ''));
    
    try {
      return await semanticScholar.getRecommendations(s2Ids, limit);
    } catch {
      return [];
    }
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<AggregatorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): AggregatorConfig {
    return { ...this.config };
  }

  /**
   * Get health status of all sources
   */
  async getHealthStatus(): Promise<{
    sources: Record<DataSourceName, {
      available: boolean;
      recentErrors: number;
      lastError?: string;
    }>;
    overallHealthy: boolean;
  }> {
    const availability = await this.checkAvailability();
    const sources: Record<string, { available: boolean; recentErrors: number; lastError?: string }> = {};
    
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const [name, available] of Object.entries(availability)) {
      const recentSourceErrors = this.recentErrors.filter(
        e => e.source === name && e.timestamp > oneHourAgo
      );
      
      sources[name] = {
        available,
        recentErrors: recentSourceErrors.length,
        lastError: recentSourceErrors[recentSourceErrors.length - 1]?.error,
      };
    }
    
    const healthySources = Object.values(sources).filter(s => s.available).length;
    
    return {
      sources: sources as Record<DataSourceName, { available: boolean; recentErrors: number; lastError?: string }>,
      overallHealthy: healthySources >= (this.config.minSuccessfulSources || 1),
    };
  }
}

// Export default aggregator instance
export const dataSourceAggregator = new DataSourceAggregator();

// Convenience function for simple searches
export async function searchAcademicPapers(
  query: string,
  options: Partial<SearchOptions & AggregatorConfig> = {}
): Promise<AggregatedSearchResult> {
  const aggregator = new DataSourceAggregator(options);
  return aggregator.search({ query, ...options });
}
