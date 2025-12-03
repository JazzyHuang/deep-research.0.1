/**
 * APA 7th Edition Citation Formatter
 * American Psychological Association style
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

export class APAFormatter implements CitationFormatter {
  readonly style = 'apa' as const;
  readonly name = 'APA 7th Edition';
  readonly inTextFormat = 'author-year' as const;

  formatInText(citation: CitationData, options: InTextOptions = {}): string {
    const { 
      includeYear = true, 
      parenthetical = true,
      pageNumbers,
      prefix,
      suffix,
      suppressAuthor = false,
    } = options;

    const authors = formatAuthorsInText(citation.authors, 'apa');
    const year = citation.year;
    
    let parts: string[] = [];
    
    if (!suppressAuthor) {
      parts.push(authors);
    }
    
    if (includeYear) {
      parts.push(String(year));
    }
    
    if (pageNumbers) {
      parts.push(`p. ${pageNumbers}`);
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
    
    // Narrative citation: Author (year)
    if (suppressAuthor) {
      return `(${text})`;
    }
    return `${authors} (${year}${pageNumbers ? `, p. ${pageNumbers}` : ''})`;
  }

  formatInTextGroup(citations: CitationData[], options: InTextOptions = {}): string {
    if (citations.length === 0) return '';
    if (citations.length === 1) return this.formatInText(citations[0], options);
    
    // Sort by author then year
    const sorted = [...citations].sort((a, b) => {
      const authorA = a.authors[0]?.name || '';
      const authorB = b.authors[0]?.name || '';
      if (authorA !== authorB) return authorA.localeCompare(authorB);
      return a.year - b.year;
    });
    
    const parts = sorted.map(c => {
      const authors = formatAuthorsInText(c.authors, 'apa');
      return `${authors}, ${c.year}`;
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
      case 'preprint':
        return this.formatPreprint(citation);
      case 'webpage':
        return this.formatWebpage(citation);
      default:
        return this.formatGeneric(citation);
    }
  }

  private formatJournalArticle(citation: CitationData): string {
    const parts: string[] = [];
    
    // Authors
    const authors = formatAuthorsReference(citation.authors, 'apa');
    parts.push(authors);
    
    // Year
    parts.push(`(${citation.year}).`);
    
    // Title (sentence case)
    const title = formatTitle(citation.title, 'apa', false);
    parts.push(`${title}.`);
    
    // Journal (italics represented with *)
    if (citation.journal) {
      let journalPart = `*${citation.journal}*`;
      
      // Volume and issue
      const volIssue = formatVolumeIssue(citation.volume, citation.issue, 'apa');
      if (volIssue) {
        // Volume in italics, issue in parentheses not italic
        if (citation.issue) {
          journalPart += `, *${citation.volume}*(${citation.issue})`;
        } else if (citation.volume) {
          journalPart += `, *${citation.volume}*`;
        }
      }
      
      // Pages
      if (citation.pages) {
        journalPart += `, ${formatPages(citation.pages, 'apa')}`;
      }
      
      parts.push(journalPart + '.');
    }
    
    // DOI
    if (citation.doi) {
      parts.push(formatDoi(citation.doi));
    } else if (citation.url) {
      parts.push(citation.url);
    }
    
    return parts.join(' ');
  }

  private formatConferencePaper(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'apa');
    parts.push(authors);
    parts.push(`(${citation.year}).`);
    
    const title = formatTitle(citation.title, 'apa', false);
    parts.push(`${title}.`);
    
    if (citation.conference) {
      parts.push(`In *${citation.conference}*`);
      if (citation.pages) {
        parts.push(`(pp. ${formatPages(citation.pages, 'apa')}).`);
      } else {
        parts[parts.length - 1] += '.';
      }
    }
    
    if (citation.publisher) {
      parts.push(citation.publisher + '.');
    }
    
    if (citation.doi) {
      parts.push(formatDoi(citation.doi));
    } else if (citation.url) {
      parts.push(citation.url);
    }
    
    return parts.join(' ');
  }

  private formatBook(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'apa');
    parts.push(authors);
    parts.push(`(${citation.year}).`);
    
    // Book title in italics
    let titlePart = `*${formatTitle(citation.title, 'apa', false)}*`;
    if (citation.edition) {
      titlePart += ` (${citation.edition} ed.)`;
    }
    parts.push(titlePart + '.');
    
    if (citation.publisher) {
      parts.push(citation.publisher + '.');
    }
    
    if (citation.doi) {
      parts.push(formatDoi(citation.doi));
    }
    
    return parts.join(' ');
  }

  private formatBookChapter(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'apa');
    parts.push(authors);
    parts.push(`(${citation.year}).`);
    
    const title = formatTitle(citation.title, 'apa', false);
    parts.push(`${title}.`);
    
    // In Editor (Ed.), Book title (pp. xx-xx).
    parts.push('In');
    
    if (citation.journal) { // Using journal field for book title
      let bookPart = `*${citation.journal}*`;
      if (citation.pages) {
        bookPart += ` (pp. ${formatPages(citation.pages, 'apa')})`;
      }
      parts.push(bookPart + '.');
    }
    
    if (citation.publisher) {
      parts.push(citation.publisher + '.');
    }
    
    if (citation.doi) {
      parts.push(formatDoi(citation.doi));
    }
    
    return parts.join(' ');
  }

  private formatPreprint(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'apa');
    parts.push(authors);
    parts.push(`(${citation.year}).`);
    
    const title = formatTitle(citation.title, 'apa', false);
    parts.push(`*${title}*.`);
    
    if (citation.arxivId) {
      parts.push(`arXiv.`);
      parts.push(`https://arxiv.org/abs/${citation.arxivId}`);
    } else if (citation.url) {
      parts.push(citation.url);
    }
    
    return parts.join(' ');
  }

  private formatWebpage(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'apa');
    parts.push(authors);
    parts.push(`(${citation.year}).`);
    
    const title = formatTitle(citation.title, 'apa', false);
    parts.push(`*${title}*.`);
    
    if (citation.publisher) {
      parts.push(citation.publisher + '.');
    }
    
    if (citation.url) {
      parts.push(citation.url);
    }
    
    return parts.join(' ');
  }

  private formatGeneric(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = formatAuthorsReference(citation.authors, 'apa');
    parts.push(authors);
    parts.push(`(${citation.year}).`);
    
    const title = formatTitle(citation.title, 'apa', false);
    parts.push(`${title}.`);
    
    if (citation.journal) {
      parts.push(`*${citation.journal}*.`);
    }
    
    if (citation.doi) {
      parts.push(formatDoi(citation.doi));
    } else if (citation.url) {
      parts.push(citation.url);
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
export const apaFormatter = new APAFormatter();









