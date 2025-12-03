/**
 * PaperEnricher - Service for enriching paper data with full text from multiple sources
 * Implements progressive data loading and multi-source full text retrieval
 */

import type { Paper, PaperSection, SectionType, DataSourceName } from '@/types/paper';
import { DataAvailability, calculateDataAvailability } from '@/types/paper';
import { core } from './core';
import { semanticScholar } from './semantic-scholar';
import { openAlex } from './openalex';
import { arxiv } from './arxiv';
import { paperCache } from './cache';

export interface EnrichmentOptions {
  /** Target data availability level to achieve */
  targetLevel?: DataAvailability;
  /** Try to parse PDF if available */
  parsePdf?: boolean;
  /** Extract structured sections from full text */
  extractSections?: boolean;
  /** Timeout for PDF fetch operations (ms) */
  pdfTimeout?: number;
  /** Max text length to process (chars) */
  maxTextLength?: number;
}

export interface EnrichmentResult {
  paper: Paper;
  enriched: boolean;
  previousLevel: DataAvailability;
  newLevel: DataAvailability;
  sources: DataSourceName[];
  errors?: string[];
}

const DEFAULT_OPTIONS: EnrichmentOptions = {
  targetLevel: DataAvailability.WITH_FULL_TEXT,
  parsePdf: true,
  extractSections: true,
  pdfTimeout: 30000,
  maxTextLength: 500000, // ~500KB of text
};

/**
 * PaperEnricher class for upgrading paper data availability
 */
export class PaperEnricher {
  private options: EnrichmentOptions;

  constructor(options: Partial<EnrichmentOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Enrich a paper with additional data from multiple sources
   * Attempts to achieve the target data availability level
   * Uses cache to avoid redundant API calls
   */
  async enrichPaper(paper: Paper, options?: Partial<EnrichmentOptions>): Promise<EnrichmentResult> {
    const opts = { ...this.options, ...options };
    const errors: string[] = [];
    const previousLevel = paper.dataAvailability || DataAvailability.METADATA_ONLY;
    
    // Check cache first
    const cached = paperCache.get(paper.id);
    if (cached) {
      const cachedLevel = cached.dataAvailability || DataAvailability.METADATA_ONLY;
      if (cachedLevel >= (opts.targetLevel || DataAvailability.WITH_FULL_TEXT)) {
        return {
          paper: cached,
          enriched: cachedLevel > previousLevel,
          previousLevel,
          newLevel: cachedLevel,
          sources: cached.sourceOrigin || [],
        };
      }
      // Use cached version as starting point if it's better
      if (cachedLevel > previousLevel) {
        paper = cached;
      }
    }
    
    // If already at or above target level, return as is
    if (previousLevel >= (opts.targetLevel || DataAvailability.WITH_FULL_TEXT)) {
      return {
        paper,
        enriched: false,
        previousLevel,
        newLevel: previousLevel,
        sources: paper.sourceOrigin || [],
      };
    }

    let enrichedPaper = { ...paper };
    const usedSources = new Set<DataSourceName>(paper.sourceOrigin || []);

    // Strategy 1: Try to get full text from CORE (best source for full text)
    if (!enrichedPaper.fullText || enrichedPaper.fullText.length < 100) {
      try {
        const coreResult = await this.tryGetFromCore(paper);
        if (coreResult?.fullText) {
          enrichedPaper = this.mergePaperData(enrichedPaper, coreResult);
          usedSources.add('core');
        }
      } catch (err) {
        errors.push(`CORE: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Strategy 2: If we have a PDF URL, try to fetch and parse it
    if (opts.parsePdf && !enrichedPaper.fullText && enrichedPaper.pdfUrl) {
      try {
        const pdfText = await this.fetchAndParsePdf(enrichedPaper.pdfUrl, opts.pdfTimeout);
        if (pdfText && pdfText.length > 100) {
          enrichedPaper.fullText = pdfText.slice(0, opts.maxTextLength);
        }
      } catch (err) {
        errors.push(`PDF Parse: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Strategy 3: Try arXiv if it's an arXiv paper or has arXiv ID
    if (!enrichedPaper.fullText && this.isArxivPaper(paper)) {
      try {
        const arxivResult = await this.tryGetFromArxiv(paper);
        if (arxivResult?.pdfUrl && !enrichedPaper.pdfUrl) {
          enrichedPaper.pdfUrl = arxivResult.pdfUrl;
          usedSources.add('arxiv');
          
          // Try to parse the arXiv PDF
          if (opts.parsePdf) {
            const pdfText = await this.fetchAndParsePdf(enrichedPaper.pdfUrl, opts.pdfTimeout);
            if (pdfText && pdfText.length > 100) {
              enrichedPaper.fullText = pdfText.slice(0, opts.maxTextLength);
            }
          }
        }
      } catch (err) {
        errors.push(`arXiv: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Strategy 4: Try to get better metadata from other sources
    if (!enrichedPaper.abstract || enrichedPaper.abstract.length < 50) {
      try {
        // Try Semantic Scholar for better abstract
        const s2Paper = await this.tryGetFromSemanticScholar(paper);
        if (s2Paper?.abstract && s2Paper.abstract.length > (enrichedPaper.abstract?.length || 0)) {
          enrichedPaper.abstract = s2Paper.abstract;
          usedSources.add('semantic-scholar');
        }
      } catch (err) {
        errors.push(`S2: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Extract sections if we have full text
    if (opts.extractSections && enrichedPaper.fullText && !enrichedPaper.fullTextSections) {
      enrichedPaper.fullTextSections = this.extractSections(enrichedPaper.fullText);
    }

    // Update data availability level
    enrichedPaper.dataAvailability = calculateDataAvailability({
      abstract: enrichedPaper.abstract,
      downloadUrl: enrichedPaper.downloadUrl,
      pdfUrl: enrichedPaper.pdfUrl,
      fullText: enrichedPaper.fullText,
    });

    // Update source origin
    enrichedPaper.sourceOrigin = [...usedSources];
    enrichedPaper.lastEnriched = new Date().toISOString();
    
    // Update cache with enriched paper
    paperCache.update(enrichedPaper);

    return {
      paper: enrichedPaper,
      enriched: enrichedPaper.dataAvailability > previousLevel,
      previousLevel,
      newLevel: enrichedPaper.dataAvailability,
      sources: [...usedSources],
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Batch enrich multiple papers
   */
  async enrichPapers(
    papers: Paper[],
    options?: Partial<EnrichmentOptions>
  ): Promise<EnrichmentResult[]> {
    // Process in parallel with concurrency limit
    const concurrency = 3;
    const results: EnrichmentResult[] = [];
    
    for (let i = 0; i < papers.length; i += concurrency) {
      const batch = papers.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(paper => this.enrichPaper(paper, options))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Try to get paper data from CORE
   */
  private async tryGetFromCore(paper: Paper): Promise<Paper | null> {
    // Try by CORE ID first
    if (paper.id.startsWith('core-') || /^\d+$/.test(paper.id)) {
      const coreId = paper.id.replace('core-', '');
      return core.getPaper(coreId);
    }
    
    // Try search by DOI
    if (paper.doi) {
      const result = await core.search({ query: `doi:${paper.doi}`, limit: 1 });
      if (result.papers.length > 0) {
        return result.papers[0];
      }
    }
    
    // Try search by title
    const result = await core.search({ 
      query: `title:"${paper.title}"`, 
      limit: 1,
      openAccess: true,
    });
    
    if (result.papers.length > 0) {
      // Verify it's the same paper
      const found = result.papers[0];
      if (this.isSamePaper(paper, found)) {
        return found;
      }
    }
    
    return null;
  }

  /**
   * Try to get paper data from arXiv
   */
  private async tryGetFromArxiv(paper: Paper): Promise<Paper | null> {
    // Extract arXiv ID if present
    const arxivId = this.extractArxivId(paper);
    if (arxivId) {
      return arxiv.getPaper(arxivId);
    }
    
    // Search by title
    const result = await arxiv.search({
      query: paper.title,
      limit: 1,
    });
    
    if (result.papers.length > 0 && this.isSamePaper(paper, result.papers[0])) {
      return result.papers[0];
    }
    
    return null;
  }

  /**
   * Try to get paper data from Semantic Scholar
   */
  private async tryGetFromSemanticScholar(paper: Paper): Promise<Paper | null> {
    // Try by S2 ID
    if (paper.id.startsWith('s2-')) {
      return semanticScholar.getPaper(paper.id);
    }
    
    // Try by DOI
    if (paper.doi) {
      const result = await semanticScholar.search({ query: `doi:${paper.doi}`, limit: 1 });
      if (result.papers.length > 0) {
        return result.papers[0];
      }
    }
    
    return null;
  }

  /**
   * Fetch and parse PDF content
   * Note: Full PDF parsing requires a server-side solution or external service
   */
  private async fetchAndParsePdf(pdfUrl: string, timeout?: number): Promise<string | null> {
    // In a browser environment, we can't directly parse PDFs
    // This would need to call a server-side API or use a service like GROBID
    
    // For now, we'll just validate the URL and return null
    // The actual implementation would be:
    // 1. Fetch the PDF
    // 2. Use pdf-parse or pdfjs-dist on server side
    // 3. Extract text content
    
    try {
      // Validate URL is accessible
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout || 5000);
      
      const response = await fetch(pdfUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return null;
      }
      
      // In production, this would make a call to a PDF parsing service
      // For now, return null and rely on other sources
      console.log(`[PaperEnricher] PDF available at ${pdfUrl}, parsing not implemented in client`);
      return null;
    } catch (err) {
      console.warn(`[PaperEnricher] PDF fetch failed: ${err}`);
      return null;
    }
  }

  /**
   * Extract structured sections from full text
   */
  extractSections(fullText: string): PaperSection[] {
    const sections: PaperSection[] = [];
    
    // Common section patterns
    const sectionPatterns: { pattern: RegExp; type: SectionType }[] = [
      { pattern: /^(?:abstract|summary)\s*[:.]?\s*$/im, type: 'abstract' },
      { pattern: /^(?:\d+\.?\s*)?introduction\s*$/im, type: 'introduction' },
      { pattern: /^(?:\d+\.?\s*)?(?:background|related\s+work|literature\s+review)\s*$/im, type: 'background' },
      { pattern: /^(?:\d+\.?\s*)?(?:method(?:s|ology)?|approach|materials?\s+and\s+methods?)\s*$/im, type: 'methods' },
      { pattern: /^(?:\d+\.?\s*)?(?:results?|findings?|experiments?)\s*$/im, type: 'results' },
      { pattern: /^(?:\d+\.?\s*)?discussion\s*$/im, type: 'discussion' },
      { pattern: /^(?:\d+\.?\s*)?(?:conclusion(?:s)?|summary|concluding\s+remarks?)\s*$/im, type: 'conclusion' },
      { pattern: /^(?:\d+\.?\s*)?(?:references?|bibliography)\s*$/im, type: 'references' },
      { pattern: /^(?:\d+\.?\s*)?acknowledgement?s?\s*$/im, type: 'acknowledgments' },
    ];

    // Split text into lines and find section boundaries
    const lines = fullText.split('\n');
    let currentSection: { title: string; type: SectionType; startIndex: number; lines: string[] } | null = null;
    let charIndex = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      let foundSection = false;

      // Check if this line is a section header
      for (const { pattern, type } of sectionPatterns) {
        if (pattern.test(trimmedLine)) {
          // Save previous section
          if (currentSection) {
            sections.push({
              title: currentSection.title,
              sectionType: currentSection.type,
              content: currentSection.lines.join('\n').trim(),
              startIndex: currentSection.startIndex,
              endIndex: charIndex,
            });
          }

          // Start new section
          currentSection = {
            title: trimmedLine,
            type,
            startIndex: charIndex,
            lines: [],
          };
          foundSection = true;
          break;
        }
      }

      // Add line to current section
      if (!foundSection && currentSection) {
        currentSection.lines.push(line);
      }

      charIndex += line.length + 1; // +1 for newline
    }

    // Save last section
    if (currentSection) {
      sections.push({
        title: currentSection.title,
        sectionType: currentSection.type,
        content: currentSection.lines.join('\n').trim(),
        startIndex: currentSection.startIndex,
        endIndex: charIndex,
      });
    }

    // If no sections were found, create a single "other" section
    if (sections.length === 0 && fullText.length > 0) {
      sections.push({
        title: 'Full Text',
        sectionType: 'other',
        content: fullText,
        startIndex: 0,
        endIndex: fullText.length,
      });
    }

    return sections;
  }

  /**
   * Check if paper is from arXiv or has arXiv ID
   */
  private isArxivPaper(paper: Paper): boolean {
    if (paper.id.startsWith('arxiv-')) return true;
    if (paper.sourceOrigin?.includes('arxiv')) return true;
    if (paper.sourceUrl?.includes('arxiv.org')) return true;
    if (paper.downloadUrl?.includes('arxiv.org')) return true;
    return false;
  }

  /**
   * Extract arXiv ID from paper
   */
  private extractArxivId(paper: Paper): string | null {
    if (paper.id.startsWith('arxiv-')) {
      return paper.id.replace('arxiv-', '');
    }
    
    // Try to extract from URL
    const urls = [paper.sourceUrl, paper.downloadUrl, paper.pdfUrl].filter(Boolean);
    for (const url of urls) {
      const match = url?.match(/arxiv\.org\/(?:abs|pdf)\/(\d+\.\d+)/);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Check if two papers are the same
   */
  private isSamePaper(a: Paper, b: Paper): boolean {
    // Same DOI
    if (a.doi && b.doi && a.doi.toLowerCase() === b.doi.toLowerCase()) {
      return true;
    }
    
    // Very similar titles (after normalization)
    const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
    const titleA = normalizeTitle(a.title);
    const titleB = normalizeTitle(b.title);
    
    if (titleA === titleB) return true;
    
    // Levenshtein distance for fuzzy matching (simple check)
    if (titleA.length > 20 && titleB.length > 20) {
      const commonPrefix = this.longestCommonPrefix(titleA, titleB);
      if (commonPrefix.length > Math.min(titleA.length, titleB.length) * 0.8) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Find longest common prefix of two strings
   */
  private longestCommonPrefix(a: string, b: string): string {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) {
      i++;
    }
    return a.slice(0, i);
  }

  /**
   * Merge data from two papers, keeping the most complete version
   */
  private mergePaperData(base: Paper, additional: Paper): Paper {
    return {
      ...base,
      abstract: (additional.abstract?.length || 0) > (base.abstract?.length || 0) 
        ? additional.abstract 
        : base.abstract,
      fullText: additional.fullText || base.fullText,
      downloadUrl: additional.downloadUrl || base.downloadUrl,
      pdfUrl: additional.pdfUrl || base.pdfUrl,
      fullTextSections: additional.fullTextSections || base.fullTextSections,
    };
  }
}

// Export singleton instance
export const paperEnricher = new PaperEnricher();

/**
 * Convenience function for enriching a single paper
 */
export async function enrichPaper(
  paper: Paper,
  options?: Partial<EnrichmentOptions>
): Promise<EnrichmentResult> {
  return paperEnricher.enrichPaper(paper, options);
}

/**
 * Convenience function for batch enrichment
 */
export async function enrichPapers(
  papers: Paper[],
  options?: Partial<EnrichmentOptions>
): Promise<EnrichmentResult[]> {
  return paperEnricher.enrichPapers(papers, options);
}

/**
 * Get a specific section from a paper's full text
 */
export function getPaperSection(
  paper: Paper,
  sectionType: SectionType
): PaperSection | null {
  if (!paper.fullTextSections) {
    // Try to extract sections on the fly
    if (paper.fullText) {
      paper.fullTextSections = paperEnricher.extractSections(paper.fullText);
    } else {
      return null;
    }
  }
  
  return paper.fullTextSections.find(s => s.sectionType === sectionType) || null;
}

/**
 * Get multiple sections from a paper
 */
export function getPaperSections(
  paper: Paper,
  sectionTypes: SectionType[]
): PaperSection[] {
  if (!paper.fullTextSections && paper.fullText) {
    paper.fullTextSections = paperEnricher.extractSections(paper.fullText);
  }
  
  if (!paper.fullTextSections) return [];
  
  return paper.fullTextSections.filter(s => sectionTypes.includes(s.sectionType));
}

