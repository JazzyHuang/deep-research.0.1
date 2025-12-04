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
import { queryCache } from './cache';

// Re-export types and clients
export * from './types';
export { SemanticScholarClient, semanticScholar } from './semantic-scholar';
export { OpenAlexClient, openAlex } from './openalex';
export { ArxivClient, arxiv } from './arxiv';
export { PubMedClient, pubmed } from './pubmed';
export { CoreClient, core } from './core';
export { PaperEnricher, paperEnricher, enrichPaper, enrichPapers, getPaperSection, getPaperSections } from './enricher';
export { 
  PaperCache, 
  paperCache, 
  withCache, 
  withBatchCache, 
  QueryCache,
  queryCache,
  type CacheStats, 
  type CacheConfig,
  type QueryCacheConfig,
} from './cache';

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
  // Smart source selection
  enableSmartSourceSelection?: boolean;
}

/**
 * Domain classification for smart source selection
 */
export type QueryDomain = 'biomedical' | 'cs_ai' | 'physics_math' | 'general';

/**
 * Domain keyword patterns for classification
 */
const DOMAIN_PATTERNS: Record<QueryDomain, RegExp[]> = {
  biomedical: [
    /\b(medic|clinic|patient|disease|drug|pharma|health|cancer|tumor|cell|gene|protein|dna|rna|virus|bacteria|immun|neuro|cardio|brain|blood|liver|kidney|lung|surgery|therapy|diagnosis|symptom|treatment|patholog|oncolog|epidem|vaccine|antibiot|hospital|physician)/i,
    /\b(covid|sars|influenza|diabetes|alzheimer|parkinson|stroke|heart\s*attack|hypertension|asthma|arthritis|obesity)/i,
  ],
  cs_ai: [
    /\b(machine\s*learning|deep\s*learning|neural\s*network|artificial\s*intelligence|nlp|natural\s*language|computer\s*vision|reinforcement\s*learning|transformer|bert|gpt|llm|large\s*language\s*model)/i,
    /\b(algorithm|software|programming|database|network|cyber|crypto|blockchain|cloud|distributed|parallel|concurrent|compiler|operating\s*system)/i,
    /\b(robot|autonom|perception|planning|optimization|classification|clustering|regression|embedding|attention\s*mechanism)/i,
  ],
  physics_math: [
    /\b(quantum|relativity|particle|photon|electron|proton|neutron|boson|fermion|quark|string\s*theory|cosmolog|astrophys|gravit)/i,
    /\b(theorem|proof|conjecture|topology|algebra|calculus|differential\s*equation|stochastic|probability|statistic|linear\s*algebra|manifold)/i,
    /\b(physics|mathematical|mechanics|thermodynamics|electromagnetism|optics|semiconductor|superconductor)/i,
  ],
  general: [], // Fallback domain
};

/**
 * Optimal source configuration per domain
 */
const DOMAIN_SOURCE_PRIORITY: Record<QueryDomain, DataSourceName[]> = {
  biomedical: ['pubmed', 'semantic-scholar', 'openalex'],
  cs_ai: ['semantic-scholar', 'arxiv', 'openalex'],
  physics_math: ['arxiv', 'openalex', 'semantic-scholar'],
  general: ['openalex', 'semantic-scholar', 'core'],
};

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy title matching in deduplication
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  // Create a 2D array for dynamic programming
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  
  // Initialize base cases
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],      // deletion
          dp[i][j - 1],      // insertion
          dp[i - 1][j - 1]   // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Calculate similarity ratio between two strings (0-1)
 * 1 = identical, 0 = completely different
 */
export function calculateTitleSimilarity(title1: string, title2: string): number {
  const normalized1 = title1.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const normalized2 = title2.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  if (normalized1 === normalized2) return 1;
  if (normalized1.length === 0 || normalized2.length === 0) return 0;
  
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  
  return 1 - (distance / maxLength);
}

/**
 * Check if two titles are similar enough to be considered duplicates
 */
export function areTitlesSimilar(title1: string, title2: string, threshold: number = 0.85): boolean {
  return calculateTitleSimilarity(title1, title2) >= threshold;
}

/**
 * Classify query into a domain based on keyword patterns
 */
export function classifyQueryDomain(query: string): QueryDomain {
  const normalizedQuery = query.toLowerCase();
  
  // Score each domain
  const scores: Record<QueryDomain, number> = {
    biomedical: 0,
    cs_ai: 0,
    physics_math: 0,
    general: 0,
  };
  
  for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS) as [QueryDomain, RegExp[]][]) {
    for (const pattern of patterns) {
      const matches = normalizedQuery.match(pattern);
      if (matches) {
        scores[domain] += matches.length;
      }
    }
  }
  
  // Find highest scoring domain
  let maxScore = 0;
  let bestDomain: QueryDomain = 'general';
  
  for (const [domain, score] of Object.entries(scores) as [QueryDomain, number][]) {
    if (score > maxScore) {
      maxScore = score;
      bestDomain = domain;
    }
  }
  
  return bestDomain;
}

/**
 * Select optimal data sources based on query domain
 */
export function selectSourcesForQuery(
  query: string,
  maxSources: number = 3,
): DataSourceName[] {
  const domain = classifyQueryDomain(query);
  const prioritySources = DOMAIN_SOURCE_PRIORITY[domain];
  
  // Return top N sources for this domain
  return prioritySources.slice(0, maxSources);
}

const DEFAULT_CONFIG: AggregatorConfig = {
  enabledSources: ['openalex', 'semantic-scholar', 'core'],
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
  // Smart source selection (enabled by default)
  enableSmartSourceSelection: true,
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
   * Supports smart source selection based on query domain and query caching
   */
  async search(options: SearchOptions & { sessionId?: string }): Promise<AggregatedSearchResult> {
    // Check query cache first
    const cachedResult = queryCache.get(
      options.query,
      { yearFrom: options.yearFrom, yearTo: options.yearTo, openAccess: options.openAccess },
      options.sessionId
    );
    
    if (cachedResult) {
      console.log(`[DataSourceAggregator] Cache hit for query: "${options.query.slice(0, 50)}..."`);
      return {
        papers: cachedResult.papers,
        totalHits: cachedResult.totalHits,
        sourceBreakdown: cachedResult.sourceBreakdown as Record<DataSourceName, number>,
        dedupedCount: 0,
        metadata: {
          successfulSources: Object.keys(cachedResult.sourceBreakdown) as DataSourceName[],
          failedSources: [],
          searchTime: Date.now(),
          fromCache: true,
        },
      } as AggregatedSearchResult;
    }
    
    // Use smart source selection if enabled
    let enabledSources = this.config.enabledSources || [];
    
    if (this.config.enableSmartSourceSelection && options.query) {
      const smartSources = selectSourcesForQuery(options.query, 3);
      enabledSources = smartSources;
      console.log(`[DataSourceAggregator] Smart source selection: ${classifyQueryDomain(options.query)} → [${smartSources.join(', ')}]`);
    }
    
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

    const result = {
      papers: filteredPapers,
      totalHits,
      sourceBreakdown,
      dedupedCount: removedCount,
      // Extended metadata
      metadata: {
        successfulSources: successfulResults.map(r => r.source),
        failedSources: failedResults.map(r => ({ source: r.source, error: r.error })),
        searchTime: Date.now(),
        fromCache: false,
      },
    } as AggregatedSearchResult;
    
    // Cache the search results
    queryCache.set(
      options.query,
      { papers: filteredPapers, totalHits, sourceBreakdown },
      { yearFrom: options.yearFrom, yearTo: options.yearTo, openAccess: options.openAccess },
      options.sessionId
    );
    
    return result;
  }

  /**
   * Try alternative sources as fallback
   * OpenAlex is prioritized as primary fallback due to best coverage and DOI support
   */
  private async tryFallbackSearch(options: SearchOptions): Promise<{
    status: 'success';
    source: DataSourceName;
    papers: Paper[];
    totalHits: number;
  } | null> {
    // Try sources that weren't in the primary list
    // OpenAlex first as it has the best coverage (200M+ works)
    const primarySources = new Set(this.config.enabledSources || []);
    const fallbackOrder: DataSourceName[] = ['openalex', 'semantic-scholar', 'core', 'arxiv', 'pubmed'];
    
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
   * Deduplicate papers by DOI and/or fuzzy title similarity
   * Uses Levenshtein distance for improved matching of similar titles
   */
  private deduplicatePapers(papers: Paper[]): { papers: Paper[]; removedCount: number } {
    const seenByDoi = new Map<string, Paper>();
    const seenByTitle: Paper[] = [];
    let removedCount = 0;

    for (const paper of papers) {
      let isDuplicate = false;
      
      // Check DOI deduplication (exact match)
      if (this.config.deduplicateByDoi && paper.doi) {
        const normalizedDoi = paper.doi.toLowerCase().trim();
        if (seenByDoi.has(normalizedDoi)) {
          // Merge data using field-level merge
          const existing = seenByDoi.get(normalizedDoi)!;
          seenByDoi.set(normalizedDoi, this.mergePapersFieldLevel(existing, paper));
          removedCount++;
          isDuplicate = true;
          continue;
        }
        seenByDoi.set(normalizedDoi, paper);
      }

      // Check fuzzy title similarity deduplication
      if (this.config.deduplicateByTitle && !isDuplicate) {
        // Find similar title using fuzzy matching
        let matchedIndex = -1;
        
        for (let i = 0; i < seenByTitle.length; i++) {
          if (areTitlesSimilar(paper.title, seenByTitle[i].title, 0.85)) {
            matchedIndex = i;
            break;
          }
        }
        
        if (matchedIndex >= 0) {
          // Merge with existing paper
          seenByTitle[matchedIndex] = this.mergePapersFieldLevel(seenByTitle[matchedIndex], paper);
          removedCount++;
          isDuplicate = true;
        } else {
          seenByTitle.push(paper);
        }
      }

      // If neither dedup method caught it and no title dedup, add to results
      if (!isDuplicate && !this.config.deduplicateByDoi && !this.config.deduplicateByTitle) {
        seenByTitle.push(paper);
      }
    }

    // Combine results from DOI and title deduplication
    const uniquePapers = new Map<string, Paper>();
    
    // Add DOI-deduplicated papers
    for (const paper of seenByDoi.values()) {
      const key = paper.doi?.toLowerCase() || paper.id;
      uniquePapers.set(key, paper);
    }
    
    // Add title-deduplicated papers (checking for DOI conflicts)
    for (const paper of seenByTitle) {
      const key = paper.doi?.toLowerCase() || `title:${this.normalizeTitle(paper.title)}`;
      if (!uniquePapers.has(key)) {
        // Also check fuzzy title match against DOI papers
        let foundMatch = false;
        for (const existing of uniquePapers.values()) {
          if (areTitlesSimilar(paper.title, existing.title, 0.85)) {
            // Merge into existing
            const mergedKey = existing.doi?.toLowerCase() || existing.id;
            uniquePapers.set(mergedKey, this.mergePapersFieldLevel(existing, paper));
            removedCount++;
            foundMatch = true;
            break;
          }
        }
        if (!foundMatch) {
          uniquePapers.set(key, paper);
        }
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
   * Field-level merge of two papers
   * Intelligently selects the best value for each field rather than whole-paper selection
   */
  private mergePapersFieldLevel(existing: Paper, incoming: Paper): Paper {
    // Merge source origins (deduplicated)
    const mergedSources = [...new Set([
      ...(existing.sourceOrigin || []),
      ...(incoming.sourceOrigin || []),
    ])] as PaperSourceName[];
    
    // Use highest data availability
    const existingLevel = existing.dataAvailability || DataAvailability.METADATA_ONLY;
    const incomingLevel = incoming.dataAvailability || DataAvailability.METADATA_ONLY;
    const mergedAvailability = Math.max(existingLevel, incomingLevel) as DataAvailability;
    
    // Helper: select best string value (prefer longer, non-empty)
    const selectBestString = (a?: string, b?: string): string | undefined => {
      if (!a && !b) return undefined;
      if (!a) return b;
      if (!b) return a;
      return a.length >= b.length ? a : b;
    };
    
    // Helper: merge arrays with deduplication
    const mergeArrays = <T>(a: T[] = [], b: T[] = []): T[] => {
      return [...new Set([...a, ...b])];
    };
    
    return {
      // Keep original ID for consistency
      id: existing.id,
      
      // Select longer/better title
      title: selectBestString(existing.title, incoming.title) || existing.title,
      
      // Merge author lists (by name to avoid duplicates)
      authors: (() => {
        const authorMap = new Map<string, { name: string; affiliations?: string[] }>();
        for (const author of [...existing.authors, ...incoming.authors]) {
          const key = author.name.toLowerCase();
          const existing = authorMap.get(key);
          if (!existing || (author.affiliations?.length || 0) > (existing.affiliations?.length || 0)) {
            authorMap.set(key, author);
          }
        }
        return Array.from(authorMap.values());
      })(),
      
      // Select longer abstract (provide empty string as fallback)
      abstract: selectBestString(existing.abstract, incoming.abstract) || '',
      
      // Prefer non-zero year, or newer if both valid
      year: existing.year || incoming.year || new Date().getFullYear(),
      publishedDate: existing.publishedDate || incoming.publishedDate,
      
      // Prefer existing DOI if valid
      doi: existing.doi || incoming.doi,
      
      // Select best URLs
      downloadUrl: existing.downloadUrl || incoming.downloadUrl,
      sourceUrl: existing.sourceUrl || incoming.sourceUrl,
      pdfUrl: existing.pdfUrl || incoming.pdfUrl,
      
      // Prefer existing metadata
      journal: selectBestString(existing.journal, incoming.journal),
      publisher: selectBestString(existing.publisher, incoming.publisher),
      
      // Merge subjects
      subjects: mergeArrays(existing.subjects, incoming.subjects),
      
      // Use maximum citations
      citations: Math.max(existing.citations || 0, incoming.citations || 0),
      
      // Prefer existing references if available
      references: existing.references || incoming.references,
      
      // True if either is open access
      openAccess: existing.openAccess || incoming.openAccess,
      
      // Prefer existing language
      language: existing.language || incoming.language,
      
      // Select longer full text
      fullText: selectBestString(existing.fullText, incoming.fullText),
      
      // Extended metadata - prefer non-empty values
      volume: existing.volume || incoming.volume,
      issue: existing.issue || incoming.issue,
      pages: existing.pages || incoming.pages,
      isbn: existing.isbn || incoming.isbn,
      issn: existing.issn || incoming.issn,
      conference: selectBestString(existing.conference, incoming.conference),
      edition: existing.edition || incoming.edition,
      location: existing.location || incoming.location,
      
      // Merged fields
      dataAvailability: mergedAvailability,
      sourceOrigin: mergedSources,
      lastEnriched: existing.lastEnriched || incoming.lastEnriched,
      fullTextSections: existing.fullTextSections || incoming.fullTextSections,
    };
  }

  /**
   * Merge two papers, preferring more complete data (legacy method)
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
