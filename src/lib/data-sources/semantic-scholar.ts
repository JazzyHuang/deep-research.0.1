import type { Paper } from '@/types/paper';
import type {
  DataSource,
  SearchOptions,
  SearchResult,
  SemanticScholarResponse,
  SemanticScholarPaper,
} from './types';
import { semanticScholarToPaper } from './types';

const S2_API_BASE = 'https://api.semanticscholar.org/graph/v1';

const DEFAULT_FIELDS = [
  'paperId',
  'title',
  'abstract',
  'year',
  'citationCount',
  'referenceCount',
  'authors',
  'authors.affiliations',
  'externalIds',
  'url',
  'venue',
  'publicationVenue',
  'openAccessPdf',
  'fieldsOfStudy',
  'publicationDate',
  'isOpenAccess',
  // Extended fields for citation formatting
  'journal',
  'publicationTypes',
].join(',');

export class SemanticScholarClient implements DataSource {
  name = 'semantic-scholar' as const;
  private apiKey?: string;
  private rateLimit: number;
  private lastRequest: number = 0;

  constructor(apiKey?: string, rateLimit: number = 10) {
    this.apiKey = apiKey || process.env.SEMANTIC_SCHOLAR_API_KEY;
    this.rateLimit = rateLimit; // requests per second
  }

  private async throttle(): Promise<void> {
    const minInterval = 1000 / this.rateLimit;
    const elapsed = Date.now() - this.lastRequest;
    if (elapsed < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - elapsed));
    }
    this.lastRequest = Date.now();
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    await this.throttle();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    const response = await fetch(`${S2_API_BASE}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Semantic Scholar API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.request('/paper/search?query=test&limit=1&fields=paperId');
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

    // Build query parameters
    const params = new URLSearchParams({
      query,
      limit: String(Math.min(limit, 100)), // S2 max is 100
      offset: String(offset),
      fields: DEFAULT_FIELDS,
    });

    // Add year filter
    if (yearFrom || yearTo) {
      const from = yearFrom || 1900;
      const to = yearTo || new Date().getFullYear();
      params.set('year', `${from}-${to}`);
    }

    // Add open access filter
    if (openAccess) {
      params.set('openAccessPdf', '');
    }

    try {
      const response = await this.request<SemanticScholarResponse>(
        `/paper/search?${params.toString()}`
      );

      let papers = response.data.map(semanticScholarToPaper);

      // Sort by citations if requested
      if (sortBy === 'citations') {
        papers = papers.sort((a, b) => (b.citations || 0) - (a.citations || 0));
      } else if (sortBy === 'date') {
        papers = papers.sort((a, b) => b.year - a.year);
      }

      return {
        papers,
        totalHits: response.total,
        source: this.name,
        nextCursor: response.next ? String(response.next) : undefined,
      };
    } catch (error) {
      console.error('Semantic Scholar search error:', error);
      return {
        papers: [],
        totalHits: 0,
        source: this.name,
      };
    }
  }

  async getPaper(id: string): Promise<Paper | null> {
    // Handle different ID formats
    let paperId = id;
    if (id.startsWith('s2-')) {
      paperId = id.replace('s2-', '');
    }

    try {
      const paper = await this.request<SemanticScholarPaper>(
        `/paper/${paperId}?fields=${DEFAULT_FIELDS}`
      );
      return semanticScholarToPaper(paper);
    } catch {
      return null;
    }
  }

  /**
   * Get papers citing a given paper
   */
  async getCitations(paperId: string, limit: number = 10): Promise<Paper[]> {
    try {
      const response = await this.request<{ data: { citingPaper: SemanticScholarPaper }[] }>(
        `/paper/${paperId}/citations?fields=${DEFAULT_FIELDS}&limit=${limit}`
      );
      return response.data.map(d => semanticScholarToPaper(d.citingPaper));
    } catch {
      return [];
    }
  }

  /**
   * Get papers referenced by a given paper
   */
  async getReferences(paperId: string, limit: number = 10): Promise<Paper[]> {
    try {
      const response = await this.request<{ data: { citedPaper: SemanticScholarPaper }[] }>(
        `/paper/${paperId}/references?fields=${DEFAULT_FIELDS}&limit=${limit}`
      );
      return response.data.map(d => semanticScholarToPaper(d.citedPaper));
    } catch {
      return [];
    }
  }

  /**
   * Get recommended papers based on a list of positive examples
   */
  async getRecommendations(positivePaperIds: string[], limit: number = 10): Promise<Paper[]> {
    if (positivePaperIds.length === 0) return [];

    try {
      const response = await this.request<{ recommendedPapers: SemanticScholarPaper[] }>(
        '/recommendations/v1/papers',
        {
          method: 'POST',
          body: JSON.stringify({
            positivePaperIds: positivePaperIds.map(id => id.replace('s2-', '')),
            negativePaperIds: [],
            fields: DEFAULT_FIELDS,
            limit,
          }),
        }
      );
      return response.recommendedPapers.map(semanticScholarToPaper);
    } catch {
      return [];
    }
  }
}

// Export singleton instance
export const semanticScholar = new SemanticScholarClient();

