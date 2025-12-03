import type { Paper } from '@/types/paper';
import type {
  DataSource,
  SearchOptions,
  SearchResult,
  PubMedSearchResponse,
  PubMedSummaryResponse,
  PubMedArticle,
} from './types';
import { pubmedToPaper } from './types';

const PUBMED_EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export class PubMedClient implements DataSource {
  name = 'pubmed' as const;
  private apiKey?: string;
  private rateLimit: number;
  private lastRequest: number = 0;

  constructor(apiKey?: string, rateLimit: number = 3) {
    this.apiKey = apiKey || process.env.PUBMED_API_KEY;
    // Without API key: 3 requests/second, with key: 10 requests/second
    this.rateLimit = this.apiKey ? 10 : rateLimit;
  }

  private async throttle(): Promise<void> {
    const minInterval = 1000 / this.rateLimit;
    const elapsed = Date.now() - this.lastRequest;
    if (elapsed < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - elapsed));
    }
    this.lastRequest = Date.now();
  }

  private buildUrl(endpoint: string, params: Record<string, string>): string {
    const url = new URL(`${PUBMED_EUTILS_BASE}/${endpoint}`);
    
    // Add API key if available
    if (this.apiKey) {
      params.api_key = this.apiKey;
    }
    
    // Always request JSON
    params.retmode = 'json';
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    
    return url.toString();
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.throttle();
      const url = this.buildUrl('esearch.fcgi', {
        db: 'pubmed',
        term: 'test',
        retmax: '1',
      });
      const response = await fetch(url);
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

    // Build PubMed query
    let searchTerm = query;

    // Add year filter
    if (yearFrom || yearTo) {
      const from = yearFrom || 1800;
      const to = yearTo || new Date().getFullYear();
      searchTerm += ` AND ${from}:${to}[dp]`; // dp = date of publication
    }

    // Determine sort order
    let sort = 'relevance';
    if (sortBy === 'date') {
      sort = 'pub_date';
    } else if (sortBy === 'citations') {
      // PubMed doesn't have citation sorting directly
      sort = 'relevance';
    }

    try {
      // Step 1: Search for PMIDs
      const searchUrl = this.buildUrl('esearch.fcgi', {
        db: 'pubmed',
        term: searchTerm,
        retmax: String(Math.min(limit, 100)),
        retstart: String(offset),
        sort,
        usehistory: 'n',
      });

      const searchResponse = await fetch(searchUrl);
      if (!searchResponse.ok) {
        throw new Error(`PubMed search error: ${searchResponse.status}`);
      }

      const searchData: PubMedSearchResponse = await searchResponse.json();
      const pmids = searchData.esearchresult.idlist;
      const totalHits = parseInt(searchData.esearchresult.count) || 0;

      if (pmids.length === 0) {
        return {
          papers: [],
          totalHits: 0,
          source: this.name,
        };
      }

      // Step 2: Fetch article details
      await this.throttle();
      const summaryUrl = this.buildUrl('esummary.fcgi', {
        db: 'pubmed',
        id: pmids.join(','),
      });

      const summaryResponse = await fetch(summaryUrl);
      if (!summaryResponse.ok) {
        throw new Error(`PubMed summary error: ${summaryResponse.status}`);
      }

      const summaryData: PubMedSummaryResponse = await summaryResponse.json();

      // Step 3: Fetch abstracts separately (esummary doesn't include them)
      const abstractMap = await this.fetchAbstracts(pmids);

      // Convert to papers
      const papers: Paper[] = [];
      for (const uid of summaryData.result.uids) {
        const article = summaryData.result[uid] as PubMedArticle;
        if (article && typeof article !== 'object') continue;
        
        // Add abstract
        article.abstract = abstractMap.get(uid) || '';
        
        papers.push(pubmedToPaper(article));
      }

      return {
        papers,
        totalHits,
        source: this.name,
      };
    } catch (error) {
      console.error('PubMed search error:', error);
      return {
        papers: [],
        totalHits: 0,
        source: this.name,
      };
    }
  }

  private async fetchAbstracts(pmids: string[]): Promise<Map<string, string>> {
    const abstractMap = new Map<string, string>();
    
    if (pmids.length === 0) return abstractMap;

    await this.throttle();

    try {
      const fetchUrl = this.buildUrl('efetch.fcgi', {
        db: 'pubmed',
        id: pmids.join(','),
        rettype: 'abstract',
        retmode: 'xml',
      });

      const response = await fetch(fetchUrl);
      if (!response.ok) return abstractMap;

      const xmlText = await response.text();

      // Parse abstracts from XML
      // Simple regex-based parsing for abstracts
      const articleMatches = xmlText.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g);
      
      for (const match of articleMatches) {
        const articleXml = match[1];
        
        // Extract PMID
        const pmidMatch = articleXml.match(/<PMID[^>]*>(\d+)<\/PMID>/);
        if (!pmidMatch) continue;
        
        const pmid = pmidMatch[1];
        
        // Extract abstract
        const abstractMatch = articleXml.match(/<Abstract>([\s\S]*?)<\/Abstract>/);
        if (abstractMatch) {
          // Extract all AbstractText elements
          const abstractTexts: string[] = [];
          const textMatches = abstractMatch[1].matchAll(/<AbstractText[^>]*>([^<]*)<\/AbstractText>/g);
          for (const tm of textMatches) {
            abstractTexts.push(tm[1].trim());
          }
          abstractMap.set(pmid, abstractTexts.join(' '));
        }
      }
    } catch (error) {
      console.error('Error fetching abstracts:', error);
    }

    return abstractMap;
  }

  async getPaper(id: string): Promise<Paper | null> {
    // Handle different ID formats
    let pmid = id;
    if (id.startsWith('pubmed-')) {
      pmid = id.replace('pubmed-', '');
    }

    await this.throttle();

    try {
      const summaryUrl = this.buildUrl('esummary.fcgi', {
        db: 'pubmed',
        id: pmid,
      });

      const summaryResponse = await fetch(summaryUrl);
      if (!summaryResponse.ok) return null;

      const summaryData: PubMedSummaryResponse = await summaryResponse.json();
      const article = summaryData.result[pmid] as PubMedArticle;
      
      if (!article) return null;

      // Fetch abstract
      const abstractMap = await this.fetchAbstracts([pmid]);
      article.abstract = abstractMap.get(pmid) || '';

      return pubmedToPaper(article);
    } catch {
      return null;
    }
  }

  /**
   * Search for clinical trials
   */
  async searchClinicalTrials(query: string, limit: number = 10): Promise<Paper[]> {
    const result = await this.search({
      query: `${query} AND clinical trial[pt]`,
      limit,
    });
    return result.papers;
  }

  /**
   * Search for review articles
   */
  async searchReviews(query: string, limit: number = 10): Promise<Paper[]> {
    const result = await this.search({
      query: `${query} AND review[pt]`,
      limit,
    });
    return result.papers;
  }

  /**
   * Search for meta-analyses
   */
  async searchMetaAnalyses(query: string, limit: number = 10): Promise<Paper[]> {
    const result = await this.search({
      query: `${query} AND meta-analysis[pt]`,
      limit,
    });
    return result.papers;
  }

  /**
   * Get related articles for a given PMID
   */
  async getRelatedArticles(pmid: string, limit: number = 10): Promise<Paper[]> {
    await this.throttle();

    try {
      const linkUrl = this.buildUrl('elink.fcgi', {
        dbfrom: 'pubmed',
        db: 'pubmed',
        id: pmid.replace('pubmed-', ''),
        cmd: 'neighbor_score',
      });

      const linkResponse = await fetch(linkUrl);
      if (!linkResponse.ok) return [];

      const linkText = await linkResponse.text();
      
      // Parse related PMIDs from XML response
      const relatedIds: string[] = [];
      const idMatches = linkText.matchAll(/<Id>(\d+)<\/Id>/g);
      for (const match of idMatches) {
        if (relatedIds.length < limit && match[1] !== pmid.replace('pubmed-', '')) {
          relatedIds.push(match[1]);
        }
      }

      if (relatedIds.length === 0) return [];

      // Fetch the related articles
      const result = await this.search({
        query: relatedIds.map(id => `${id}[uid]`).join(' OR '),
        limit,
      });

      return result.papers;
    } catch {
      return [];
    }
  }
}

// Export singleton instance
export const pubmed = new PubMedClient();









