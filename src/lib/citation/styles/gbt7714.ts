/**
 * GB/T 7714-2015 Citation Formatter
 * 中国国家标准文献引用格式
 */

import type { CitationData, CitationFormatter, InTextOptions } from '../types';
import {
  formatAuthorsReference,
  formatTitle,
  formatPages,
  formatDoi,
  sortByAppearance,
  detectPublicationType,
  getLastName,
} from '../utils';

export class GBT7714Formatter implements CitationFormatter {
  readonly style = 'gbt7714' as const;
  readonly name = 'GB/T 7714-2015';
  readonly inTextFormat = 'numeric' as const;

  formatInText(citation: CitationData, options: InTextOptions = {}): string {
    const index = citation.index || 1;
    const { pageNumbers } = options;
    
    if (pageNumbers) {
      return `[${index}](${pageNumbers})`;
    }
    
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
          ranges.push(`${rangeStart}-${rangeEnd}`);
        } else if (rangeEnd - rangeStart === 1) {
          ranges.push(`${rangeStart},${rangeEnd}`);
        } else {
          ranges.push(String(rangeStart));
        }
        if (i < indices.length) {
          rangeStart = indices[i];
          rangeEnd = indices[i];
        }
      }
    }
    
    return `[${ranges.join(',')}]`;
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
      case 'webpage':
        reference = this.formatWebpage(citation);
        break;
      default:
        reference = this.formatGeneric(citation);
    }
    
    return `[${index}] ${reference}`;
  }

  private formatAuthors(citation: CitationData): string {
    // GB/T 7714 specific author formatting
    return formatAuthorsReference(citation.authors, 'gbt7714');
  }

  private formatJournalArticle(citation: CitationData): string {
    const parts: string[] = [];
    
    // 作者. 题名[J]. 刊名, 年, 卷(期): 起止页码.
    const authors = this.formatAuthors(citation);
    parts.push(authors + '.');
    
    // Title with document type indicator [J] for journal
    const title = formatTitle(citation.title, 'gbt7714', false);
    parts.push(`${title}[J].`);
    
    // Journal
    if (citation.journal) {
      let journalPart = citation.journal;
      
      // Year, volume(issue): pages
      journalPart += `, ${citation.year}`;
      
      if (citation.volume) {
        journalPart += `, ${citation.volume}`;
        if (citation.issue) {
          journalPart += `(${citation.issue})`;
        }
      }
      
      if (citation.pages) {
        journalPart += `: ${formatPages(citation.pages, 'gbt7714')}`;
      }
      
      parts.push(journalPart + '.');
    }
    
    // DOI
    if (citation.doi) {
      parts.push(`DOI: ${citation.doi.replace(/^https?:\/\/doi\.org\//, '')}.`);
    }
    
    return parts.join(' ');
  }

  private formatConferencePaper(citation: CitationData): string {
    const parts: string[] = [];
    
    // 作者. 题名[C]// 会议论文集名. 出版地: 出版者, 年: 起止页码.
    const authors = this.formatAuthors(citation);
    parts.push(authors + '.');
    
    const title = formatTitle(citation.title, 'gbt7714', false);
    parts.push(`${title}[C]//`);
    
    if (citation.conference) {
      parts.push(citation.conference + '.');
    }
    
    if (citation.location && citation.publisher) {
      parts.push(`${citation.location}: ${citation.publisher}, ${citation.year}`);
    } else if (citation.publisher) {
      parts.push(`${citation.publisher}, ${citation.year}`);
    } else {
      parts.push(String(citation.year));
    }
    
    if (citation.pages) {
      parts.push(`: ${formatPages(citation.pages, 'gbt7714')}.`);
    } else {
      parts[parts.length - 1] += '.';
    }
    
    return parts.join(' ');
  }

  private formatBook(citation: CitationData): string {
    const parts: string[] = [];
    
    // 作者. 书名[M]. 版本. 出版地: 出版者, 年.
    const authors = this.formatAuthors(citation);
    parts.push(authors + '.');
    
    const title = formatTitle(citation.title, 'gbt7714', false);
    let titlePart = `${title}[M]`;
    
    if (citation.edition) {
      titlePart += `. ${citation.edition}版`;
    }
    
    parts.push(titlePart + '.');
    
    if (citation.location && citation.publisher) {
      parts.push(`${citation.location}: ${citation.publisher}, ${citation.year}.`);
    } else if (citation.publisher) {
      parts.push(`${citation.publisher}, ${citation.year}.`);
    } else {
      parts.push(String(citation.year) + '.');
    }
    
    return parts.join(' ');
  }

  private formatPreprint(citation: CitationData): string {
    const parts: string[] = [];
    
    // 作者. 题名[EB/OL]. (发布日期)[引用日期]. 网址.
    const authors = this.formatAuthors(citation);
    parts.push(authors + '.');
    
    const title = formatTitle(citation.title, 'gbt7714', false);
    parts.push(`${title}[EB/OL].`);
    
    parts.push(`(${citation.year})`);
    
    if (citation.accessDate) {
      const dateStr = citation.accessDate.toISOString().split('T')[0];
      parts.push(`[${dateStr}].`);
    } else {
      parts[parts.length - 1] += '.';
    }
    
    if (citation.arxivId) {
      parts.push(`https://arxiv.org/abs/${citation.arxivId}.`);
    } else if (citation.url) {
      parts.push(citation.url + '.');
    }
    
    return parts.join(' ');
  }

  private formatWebpage(citation: CitationData): string {
    const parts: string[] = [];
    
    // 作者. 题名[EB/OL]. (发布日期)[引用日期]. 网址.
    const authors = this.formatAuthors(citation);
    parts.push(authors + '.');
    
    const title = formatTitle(citation.title, 'gbt7714', false);
    parts.push(`${title}[EB/OL].`);
    
    parts.push(`(${citation.year})`);
    
    if (citation.accessDate) {
      const dateStr = citation.accessDate.toISOString().split('T')[0];
      parts.push(`[${dateStr}].`);
    } else {
      parts[parts.length - 1] += '.';
    }
    
    if (citation.url) {
      parts.push(citation.url + '.');
    }
    
    return parts.join(' ');
  }

  private formatGeneric(citation: CitationData): string {
    const parts: string[] = [];
    
    const authors = this.formatAuthors(citation);
    parts.push(authors + '.');
    
    const title = formatTitle(citation.title, 'gbt7714', false);
    // Use [Z] for other types
    parts.push(`${title}[Z].`);
    
    if (citation.journal) {
      parts.push(`${citation.journal},`);
    }
    
    parts.push(String(citation.year) + '.');
    
    if (citation.doi) {
      parts.push(`DOI: ${citation.doi.replace(/^https?:\/\/doi\.org\//, '')}.`);
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
    return sortByAppearance(citations);
  }
}

// Export singleton instance
export const gbt7714Formatter = new GBT7714Formatter();









