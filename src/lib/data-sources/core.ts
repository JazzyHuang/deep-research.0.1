import type { Paper, CoreApiResponse, CorePaper } from '@/types/paper';
import { corePaperToPaper } from '@/types/paper';
import type { DataSource, SearchOptions, SearchResult } from './types';

const CORE_API_BASE = 'https://api.core.ac.uk/v3';

export class CoreClient implements DataSource {
  name = 'core' as const;
  private apiKey: string;
  private rateLimit: number;
  private lastRequest: number = 0;

  constructor(apiKey?: string, rateLimit: number = 10) {
    this.apiKey = apiKey || process.env.CORE_API_KEY || '';
    this.rateLimit = rateLimit;
    
    if (!this.apiKey) {
      console.warn('CORE_API_KEY not set. CORE API calls will fail.');
    }
  }

  private async throttle(): Promise<void> {
    const minInterval = 1000 / this.rateLimit;
    const elapsed = Date.now() - this.lastRequest;
    if (elapsed < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - elapsed));
    }
    this.lastRequest = Date.now();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await this.throttle();
    
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

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    try {
      await this.request('/search/works', {
        method: 'POST',
        body: JSON.stringify({ q: 'test', limit: 1 }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async search(options: SearchOptions): Promise<SearchResult> {
    const {
      query,
      limit = 10,
      offset = 0,
      yearFrom,
      yearTo,
      openAccess,
      sortBy = 'relevance',
    } = options;

    // Build the search query with filters
    let searchQuery = query;
    
    // Add year filter
    if (yearFrom || yearTo) {
      const from = yearFrom || 1900;
      const to = yearTo || new Date().getFullYear();
      searchQuery += ` AND yearPublished>=${from} AND yearPublished<=${to}`;
    }

    // Add filter for open access if requested
    if (openAccess) {
      searchQuery += ' AND _exists_:downloadUrl';
    }

    // Build request body
    const body: Record<string, unknown> = {
      q: searchQuery,
      limit: Math.min(limit, 100),
      offset,
    };

    try {
      const response = await this.request<CoreApiResponse>('/search/works', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      let papers = response.results.map(corePaperToPaper);

      // Sort by citations if requested
      if (sortBy === 'citations') {
        papers = papers.sort((a, b) => (b.citations || 0) - (a.citations || 0));
      } else if (sortBy === 'date') {
        papers = papers.sort((a, b) => b.year - a.year);
      }

      return {
        papers,
        totalHits: response.totalHits,
        source: this.name,
        nextCursor: response.scrollId,
      };
    } catch (error) {
      console.error('CORE search error:', error);
      return {
        papers: [],
        totalHits: 0,
        source: this.name,
      };
    }
  }

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
   * Search with semantic similarity
   */
  async semanticSearch(query: string, limit: number = 10): Promise<SearchResult> {
    return this.search({
      query,
      limit,
      openAccess: true,
    });
  }

  /**
   * Get related papers based on a paper ID
   */
  async getRelatedPapers(paperId: string, limit: number = 5): Promise<Paper[]> {
    try {
      const paper = await this.getPaper(paperId);
      if (!paper) return [];

      const searchQuery = `${paper.title} ${paper.abstract?.slice(0, 200) || ''}`;
      const result = await this.search({
        query: searchQuery,
        limit: limit + 1,
      });

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
export const core = new CoreClient();









