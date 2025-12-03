/**
 * IEEE Citation Formatter
 * Institute of Electrical and Electronics Engineers style
 */

import type { CitationData, CitationFormatter, InTextOptions } from '../types';
import {
  formatAuthorsReference,
  formatTitle,
  formatVolumeIssue,
  formatPages,
  formatDoi,
  sortByAppearance,
  detectPublicationType,
} from '../utils';

export class IEEEFormatter implements CitationFormatter {
  readonly style = 'ieee' as const;
  readonly name = 'IEEE';
  readonly inTextFormat = 'numeric' as const;

  formatInText(citation: CitationData, options: InTextOptions = {}): string {
    const index = citation.index || 1;
    return `[${index}]`;
  }

  formatInTextGroup(citations: CitationData[], options: InTextOptions = {}): string {
    if (citations.length === 0) return '';
    if (citations.length === 1) return this.formatInText(citations[0], options);
    
    const indices = citations.map(c => c.index || 0).sort((a, b) => a - b);
    
    // Check for consecutive numbers to use range notation
    const ranges: string[] = [];
    let rangeStart = indices[0];
    let rangeEnd = indices[0];
    
    for (let i = 1; i <= indices.length; i++) {
      if (i < indices.length && indices[i] === rangeEnd + 1) {
        rangeEnd = indices[i];
      } else {
        if (rangeEnd - rangeStart >= 2) {
          ranges.push(`${rangeStart}–${rangeEnd}`);
        } else if (rangeEnd - rangeStart === 1) {
          ranges.push(`${rangeStart}, ${rangeEnd}`);
        } else {
          ranges.push(String(rangeStart));
        }
        if (i < indices.length) {
          rangeStart = indices[i];
          rangeEnd = indices[i];
        }
      }
    }
    
    return `[${ranges.join(', ')}]`;
  }

  formatReference(citation: CitationData): string {
    const type = detectPublicationType(citation);
    const index = citation.index || 1;
    
    let reference: string;
    
    switch (type) {
      case 'journal-article':
        reference = this.formatJournalArticle(citation);
        break;
      case 'conference-paper':
        reference = this.formatConferencePaper(citation);
        break;
      case 'book':
        reference = this.formatBook(citation);
        break;
      case 'preprint':
        reference = this.formatPreprint(citation);
        break;
      default:
        reference = this.formatGeneric(citation);
    }
    
    return `[${index}] ${reference}`;
  }

  private formatJournalArticle(citation: CitationData): string {
    const parts: string[] = [];
    
    // Authors: F. M. Last
    const authors = formatAuthorsReference(citation.authors, 'ieee');
    parts.push(authors + ',');
    
    // Title in quotes
    const title = formatTitle(citation.title, 'ieee', false);
    parts.push(`"${title},"`);
    
    // Journal in italics
    if (citation.journal) {
      let journalPart = `*${citation.journal}*`;
      
      // Volume and issue
      const volIssue = formatVolumeIssue(citation.volume, citation.issue, 'ieee');
      if (volIssue) {
        journalPart += `, ${volIssue}`;
      }
      
      // Pages
      if (citation.pages) {
        journalPart += `, ${formatPages(citation.pages, 'ieee')}`;
      }
      
      // Year
      journalPart += `, ${citation.year}`;
      
      parts.push(journalPart + '.');
    } else {
      parts.push(`${citation.year}.`);
    }
    
    // DOI
    if (citation.doi) {
      parts.push(`doi: ${citation.doi.replace(/^https?:\/\/doi\.org\//, '')}.`);
    }
    
    return parts.join(' ');
  }

  private formatConferencePaper(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'ieee');
    parts.push(authors + ',');
    
    const title = formatTitle(citation.title, 'ieee', false);
    parts.push(`"${title},"`);
    
    if (citation.conference) {
      parts.push(`in *${citation.conference}*,`);
    }
    
    if (citation.location) {
      parts.push(citation.location + ',');
    }
    
    parts.push(citation.year + ',');
    
    if (citation.pages) {
      parts.push(`${formatPages(citation.pages, 'ieee')}.`);
    }
    
    if (citation.doi) {
      parts.push(`doi: ${citation.doi.replace(/^https?:\/\/doi\.org\//, '')}.`);
    }
    
    return parts.join(' ');
  }

  private formatBook(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'ieee');
    parts.push(authors + ',');
    
    // Book title in italics
    const title = formatTitle(citation.title, 'ieee', false);
    let titlePart = `*${title}*`;
    
    if (citation.edition) {
      titlePart += `, ${citation.edition} ed.`;
    }
    
    parts.push(titlePart + '.');
    
    if (citation.location && citation.publisher) {
      parts.push(`${citation.location}: ${citation.publisher}, ${citation.year}.`);
    } else if (citation.publisher) {
      parts.push(`${citation.publisher}, ${citation.year}.`);
    } else {
      parts.push(`${citation.year}.`);
    }
    
    return parts.join(' ');
  }

  private formatPreprint(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'ieee');
    parts.push(authors + ',');
    
    const title = formatTitle(citation.title, 'ieee', false);
    parts.push(`"${title},"`);
    
    if (citation.arxivId) {
      parts.push(`arXiv preprint arXiv:${citation.arxivId}, ${citation.year}.`);
    } else {
      parts.push(`preprint, ${citation.year}.`);
    }
    
    if (citation.url) {
      parts.push(`[Online]. Available: ${citation.url}`);
    }
    
    return parts.join(' ');
  }

  private formatGeneric(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'ieee');
    parts.push(authors + ',');
    
    const title = formatTitle(citation.title, 'ieee', false);
    parts.push(`"${title},"`);
    
    if (citation.journal) {
      parts.push(`*${citation.journal}*,`);
    }
    
    parts.push(`${citation.year}.`);
    
    if (citation.doi) {
      parts.push(`doi: ${citation.doi.replace(/^https?:\/\/doi\.org\//, '')}.`);
    } else if (citation.url) {
      parts.push(`[Online]. Available: ${citation.url}`);
    }
    
    return parts.join(' ');
  }

  formatReferenceList(citations: CitationData[]): string {
    const sorted = this.sortCitations(citations);
    return sorted.map(c => this.formatReference(c)).join('\n\n');
  }

  sortCitations(citations: CitationData[]): CitationData[] {
    return sortByAppearance(citations);
  }
}

// Export singleton instance
export const ieeeFormatter = new IEEEFormatter();









