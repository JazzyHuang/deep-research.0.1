import type { CoreApiResponse, CorePaper, Paper } from '@/types/paper';
import { corePaperToPaper } from '@/types/paper';

const CORE_API_BASE = 'https://api.core.ac.uk/v3';

interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  yearFrom?: number;
  yearTo?: number;
  openAccess?: boolean;
  scroll?: boolean;
  scrollId?: string;
}

interface SearchResult {
  papers: Paper[];
  totalHits: number;
  scrollId?: string;
}

class CoreApiClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CORE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('CORE_API_KEY not set. API calls will fail.');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${CORE_API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CORE API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Search for academic papers using the CORE API
   */
  async search(options: SearchOptions): Promise<SearchResult> {
    const {
      query,
      limit = 10,
      offset = 0,
      yearFrom,
      yearTo,
      openAccess,
      scroll = false,
      scrollId,
    } = options;

    // Build the search query with filters
    let searchQuery = query;
    
    // Add year filter
    if (yearFrom || yearTo) {
      const from = yearFrom || 1900;
      const to = yearTo || new Date().getFullYear();
      searchQuery += ` AND yearPublished>=${from} AND yearPublished<=${to}`;
    }

    // Build request body
    const body: Record<string, unknown> = {
      q: searchQuery,
      limit,
      offset,
    };

    if (scroll) {
      body.scroll = true;
    }

    if (scrollId) {
      body.scrollId = scrollId;
    }

    // Add filter for open access if requested
    if (openAccess) {
      body.q = `${searchQuery} AND _exists_:downloadUrl`;
    }

    const response = await this.request<CoreApiResponse>('/search/works', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return {
      papers: response.results.map(corePaperToPaper),
      totalHits: response.totalHits,
      scrollId: response.scrollId,
    };
  }

  /**
   * Get a single paper by its CORE ID
   */
  async getPaper(id: string): Promise<Paper | null> {
    try {
      const response = await this.request<CorePaper>(`/works/${id}`);
      return corePaperToPaper(response);
    } catch {
      return null;
    }
  }

  /**
   * Get multiple papers by their CORE IDs
   */
  async getPapers(ids: string[]): Promise<Paper[]> {
    try {
      const response = await this.request<CorePaper[]>('/works', {
        method: 'POST',
        body: JSON.stringify({ ids: ids.map(id => parseInt(id, 10)) }),
      });
      return response.map(corePaperToPaper);
    } catch {
      return [];
    }
  }

  /**
   * Search with semantic similarity (if available)
   * Falls back to regular search if not supported
   */
  async semanticSearch(query: string, limit: number = 10): Promise<SearchResult> {
    // CORE API v3 supports semantic search through the regular search endpoint
    // with natural language queries
    return this.search({
      query,
      limit,
      openAccess: true, // Prefer open access for full-text analysis
    });
  }

  /**
   * Get related papers based on a paper ID
   */
  async getRelatedPapers(paperId: string, limit: number = 5): Promise<Paper[]> {
    try {
      const paper = await this.getPaper(paperId);
      if (!paper) return [];

      // Search using the paper's title and abstract
      const searchQuery = `${paper.title} ${paper.abstract?.slice(0, 200) || ''}`;
      const result = await this.search({
        query: searchQuery,
        limit: limit + 1, // +1 because original paper might be in results
      });

      // Filter out the original paper
      return result.papers.filter(p => p.id !== paperId).slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Advanced search with multiple field-specific queries
   */
  async advancedSearch(params: {
    title?: string;
    abstract?: string;
    authors?: string;
    subjects?: string[];
    yearFrom?: number;
    yearTo?: number;
    limit?: number;
  }): Promise<SearchResult> {
    const queryParts: string[] = [];

    if (params.title) {
      queryParts.push(`title:(${params.title})`);
    }
    if (params.abstract) {
      queryParts.push(`abstract:(${params.abstract})`);
    }
    if (params.authors) {
      queryParts.push(`authors.name:(${params.authors})`);
    }
    if (params.subjects && params.subjects.length > 0) {
      queryParts.push(`subjects:(${params.subjects.join(' OR ')})`);
    }

    const query = queryParts.join(' AND ') || '*';

    return this.search({
      query,
      limit: params.limit || 10,
      yearFrom: params.yearFrom,
      yearTo: params.yearTo,
    });
  }
}

// Export singleton instance
export const coreApi = new CoreApiClient();

// Export class for custom instances
export { CoreApiClient };
export type { SearchOptions, SearchResult };









