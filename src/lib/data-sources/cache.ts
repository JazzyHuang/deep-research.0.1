/**
 * Paper Content Cache - In-memory caching layer for paper data
 * Reduces redundant API calls and improves performance
 */

import type { Paper, DataSourceName } from '@/types/paper';
import { DataAvailability } from '@/types/paper';

/**
 * Cache entry with metadata
 */
interface CacheEntry {
  paper: Paper;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryEstimate: number; // bytes
  entriesBySource: Record<DataSourceName, number>;
  entriesByAvailability: Record<DataAvailability, number>;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxEntries: number;
  ttlMs: number;                    // Time to live in milliseconds
  cleanupIntervalMs: number;        // Cleanup interval
  preferHigherAvailability: boolean; // Keep papers with more data longer
}

const DEFAULT_CONFIG: CacheConfig = {
  maxEntries: 1000,
  ttlMs: 30 * 60 * 1000,            // 30 minutes default TTL
  cleanupIntervalMs: 5 * 60 * 1000, // Cleanup every 5 minutes
  preferHigherAvailability: true,
};

/**
 * Paper content cache with LRU eviction and TTL
 */
export class PaperCache {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private hits: number = 0;
  private misses: number = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.cache = new Map();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Get a paper from cache by ID
   */
  get(id: string): Paper | null {
    const entry = this.cache.get(id);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(id);
      this.misses++;
      return null;
    }
    
    // Update access metadata
    entry.accessCount++;
    entry.lastAccess = Date.now();
    
    this.hits++;
    return entry.paper;
  }

  /**
   * Get multiple papers by IDs
   */
  getMany(ids: string[]): { found: Paper[]; missing: string[] } {
    const found: Paper[] = [];
    const missing: string[] = [];
    
    for (const id of ids) {
      const paper = this.get(id);
      if (paper) {
        found.push(paper);
      } else {
        missing.push(id);
      }
    }
    
    return { found, missing };
  }

  /**
   * Set a paper in cache
   * If paper already exists, update if new version has higher availability
   */
  set(paper: Paper): void {
    const existing = this.cache.get(paper.id);
    
    // If existing entry has higher availability, keep it
    if (existing && this.config.preferHigherAvailability) {
      const existingLevel = existing.paper.dataAvailability || DataAvailability.METADATA_ONLY;
      const newLevel = paper.dataAvailability || DataAvailability.METADATA_ONLY;
      
      if (existingLevel >= newLevel) {
        // Just update access time
        existing.lastAccess = Date.now();
        existing.accessCount++;
        return;
      }
    }
    
    // Check if we need to evict
    if (this.cache.size >= this.config.maxEntries && !existing) {
      this.evictOne();
    }
    
    this.cache.set(paper.id, {
      paper,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccess: Date.now(),
    });
  }

  /**
   * Set multiple papers
   */
  setMany(papers: Paper[]): void {
    for (const paper of papers) {
      this.set(paper);
    }
  }

  /**
   * Update a paper in cache (merge with existing)
   */
  update(paper: Paper): void {
    const existing = this.cache.get(paper.id);
    
    if (existing) {
      // Merge papers, keeping the most complete data
      const merged = this.mergePapers(existing.paper, paper);
      existing.paper = merged;
      existing.lastAccess = Date.now();
      existing.accessCount++;
    } else {
      this.set(paper);
    }
  }

  /**
   * Check if paper exists in cache
   */
  has(id: string): boolean {
    const entry = this.cache.get(id);
    if (!entry) return false;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(id);
      return false;
    }
    
    return true;
  }

  /**
   * Delete a paper from cache
   */
  delete(id: string): boolean {
    return this.cache.delete(id);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entriesBySource: Record<DataSourceName, number> = {
      'core': 0,
      'semantic-scholar': 0,
      'openalex': 0,
      'arxiv': 0,
      'pubmed': 0,
    };
    
    const entriesByAvailability: Record<DataAvailability, number> = {
      [DataAvailability.METADATA_ONLY]: 0,
      [DataAvailability.WITH_ABSTRACT]: 0,
      [DataAvailability.WITH_PDF_LINK]: 0,
      [DataAvailability.WITH_FULL_TEXT]: 0,
    };
    
    let memoryEstimate = 0;
    
    for (const entry of this.cache.values()) {
      const paper = entry.paper;
      
      // Count by source
      if (paper.sourceOrigin) {
        for (const source of paper.sourceOrigin) {
          if (source in entriesBySource) {
            entriesBySource[source]++;
          }
        }
      }
      
      // Count by availability
      const level = paper.dataAvailability || DataAvailability.METADATA_ONLY;
      entriesByAvailability[level]++;
      
      // Estimate memory (rough)
      memoryEstimate += JSON.stringify(paper).length * 2; // UTF-16 chars
    }
    
    const totalRequests = this.hits + this.misses;
    
    return {
      totalEntries: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      memoryEstimate,
      entriesBySource,
      entriesByAvailability,
    };
  }

  /**
   * Get all papers matching a filter
   */
  filter(predicate: (paper: Paper) => boolean): Paper[] {
    const results: Paper[] = [];
    
    for (const entry of this.cache.values()) {
      if (predicate(entry.paper)) {
        results.push(entry.paper);
      }
    }
    
    return results;
  }

  /**
   * Get papers by data availability level
   */
  getByAvailability(minLevel: DataAvailability): Paper[] {
    return this.filter(p => 
      (p.dataAvailability || DataAvailability.METADATA_ONLY) >= minLevel
    );
  }

  /**
   * Get papers from a specific source
   */
  getBySource(source: DataSourceName): Paper[] {
    return this.filter(p => p.sourceOrigin?.includes(source) ?? false);
  }

  /**
   * Evict one entry using LRU with availability weighting
   */
  private evictOne(): void {
    let oldest: { id: string; score: number } | null = null;
    
    for (const [id, entry] of this.cache.entries()) {
      // Calculate eviction score (lower = more likely to evict)
      // - Higher availability = less likely to evict
      // - More recent access = less likely to evict
      // - More accesses = less likely to evict
      
      const availabilityWeight = this.config.preferHigherAvailability
        ? (entry.paper.dataAvailability || 1) * 100000
        : 0;
      
      const recencyWeight = entry.lastAccess;
      const accessWeight = entry.accessCount * 10000;
      
      const score = availabilityWeight + recencyWeight + accessWeight;
      
      if (!oldest || score < oldest.score) {
        oldest = { id, score };
      }
    }
    
    if (oldest) {
      this.cache.delete(oldest.id);
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    if (this.cleanupTimer) return;
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredIds: string[] = [];
    
    for (const [id, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttlMs) {
        expiredIds.push(id);
      }
    }
    
    for (const id of expiredIds) {
      this.cache.delete(id);
    }
    
    if (expiredIds.length > 0) {
      console.log(`[PaperCache] Cleaned up ${expiredIds.length} expired entries`);
    }
  }

  /**
   * Merge two papers, keeping the most complete data
   */
  private mergePapers(existing: Paper, incoming: Paper): Paper {
    const existingLevel = existing.dataAvailability || DataAvailability.METADATA_ONLY;
    const incomingLevel = incoming.dataAvailability || DataAvailability.METADATA_ONLY;
    
    // Use higher availability paper as base
    const [base, other] = incomingLevel > existingLevel 
      ? [incoming, existing] 
      : [existing, incoming];
    
    return {
      ...base,
      // Merge arrays
      sourceOrigin: [...new Set([
        ...(existing.sourceOrigin || []),
        ...(incoming.sourceOrigin || []),
      ])] as DataSourceName[],
      subjects: [...new Set([
        ...(existing.subjects || []),
        ...(incoming.subjects || []),
      ])],
      // Keep non-null values
      abstract: base.abstract || other.abstract,
      fullText: base.fullText || other.fullText,
      pdfUrl: base.pdfUrl || other.pdfUrl,
      downloadUrl: base.downloadUrl || other.downloadUrl,
      fullTextSections: base.fullTextSections || other.fullTextSections,
      // Use maximum
      citations: Math.max(base.citations || 0, other.citations || 0),
      dataAvailability: Math.max(existingLevel, incomingLevel) as DataAvailability,
    };
  }
}

// Export singleton instance
export const paperCache = new PaperCache();

/**
 * Decorator for caching paper retrieval results
 */
export function withCache<T extends (...args: string[]) => Promise<Paper | null>>(
  fn: T,
  options?: { keyExtractor?: (...args: string[]) => string }
): T {
  const keyExtractor = options?.keyExtractor || ((id: string) => id);
  
  return (async (...args: string[]): Promise<Paper | null> => {
    const key = keyExtractor(...args);
    
    // Check cache first
    const cached = paperCache.get(key);
    if (cached) {
      return cached;
    }
    
    // Call original function
    const result = await fn(...args);
    
    // Cache result if found
    if (result) {
      paperCache.set(result);
    }
    
    return result;
  }) as T;
}

/**
 * Decorator for caching batch paper retrieval
 */
export function withBatchCache<T extends (ids: string[]) => Promise<Paper[]>>(
  fn: T
): T {
  return (async (ids: string[]): Promise<Paper[]> => {
    const { found, missing } = paperCache.getMany(ids);
    
    if (missing.length === 0) {
      return found;
    }
    
    // Fetch missing papers
    const fetched = await fn(missing);
    
    // Cache fetched papers
    paperCache.setMany(fetched);
    
    // Combine and return
    return [...found, ...fetched];
  }) as T;
}

/**
 * Reset cache statistics (for testing)
 */
export function resetCacheStats(): void {
  // Create new instance to reset stats
  paperCache.clear();
}

// ============================================
// Query-Level Caching for Search Results
// ============================================

/**
 * Cached query result with papers
 */
interface QueryCacheEntry {
  papers: Paper[];
  totalHits: number;
  sourceBreakdown: Record<string, number>;
  timestamp: number;
  accessCount: number;
}

/**
 * Query cache configuration
 */
export interface QueryCacheConfig {
  maxEntries: number;
  ttlMs: number;              // Short TTL (5-10 minutes recommended)
  sessionScopedTtlMs: number; // Longer TTL for session-scoped queries
}

const DEFAULT_QUERY_CACHE_CONFIG: QueryCacheConfig = {
  maxEntries: 200,
  ttlMs: 5 * 60 * 1000,             // 5 minutes for general queries
  sessionScopedTtlMs: 30 * 60 * 1000, // 30 minutes for session-scoped queries
};

/**
 * QueryCache - Caches search results by normalized query string
 * Reduces redundant API calls for identical or similar queries
 */
export class QueryCache {
  private cache: Map<string, QueryCacheEntry>;
  private sessionCache: Map<string, Map<string, QueryCacheEntry>>;
  private config: QueryCacheConfig;
  private hits: number = 0;
  private misses: number = 0;

  constructor(config: Partial<QueryCacheConfig> = {}) {
    this.cache = new Map();
    this.sessionCache = new Map();
    this.config = { ...DEFAULT_QUERY_CACHE_CONFIG, ...config };
  }

  /**
   * Normalize query string for cache key generation
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/[^\w\s]/g, '')        // Remove special characters
      .split(' ')
      .sort()                          // Sort words for order-independent matching
      .join(' ');
  }

  /**
   * Generate cache key from query and options
   */
  private getCacheKey(
    query: string,
    options?: { yearFrom?: number; yearTo?: number; openAccess?: boolean }
  ): string {
    const normalized = this.normalizeQuery(query);
    const optionStr = options
      ? `_${options.yearFrom || ''}_${options.yearTo || ''}_${options.openAccess ? 'oa' : ''}`
      : '';
    return `${normalized}${optionStr}`;
  }

  /**
   * Get cached search results
   */
  get(
    query: string,
    options?: { yearFrom?: number; yearTo?: number; openAccess?: boolean },
    sessionId?: string
  ): { papers: Paper[]; totalHits: number; sourceBreakdown: Record<string, number> } | null {
    const key = this.getCacheKey(query, options);
    
    // Check session-scoped cache first
    if (sessionId) {
      const sessionMap = this.sessionCache.get(sessionId);
      if (sessionMap) {
        const entry = sessionMap.get(key);
        if (entry && Date.now() - entry.timestamp < this.config.sessionScopedTtlMs) {
          entry.accessCount++;
          this.hits++;
          return {
            papers: entry.papers,
            totalHits: entry.totalHits,
            sourceBreakdown: entry.sourceBreakdown,
          };
        }
      }
    }
    
    // Check global cache
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    entry.accessCount++;
    this.hits++;
    return {
      papers: entry.papers,
      totalHits: entry.totalHits,
      sourceBreakdown: entry.sourceBreakdown,
    };
  }

  /**
   * Cache search results
   */
  set(
    query: string,
    result: { papers: Paper[]; totalHits: number; sourceBreakdown: Record<string, number> },
    options?: { yearFrom?: number; yearTo?: number; openAccess?: boolean },
    sessionId?: string
  ): void {
    const key = this.getCacheKey(query, options);
    
    const entry: QueryCacheEntry = {
      papers: result.papers,
      totalHits: result.totalHits,
      sourceBreakdown: result.sourceBreakdown,
      timestamp: Date.now(),
      accessCount: 1,
    };
    
    // Store in session cache if sessionId provided
    if (sessionId) {
      let sessionMap = this.sessionCache.get(sessionId);
      if (!sessionMap) {
        sessionMap = new Map();
        this.sessionCache.set(sessionId, sessionMap);
      }
      sessionMap.set(key, entry);
    }
    
    // Also store in global cache
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }
    this.cache.set(key, entry);
    
    // Also cache individual papers
    for (const paper of result.papers) {
      paperCache.set(paper);
    }
  }

  /**
   * Check if query is cached
   */
  has(
    query: string,
    options?: { yearFrom?: number; yearTo?: number; openAccess?: boolean }
  ): boolean {
    const key = this.getCacheKey(query, options);
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Clear session cache
   */
  clearSession(sessionId: string): void {
    this.sessionCache.delete(sessionId);
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.cache.clear();
    this.sessionCache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    sessionCaches: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const totalRequests = this.hits + this.misses;
    return {
      totalEntries: this.cache.size,
      sessionCaches: this.sessionCache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
    };
  }

  /**
   * Evict oldest entry
   */
  private evictOldest(): void {
    let oldest: { key: string; timestamp: number } | null = null;
    
    for (const [key, entry] of this.cache.entries()) {
      if (!oldest || entry.timestamp < oldest.timestamp) {
        oldest = { key, timestamp: entry.timestamp };
      }
    }
    
    if (oldest) {
      this.cache.delete(oldest.key);
    }
  }
}

// Export singleton instance
export const queryCache = new QueryCache();

