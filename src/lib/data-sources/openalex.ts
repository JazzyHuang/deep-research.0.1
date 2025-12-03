import type { Paper } from '@/types/paper';
import type {
  DataSource,
  SearchOptions,
  SearchResult,
  OpenAlexResponse,
  OpenAlexWork,
} from './types';
import { openAlexToPaper } from './types';

const OPENALEX_API_BASE = 'https://api.openalex.org';

export class OpenAlexClient implements DataSource {
  name = 'openalex' as const;
  private email?: string;
  private rateLimit: number;
  private lastRequest: number = 0;

  constructor(email?: string, rateLimit: number = 10) {
    this.email = email || process.env.OPENALEX_EMAIL;
    this.rateLimit = rateLimit;
  }

  private async throttle(): Promise<void> {
    const minInterval = 1000 / this.rateLimit;
    const elapsed = Date.now() - this.lastRequest;
    if (elapsed < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - elapsed));
    }
    this.lastRequest = Date.now();
  }

  private async request<T>(endpoint: string): Promise<T> {
    await this.throttle();

    // Add polite pool email if available (gets better rate limits)
    const url = new URL(`${OPENALEX_API_BASE}${endpoint}`);
    if (this.email) {
      url.searchParams.set('mailto', this.email);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DeepResearch/1.0 (mailto:' + (this.email || 'anonymous@example.com') + ')',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAlex API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.request('/works?filter=title.search:test&per_page=1');
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

    // Build filter string
    const filters: string[] = [];
    
    // Use default_search for full-text search
    const searchQuery = encodeURIComponent(query);

    // Add year filter
    if (yearFrom || yearTo) {
      if (yearFrom && yearTo) {
        filters.push(`publication_year:${yearFrom}-${yearTo}`);
      } else if (yearFrom) {
        filters.push(`publication_year:>${yearFrom - 1}`);
      } else if (yearTo) {
        filters.push(`publication_year:<${yearTo + 1}`);
      }
    }

    // Add open access filter
    if (openAccess) {
      filters.push('is_oa:true');
    }

    // Build query parameters
    const params = new URLSearchParams({
      search: query,
      per_page: String(Math.min(limit, 200)), // OpenAlex max is 200
      page: String(Math.floor(offset / limit) + 1),
    });

    if (filters.length > 0) {
      params.set('filter', filters.join(','));
    }

    // Add sorting
    if (sortBy === 'citations') {
      params.set('sort', 'cited_by_count:desc');
    } else if (sortBy === 'date') {
      params.set('sort', 'publication_date:desc');
    } else {
      params.set('sort', 'relevance_score:desc');
    }

    try {
      const response = await this.request<OpenAlexResponse>(`/works?${params.toString()}`);

      const papers = response.results.map(openAlexToPaper);

      return {
        papers,
        totalHits: response.meta.count,
        source: this.name,
      };
    } catch (error) {
      console.error('OpenAlex search error:', error);
      return {
        papers: [],
        totalHits: 0,
        source: this.name,
      };
    }
  }

  async getPaper(id: string): Promise<Paper | null> {
    // Handle different ID formats
    let workId = id;
    if (id.startsWith('oa-')) {
      workId = id.replace('oa-', '');
    }

    try {
      // Try to find by OpenAlex ID first
      let work: OpenAlexWork;
      
      if (workId.startsWith('W')) {
        work = await this.request<OpenAlexWork>(`/works/${workId}`);
      } else if (workId.includes('/')) {
        // Might be a DOI
        work = await this.request<OpenAlexWork>(`/works/doi:${workId}`);
      } else {
        work = await this.request<OpenAlexWork>(`/works/W${workId}`);
      }
      
      return openAlexToPaper(work);
    } catch {
      return null;
    }
  }

  /**
   * Get paper by DOI
   */
  async getPaperByDoi(doi: string): Promise<Paper | null> {
    try {
      const work = await this.request<OpenAlexWork>(`/works/doi:${doi}`);
      return openAlexToPaper(work);
    } catch {
      return null;
    }
  }

  /**
   * Get related works based on concept overlap
   */
  async getRelatedWorks(workId: string, limit: number = 10): Promise<Paper[]> {
    try {
      // First get the work to find its concepts
      const work = await this.request<OpenAlexWork>(`/works/${workId}`);
      
      if (!work.concepts || work.concepts.length === 0) {
        return [];
      }

      // Get the top concept
      const topConcepts = work.concepts
        .filter(c => c.level === 0 || c.level === 1)
        .slice(0, 3)
        .map(c => c.display_name);

      if (topConcepts.length === 0) return [];

      // Search for related works
      const conceptFilter = topConcepts.map(c => `concepts.display_name:${c}`).join('|');
      const response = await this.request<OpenAlexResponse>(
        `/works?filter=${conceptFilter}&per_page=${limit}&sort=cited_by_count:desc`
      );

      return response.results
        .filter(w => w.id !== work.id) // Exclude the original
        .map(openAlexToPaper);
    } catch {
      return [];
    }
  }

  /**
   * Get works citing a given work
   */
  async getCitingWorks(workId: string, limit: number = 10): Promise<Paper[]> {
    try {
      const response = await this.request<OpenAlexResponse>(
        `/works?filter=cites:${workId}&per_page=${limit}&sort=cited_by_count:desc`
      );
      return response.results.map(openAlexToPaper);
    } catch {
      return [];
    }
  }

  /**
   * Search by specific author
   */
  async searchByAuthor(authorName: string, limit: number = 10): Promise<Paper[]> {
    try {
      const response = await this.request<OpenAlexResponse>(
        `/works?filter=author.display_name.search:${encodeURIComponent(authorName)}&per_page=${limit}`
      );
      return response.results.map(openAlexToPaper);
    } catch {
      return [];
    }
  }
}

// Export singleton instance
export const openAlex = new OpenAlexClient();









