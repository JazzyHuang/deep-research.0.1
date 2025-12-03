import type { Paper } from '@/types/paper';
import type {
  DataSource,
  SearchOptions,
  SearchResult,
  ArxivEntry,
} from './types';
import { arxivToPaper } from './types';

const ARXIV_API_BASE = 'https://export.arxiv.org/api/query';

// arXiv category mappings for common research areas
const CATEGORY_MAPPINGS: Record<string, string[]> = {
  'computer science': ['cs.*'],
  'machine learning': ['cs.LG', 'cs.AI', 'stat.ML'],
  'artificial intelligence': ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV'],
  'natural language processing': ['cs.CL', 'cs.AI'],
  'computer vision': ['cs.CV', 'cs.AI'],
  'physics': ['physics.*', 'hep-*', 'cond-mat.*'],
  'mathematics': ['math.*'],
  'biology': ['q-bio.*'],
  'economics': ['econ.*'],
  'statistics': ['stat.*'],
};

export class ArxivClient implements DataSource {
  name = 'arxiv' as const;
  private rateLimit: number;
  private lastRequest: number = 0;

  constructor(rateLimit: number = 1) {
    // arXiv recommends max 1 request per 3 seconds
    this.rateLimit = rateLimit;
  }

  private async throttle(): Promise<void> {
    const minInterval = 3000 / this.rateLimit; // 3 seconds between requests
    const elapsed = Date.now() - this.lastRequest;
    if (elapsed < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - elapsed));
    }
    this.lastRequest = Date.now();
  }

  private parseAtomFeed(xmlText: string): { entries: ArxivEntry[]; totalResults: number } {
    // Simple XML parsing for arXiv Atom feed
    const entries: ArxivEntry[] = [];
    
    // Extract total results
    const totalMatch = xmlText.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
    const totalResults = totalMatch ? parseInt(totalMatch[1]) : 0;

    // Extract entries
    const entryMatches = xmlText.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
    
    for (const match of entryMatches) {
      const entryXml = match[1];
      
      // Extract fields
      const getId = (xml: string): string => {
        const m = xml.match(/<id>([^<]+)<\/id>/);
        return m ? m[1] : '';
      };
      
      const getTitle = (xml: string): string => {
        const m = xml.match(/<title>([^<]+)<\/title>/);
        return m ? m[1].replace(/\s+/g, ' ').trim() : '';
      };
      
      const getSummary = (xml: string): string => {
        const m = xml.match(/<summary>([^<]+)<\/summary>/);
        return m ? m[1].replace(/\s+/g, ' ').trim() : '';
      };
      
      const getPublished = (xml: string): string => {
        const m = xml.match(/<published>([^<]+)<\/published>/);
        return m ? m[1] : '';
      };
      
      const getUpdated = (xml: string): string => {
        const m = xml.match(/<updated>([^<]+)<\/updated>/);
        return m ? m[1] : '';
      };
      
      const getAuthors = (xml: string): { name: string }[] => {
        const authors: { name: string }[] = [];
        const authorMatches = xml.matchAll(/<author>\s*<name>([^<]+)<\/name>/g);
        for (const am of authorMatches) {
          authors.push({ name: am[1] });
        }
        return authors;
      };
      
      const getCategories = (xml: string): string[] => {
        const categories: string[] = [];
        const catMatches = xml.matchAll(/<category[^>]*term="([^"]+)"/g);
        for (const cm of catMatches) {
          categories.push(cm[1]);
        }
        return categories;
      };
      
      const getLinks = (xml: string): { href: string; type?: string; title?: string }[] => {
        const links: { href: string; type?: string; title?: string }[] = [];
        const linkMatches = xml.matchAll(/<link([^>]+)\/>/g);
        for (const lm of linkMatches) {
          const attrs = lm[1];
          const hrefMatch = attrs.match(/href="([^"]+)"/);
          const typeMatch = attrs.match(/type="([^"]+)"/);
          const titleMatch = attrs.match(/title="([^"]+)"/);
          if (hrefMatch) {
            links.push({
              href: hrefMatch[1],
              type: typeMatch?.[1],
              title: titleMatch?.[1],
            });
          }
        }
        return links;
      };
      
      const getDoi = (xml: string): string | undefined => {
        const m = xml.match(/<arxiv:doi[^>]*>([^<]+)<\/arxiv:doi>/);
        return m ? m[1] : undefined;
      };

      entries.push({
        id: getId(entryXml),
        title: getTitle(entryXml),
        summary: getSummary(entryXml),
        published: getPublished(entryXml),
        updated: getUpdated(entryXml),
        authors: getAuthors(entryXml),
        categories: getCategories(entryXml),
        links: getLinks(entryXml),
        doi: getDoi(entryXml),
      });
    }

    return { entries, totalResults };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.throttle();
      const response = await fetch(`${ARXIV_API_BASE}?search_query=all:test&max_results=1`);
      return response.ok;
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
      sortBy = 'relevance',
    } = options;

    await this.throttle();

    // Build search query
    // arXiv uses prefix search: ti:title, abs:abstract, au:author, all:all
    let searchQuery = query
      .split(/\s+/)
      .filter(Boolean)
      .map(term => `all:${term}`)
      .join('+AND+');

    // Add year filter using submittedDate
    if (yearFrom || yearTo) {
      const from = yearFrom || 1991; // arXiv started in 1991
      const to = yearTo || new Date().getFullYear();
      // arXiv date format: YYYYMMDD
      searchQuery += `+AND+submittedDate:[${from}0101+TO+${to}1231]`;
    }

    // Determine sort order
    let sortByParam = 'relevance';
    let sortOrder = 'descending';
    if (sortBy === 'date') {
      sortByParam = 'submittedDate';
    } else if (sortBy === 'citations') {
      // arXiv doesn't have citation sorting, fall back to relevance
      sortByParam = 'relevance';
    }

    const params = new URLSearchParams({
      search_query: searchQuery,
      start: String(offset),
      max_results: String(Math.min(limit, 100)), // arXiv max is typically 100
      sortBy: sortByParam,
      sortOrder,
    });

    try {
      const response = await fetch(`${ARXIV_API_BASE}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`arXiv API error: ${response.status}`);
      }

      const xmlText = await response.text();
      const { entries, totalResults } = this.parseAtomFeed(xmlText);

      const papers = entries.map(arxivToPaper);

      return {
        papers,
        totalHits: totalResults,
        source: this.name,
      };
    } catch (error) {
      console.error('arXiv search error:', error);
      return {
        papers: [],
        totalHits: 0,
        source: this.name,
      };
    }
  }

  async getPaper(id: string): Promise<Paper | null> {
    // Handle different ID formats
    let arxivId = id;
    if (id.startsWith('arxiv-')) {
      arxivId = id.replace('arxiv-', '');
    }

    await this.throttle();

    try {
      const response = await fetch(`${ARXIV_API_BASE}?id_list=${arxivId}`);
      
      if (!response.ok) {
        return null;
      }

      const xmlText = await response.text();
      const { entries } = this.parseAtomFeed(xmlText);

      if (entries.length === 0) {
        return null;
      }

      return arxivToPaper(entries[0]);
    } catch {
      return null;
    }
  }

  /**
   * Search within specific arXiv categories
   */
  async searchByCategory(
    query: string,
    categories: string[],
    limit: number = 10
  ): Promise<Paper[]> {
    await this.throttle();

    const categoryQuery = categories.map(c => `cat:${c}`).join('+OR+');
    const searchQuery = `(${query.split(/\s+/).map(t => `all:${t}`).join('+AND+')})+AND+(${categoryQuery})`;

    try {
      const response = await fetch(
        `${ARXIV_API_BASE}?search_query=${searchQuery}&max_results=${limit}&sortBy=relevance`
      );
      
      if (!response.ok) {
        return [];
      }

      const xmlText = await response.text();
      const { entries } = this.parseAtomFeed(xmlText);

      return entries.map(arxivToPaper);
    } catch {
      return [];
    }
  }

  /**
   * Get recent papers in a category
   */
  async getRecentPapers(category: string, limit: number = 10): Promise<Paper[]> {
    await this.throttle();

    try {
      const response = await fetch(
        `${ARXIV_API_BASE}?search_query=cat:${category}&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`
      );
      
      if (!response.ok) {
        return [];
      }

      const xmlText = await response.text();
      const { entries } = this.parseAtomFeed(xmlText);

      return entries.map(arxivToPaper);
    } catch {
      return [];
    }
  }

  /**
   * Expand common topic names to arXiv categories
   */
  getCategories(topic: string): string[] {
    const lowerTopic = topic.toLowerCase();
    for (const [key, categories] of Object.entries(CATEGORY_MAPPINGS)) {
      if (lowerTopic.includes(key)) {
        return categories;
      }
    }
    return [];
  }
}

// Export singleton instance
export const arxiv = new ArxivClient();









