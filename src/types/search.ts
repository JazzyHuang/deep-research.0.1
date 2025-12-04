/**
 * Search-related types for Deep Research
 */

import type { Paper } from './paper';

/**
 * Search query with optional filters
 */
export interface SearchQuery {
  query: string;
  filters?: {
    yearFrom?: number;
    yearTo?: number;
    openAccess?: boolean;
  };
}

/**
 * A single round of paper search
 */
export interface SearchRound {
  id: string;
  query: string;
  reasoning: string;
  papers: Paper[];
  timestamp: Date;
}

/**
 * Analysis of search results
 */
export interface SearchAnalysis {
  relevantPaperCount: number;
  averageRelevance: number;
  topicsFound: string[];
  gapAnalysis?: string;
  suggestions?: string[];
}

/**
 * Aggregated search result from multiple sources
 */
export interface AggregatedSearchResult {
  papers: Paper[];
  totalResults: number;
  dedupedCount: number;
  sourceBreakdown: Record<string, number>;
  errors?: Array<{ source: string; error: string }>;
}





