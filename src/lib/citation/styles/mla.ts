/**
 * MLA 9th Edition Citation Formatter
 * Modern Language Association style
 */

import type { CitationData, CitationFormatter, InTextOptions } from '../types';
import {
  formatAuthorsInText,
  formatAuthorsReference,
  formatTitle,
  formatVolumeIssue,
  formatPages,
  formatDoi,
  sortByAuthor,
  detectPublicationType,
} from '../utils';

export class MLAFormatter implements CitationFormatter {
  readonly style = 'mla' as const;
  readonly name = 'MLA 9th Edition';
  readonly inTextFormat = 'author-date' as const;

  formatInText(citation: CitationData, options: InTextOptions = {}): string {
    const {
      pageNumbers,
      prefix,
      suffix,
      suppressAuthor = false,
    } = options;

    const authors = formatAuthorsInText(citation.authors, 'mla');
    
    let parts: string[] = [];
    
    if (!suppressAuthor) {
      parts.push(authors);
    }
    
    if (pageNumbers) {
      parts.push(pageNumbers);
    }
    
    let text = parts.join(' ');
    
    if (prefix) {
      text = `${prefix} ${text}`;
    }
    
    if (suffix) {
      text = `${text}, ${suffix}`;
    }
    
    return `(${text})`;
  }

  formatInTextGroup(citations: CitationData[], options: InTextOptions = {}): string {
    if (citations.length === 0) return '';
    if (citations.length === 1) return this.formatInText(citations[0], options);
    
    const parts = citations.map(c => {
      const authors = formatAuthorsInText(c.authors, 'mla');
      return authors;
    });
    
    return `(${parts.join('; ')})`;
  }

  formatReference(citation: CitationData): string {
    const type = detectPublicationType(citation);
    
    switch (type) {
      case 'journal-article':
        return this.formatJournalArticle(citation);
      case 'conference-paper':
        return this.formatConferencePaper(citation);
      case 'book':
        return this.formatBook(citation);
      case 'webpage':
        return this.formatWebpage(citation);
      default:
        return this.formatGeneric(citation);
    }
  }

  private formatJournalArticle(citation: CitationData): string {
    const parts: string[] = [];
    
    // Authors: Last, First, and First Last.
    const authors = formatAuthorsReference(citation.authors, 'mla');
    parts.push(authors + '.');
    
    // Title in quotes (title case)
    const title = formatTitle(citation.title, 'mla', false);
    parts.push(`"${title}."`);
    
    // Journal in italics
    if (citation.journal) {
      let journalPart = `*${citation.journal}*`;
      
      // Volume and issue
      const volIssue = formatVolumeIssue(citation.volume, citation.issue, 'mla');
      if (volIssue) {
        journalPart += `, ${volIssue}`;
      }
      
      // Year
      journalPart += `, ${citation.year}`;
      
      // Pages
      if (citation.pages) {
        journalPart += `, pp. ${formatPages(citation.pages, 'mla')}`;
      }
      
      parts.push(journalPart + '.');
    }
    
    // DOI (preferred) or URL
    if (citation.doi) {
      parts.push(formatDoi(citation.doi) + '.');
    } else if (citation.url) {
      parts.push(citation.url + '.');
    }
    
    return parts.join(' ');
  }

  private formatConferencePaper(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'mla');
    parts.push(authors + '.');
    
    const title = formatTitle(citation.title, 'mla', false);
    parts.push(`"${title}."`);
    
    if (citation.conference) {
      parts.push(`*${citation.conference}*,`);
    }
    
    parts.push(String(citation.year) + ',');
    
    if (citation.pages) {
      parts.push(`pp. ${formatPages(citation.pages, 'mla')}.`);
    }
    
    if (citation.doi) {
      parts.push(formatDoi(citation.doi) + '.');
    }
    
    return parts.join(' ');
  }

  private formatBook(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'mla');
    parts.push(authors + '.');
    
    // Book title in italics
    const title = formatTitle(citation.title, 'mla', false);
    let titlePart = `*${title}*`;
    
    if (citation.edition) {
      titlePart += `, ${citation.edition} ed.`;
    }
    
    parts.push(titlePart + '.');
    
    if (citation.publisher) {
      parts.push(citation.publisher + ',');
    }
    
    parts.push(String(citation.year) + '.');
    
    return parts.join(' ');
  }

  private formatWebpage(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'mla');
    parts.push(authors + '.');
    
    const title = formatTitle(citation.title, 'mla', false);
    parts.push(`"${title}."`);
    
    if (citation.publisher) {
      parts.push(`*${citation.publisher}*,`);
    }
    
    parts.push(String(citation.year) + ',');
    
    if (citation.url) {
      parts.push(citation.url + '.');
    }
    
    if (citation.accessDate) {
      const dateStr = citation.accessDate.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      parts.push(`Accessed ${dateStr}.`);
    }
    
    return parts.join(' ');
  }

  private formatGeneric(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'mla');
    parts.push(authors + '.');
    
    const title = formatTitle(citation.title, 'mla', false);
    parts.push(`"${title}."`);
    
    if (citation.journal) {
      parts.push(`*${citation.journal}*,`);
    }
    
    parts.push(String(citation.year) + '.');
    
    if (citation.doi) {
      parts.push(formatDoi(citation.doi) + '.');
    } else if (citation.url) {
      parts.push(citation.url + '.');
    }
    
    return parts.join(' ');
  }

  formatReferenceList(citations: CitationData[]): string {
    const sorted = this.sortCitations(citations);
    return sorted.map(c => this.formatReference(c)).join('\n\n');
  }

  sortCitations(citations: CitationData[]): CitationData[] {
    return sortByAuthor(citations);
  }
}

// Export singleton instance
export const mlaFormatter = new MLAFormatter();









