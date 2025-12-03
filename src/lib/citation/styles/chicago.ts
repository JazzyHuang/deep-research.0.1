/**
 * Chicago 17th Edition Citation Formatter (Author-Date style)
 * Chicago Manual of Style
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

export class ChicagoFormatter implements CitationFormatter {
  readonly style = 'chicago' as const;
  readonly name = 'Chicago 17th Edition';
  readonly inTextFormat = 'author-date' as const;

  formatInText(citation: CitationData, options: InTextOptions = {}): string {
    const {
      includeYear = true,
      parenthetical = true,
      pageNumbers,
      prefix,
      suffix,
      suppressAuthor = false,
    } = options;

    const authors = formatAuthorsInText(citation.authors, 'chicago');
    const year = citation.year;
    
    let parts: string[] = [];
    
    if (!suppressAuthor) {
      parts.push(authors);
    }
    
    if (includeYear) {
      parts.push(String(year));
    }
    
    if (pageNumbers) {
      parts.push(pageNumbers);
    }
    
    let text = parts.join(', ');
    
    if (prefix) {
      text = `${prefix} ${text}`;
    }
    
    if (suffix) {
      text = `${text}, ${suffix}`;
    }
    
    if (parenthetical) {
      return `(${text})`;
    }
    
    // Narrative citation
    return `${authors} (${year}${pageNumbers ? ', ' + pageNumbers : ''})`;
  }

  formatInTextGroup(citations: CitationData[], options: InTextOptions = {}): string {
    if (citations.length === 0) return '';
    if (citations.length === 1) return this.formatInText(citations[0], options);
    
    const parts = citations.map(c => {
      const authors = formatAuthorsInText(c.authors, 'chicago');
      return `${authors} ${c.year}`;
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
      case 'book-chapter':
        return this.formatBookChapter(citation);
      case 'webpage':
        return this.formatWebpage(citation);
      default:
        return this.formatGeneric(citation);
    }
  }

  private formatJournalArticle(citation: CitationData): string {
    const parts: string[] = [];
    
    // Authors: Last, First, and First Last.
    const authors = formatAuthorsReference(citation.authors, 'chicago');
    parts.push(authors + '.');
    
    // Year
    parts.push(String(citation.year) + '.');
    
    // Title in quotes (title case)
    const title = formatTitle(citation.title, 'chicago', false);
    parts.push(`"${title}."`);
    
    // Journal in italics
    if (citation.journal) {
      let journalPart = `*${citation.journal}*`;
      
      // Volume and issue
      if (citation.volume) {
        journalPart += ` ${citation.volume}`;
        if (citation.issue) {
          journalPart += `, no. ${citation.issue}`;
        }
      }
      
      // Month if available, otherwise just year (already added)
      
      // Pages
      if (citation.pages) {
        journalPart += `: ${formatPages(citation.pages, 'chicago')}`;
      }
      
      parts.push(journalPart + '.');
    }
    
    // DOI
    if (citation.doi) {
      parts.push(formatDoi(citation.doi) + '.');
    }
    
    return parts.join(' ');
  }

  private formatConferencePaper(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'chicago');
    parts.push(authors + '.');
    parts.push(String(citation.year) + '.');
    
    const title = formatTitle(citation.title, 'chicago', false);
    parts.push(`"${title}."`);
    
    if (citation.conference) {
      parts.push(`Paper presented at ${citation.conference}`);
      if (citation.location) {
        parts[parts.length - 1] += `, ${citation.location}`;
      }
      parts[parts.length - 1] += '.';
    }
    
    if (citation.doi) {
      parts.push(formatDoi(citation.doi) + '.');
    }
    
    return parts.join(' ');
  }

  private formatBook(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'chicago');
    parts.push(authors + '.');
    parts.push(String(citation.year) + '.');
    
    // Book title in italics
    const title = formatTitle(citation.title, 'chicago', false);
    let titlePart = `*${title}*`;
    
    if (citation.edition) {
      titlePart += `. ${citation.edition} ed`;
    }
    
    parts.push(titlePart + '.');
    
    if (citation.location && citation.publisher) {
      parts.push(`${citation.location}: ${citation.publisher}.`);
    } else if (citation.publisher) {
      parts.push(citation.publisher + '.');
    }
    
    return parts.join(' ');
  }

  private formatBookChapter(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'chicago');
    parts.push(authors + '.');
    parts.push(String(citation.year) + '.');
    
    const title = formatTitle(citation.title, 'chicago', false);
    parts.push(`"${title}."`);
    
    if (citation.journal) { // Using journal field for book title
      parts.push(`In *${citation.journal}*`);
      if (citation.pages) {
        parts[parts.length - 1] += `, ${formatPages(citation.pages, 'chicago')}`;
      }
      parts[parts.length - 1] += '.';
    }
    
    if (citation.publisher) {
      parts.push(citation.publisher + '.');
    }
    
    return parts.join(' ');
  }

  private formatWebpage(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'chicago');
    parts.push(authors + '.');
    parts.push(String(citation.year) + '.');
    
    const title = formatTitle(citation.title, 'chicago', false);
    parts.push(`"${title}."`);
    
    if (citation.publisher) {
      parts.push(citation.publisher + '.');
    }
    
    if (citation.accessDate) {
      const dateStr = citation.accessDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      parts.push(`Accessed ${dateStr}.`);
    }
    
    if (citation.url) {
      parts.push(citation.url + '.');
    }
    
    return parts.join(' ');
  }

  private formatGeneric(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'chicago');
    parts.push(authors + '.');
    parts.push(String(citation.year) + '.');
    
    const title = formatTitle(citation.title, 'chicago', false);
    parts.push(`"${title}."`);
    
    if (citation.journal) {
      parts.push(`*${citation.journal}*.`);
    }
    
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
export const chicagoFormatter = new ChicagoFormatter();









