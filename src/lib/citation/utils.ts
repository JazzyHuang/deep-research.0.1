/**
 * Citation Utility Functions
 * Helper functions for formatting citations across all styles
 */

import type { Author } from '@/types/paper';
import type { CitationData } from './types';

/**
 * Get the last name from a full name
 * Handles various formats: "John Smith", "Smith, John", "J. Smith"
 */
export function getLastName(name: string): string {
  if (!name) return '';
  
  // If contains comma, assume "Last, First" format
  if (name.includes(',')) {
    return name.split(',')[0].trim();
  }
  
  // Otherwise assume "First Last" format
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

/**
 * Get first name or initials from a full name
 */
export function getFirstName(name: string): string {
  if (!name) return '';
  
  if (name.includes(',')) {
    const parts = name.split(',');
    return parts.length > 1 ? parts[1].trim() : '';
  }
  
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, -1).join(' ');
}

/**
 * Convert first name to initials
 * "John Michael" -> "J. M."
 */
export function toInitials(firstName: string): string {
  if (!firstName) return '';
  
  return firstName
    .split(/\s+/)
    .filter(part => part.length > 0)
    .map(part => {
      // Handle already initialized names like "J."
      if (part.length <= 2 && part.endsWith('.')) return part;
      return part[0].toUpperCase() + '.';
    })
    .join(' ');
}

/**
 * Format a single author name in different styles
 */
export function formatAuthorName(
  author: Author | string,
  style: 'apa' | 'mla' | 'chicago' | 'ieee' | 'gbt7714' | 'short',
  position: 'first' | 'subsequent' = 'first'
): string {
  const name = typeof author === 'string' ? author : author.name;
  const lastName = getLastName(name);
  const firstName = getFirstName(name);
  
  switch (style) {
    case 'apa':
      // APA: Last, F. M.
      return `${lastName}, ${toInitials(firstName)}`;
    
    case 'mla':
      // MLA: First author "Last, First", subsequent "First Last"
      if (position === 'first') {
        return `${lastName}, ${firstName}`;
      }
      return `${firstName} ${lastName}`;
    
    case 'chicago':
      // Chicago: First author "Last, First", subsequent "First Last"
      if (position === 'first') {
        return `${lastName}, ${firstName}`;
      }
      return `${firstName} ${lastName}`;
    
    case 'ieee':
      // IEEE: F. M. Last
      return `${toInitials(firstName)} ${lastName}`;
    
    case 'gbt7714':
      // GB/T 7714: 姓名 (Chinese) or LAST Name (Western)
      // Check if Chinese name (no space in original name)
      if (/[\u4e00-\u9fa5]/.test(name)) {
        return name;
      }
      return `${lastName.toUpperCase()} ${firstName}`;
    
    case 'short':
      return lastName;
    
    default:
      return name;
  }
}

/**
 * Format author list for in-text citation
 */
export function formatAuthorsInText(
  authors: Author[],
  style: 'apa' | 'mla' | 'chicago' | 'ieee' | 'gbt7714'
): string {
  if (authors.length === 0) return 'Unknown';
  
  const lastNames = authors.map(a => getLastName(a.name));
  
  switch (style) {
    case 'apa':
    case 'chicago':
      if (authors.length === 1) {
        return lastNames[0];
      }
      if (authors.length === 2) {
        return `${lastNames[0]} & ${lastNames[1]}`;
      }
      return `${lastNames[0]} et al.`;
    
    case 'mla':
      if (authors.length === 1) {
        return lastNames[0];
      }
      if (authors.length === 2) {
        return `${lastNames[0]} and ${lastNames[1]}`;
      }
      return `${lastNames[0]} et al.`;
    
    case 'ieee':
      // IEEE uses numbers, not author names in text
      return lastNames[0] + (authors.length > 1 ? ' et al.' : '');
    
    case 'gbt7714':
      if (authors.length <= 3) {
        return lastNames.join('、');
      }
      return `${lastNames[0]}等`;
    
    default:
      return lastNames[0];
  }
}

/**
 * Format author list for reference/bibliography
 */
export function formatAuthorsReference(
  authors: Author[],
  style: 'apa' | 'mla' | 'chicago' | 'ieee' | 'gbt7714',
  maxAuthors: number = 20
): string {
  if (authors.length === 0) return 'Unknown';
  
  const formatAuthor = (a: Author, idx: number) => 
    formatAuthorName(a, style, idx === 0 ? 'first' : 'subsequent');
  
  switch (style) {
    case 'apa':
      // APA: Up to 20 authors, use & before last
      if (authors.length === 1) {
        return formatAuthor(authors[0], 0);
      }
      if (authors.length === 2) {
        return `${formatAuthor(authors[0], 0)}, & ${formatAuthor(authors[1], 1)}`;
      }
      if (authors.length <= maxAuthors) {
        const formatted = authors.map((a, i) => formatAuthor(a, i));
        const last = formatted.pop();
        return `${formatted.join(', ')}, & ${last}`;
      }
      // More than 20: first 19 ... last
      const first19 = authors.slice(0, 19).map((a, i) => formatAuthor(a, i));
      return `${first19.join(', ')}, ... ${formatAuthor(authors[authors.length - 1], 19)}`;
    
    case 'mla':
      // MLA: Up to 2 authors, then "et al."
      if (authors.length === 1) {
        return formatAuthor(authors[0], 0);
      }
      if (authors.length === 2) {
        return `${formatAuthor(authors[0], 0)}, and ${formatAuthor(authors[1], 1)}`;
      }
      return `${formatAuthor(authors[0], 0)}, et al.`;
    
    case 'chicago':
      // Chicago: Up to 10 authors
      if (authors.length === 1) {
        return formatAuthor(authors[0], 0);
      }
      if (authors.length <= 10) {
        const formatted = authors.map((a, i) => formatAuthor(a, i));
        const last = formatted.pop();
        return `${formatted.join(', ')}, and ${last}`;
      }
      const first7 = authors.slice(0, 7).map((a, i) => formatAuthor(a, i));
      return `${first7.join(', ')}, et al.`;
    
    case 'ieee':
      // IEEE: First 6, then "et al."
      if (authors.length === 1) {
        return formatAuthor(authors[0], 0);
      }
      if (authors.length === 2) {
        return `${formatAuthor(authors[0], 0)} and ${formatAuthor(authors[1], 1)}`;
      }
      if (authors.length <= 6) {
        const formatted = authors.map((a, i) => formatAuthor(a, i));
        const last = formatted.pop();
        return `${formatted.join(', ')}, and ${last}`;
      }
      return `${formatAuthor(authors[0], 0)} et al.`;
    
    case 'gbt7714':
      // GB/T 7714: First 3, then "等"
      if (authors.length <= 3) {
        return authors.map((a, i) => formatAuthor(a, i)).join(', ');
      }
      const first3 = authors.slice(0, 3).map((a, i) => formatAuthor(a, i));
      return `${first3.join(', ')}, 等`;
    
    default:
      return authors.map(a => a.name).join(', ');
  }
}

/**
 * Format page numbers
 */
export function formatPages(pages: string | undefined, style: 'apa' | 'mla' | 'chicago' | 'ieee' | 'gbt7714'): string {
  if (!pages) return '';
  
  // Normalize page range separator
  const normalized = pages.replace(/[-–—]/g, '-');
  
  switch (style) {
    case 'apa':
    case 'chicago':
      return normalized.replace('-', '–'); // en-dash
    case 'mla':
      return normalized.replace('-', '-'); // hyphen
    case 'ieee':
      return `pp. ${normalized.replace('-', '–')}`;
    case 'gbt7714':
      return normalized;
    default:
      return normalized;
  }
}

/**
 * Format DOI as URL
 */
export function formatDoi(doi: string | undefined): string {
  if (!doi) return '';
  
  // Remove existing URL prefix if present
  const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, '');
  return `https://doi.org/${cleanDoi}`;
}

/**
 * Format URL with access date for styles that require it
 */
export function formatUrl(
  url: string | undefined, 
  accessDate?: Date,
  style: 'apa' | 'mla' | 'chicago' | 'ieee' | 'gbt7714' = 'apa'
): string {
  if (!url) return '';
  
  if (accessDate && (style === 'mla' || style === 'chicago')) {
    const dateStr = accessDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return `${url}. Accessed ${dateStr}`;
  }
  
  return url;
}

/**
 * Format journal volume and issue
 */
export function formatVolumeIssue(
  volume: string | undefined,
  issue: string | undefined,
  style: 'apa' | 'mla' | 'chicago' | 'ieee' | 'gbt7714'
): string {
  if (!volume && !issue) return '';
  
  switch (style) {
    case 'apa':
      // APA: volume(issue) - volume in italics handled in formatter
      if (volume && issue) return `${volume}(${issue})`;
      return volume || '';
    
    case 'mla':
      // MLA: vol. X, no. Y
      if (volume && issue) return `vol. ${volume}, no. ${issue}`;
      if (volume) return `vol. ${volume}`;
      return '';
    
    case 'chicago':
      // Chicago: volume, no. issue
      if (volume && issue) return `${volume}, no. ${issue}`;
      return volume || '';
    
    case 'ieee':
      // IEEE: vol. X, no. Y
      if (volume && issue) return `vol. ${volume}, no. ${issue}`;
      if (volume) return `vol. ${volume}`;
      return '';
    
    case 'gbt7714':
      // GB/T 7714: 卷(期)
      if (volume && issue) return `${volume}(${issue})`;
      return volume || '';
    
    default:
      return volume || '';
  }
}

/**
 * Capitalize title according to style rules
 */
export function formatTitle(
  title: string,
  style: 'apa' | 'mla' | 'chicago' | 'ieee' | 'gbt7714',
  isJournalTitle: boolean = false
): string {
  if (!title) return '';
  
  // Remove trailing period if present
  let cleanTitle = title.trim().replace(/\.$/, '');
  
  switch (style) {
    case 'apa':
      // APA: Sentence case for article titles, Title Case for journal names
      if (isJournalTitle) return cleanTitle; // Keep as-is for journal
      return toSentenceCase(cleanTitle);
    
    case 'mla':
      // MLA: Title case for all
      return toTitleCase(cleanTitle);
    
    case 'chicago':
      // Chicago: Title case
      return toTitleCase(cleanTitle);
    
    case 'ieee':
      // IEEE: Title case with quotation marks for articles
      return toTitleCase(cleanTitle);
    
    case 'gbt7714':
      // GB/T 7714: Keep original case
      return cleanTitle;
    
    default:
      return cleanTitle;
  }
}

/**
 * Convert to sentence case (first letter caps, rest lowercase except proper nouns)
 */
export function toSentenceCase(str: string): string {
  if (!str) return '';
  
  // Keep acronyms (all caps words) and words after colons capitalized
  return str
    .split(': ')
    .map((part, i) => {
      if (i === 0) {
        return part.charAt(0).toUpperCase() + 
          part.slice(1).replace(/\b[A-Z]{2,}\b/g, match => match) // Keep acronyms
            .replace(/\b(?![A-Z]{2,}\b)[A-Za-z]+/g, (match, offset) => 
              offset === 0 ? match : match.toLowerCase()
            );
      }
      // After colon, capitalize first letter
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(': ');
}

/**
 * Convert to title case
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  
  const minorWords = new Set([
    'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 
    'to', 'by', 'of', 'in', 'as', 'is', 'it', 'its'
  ]);
  
  return str
    .split(' ')
    .map((word, index) => {
      // Always capitalize first and last word
      if (index === 0 || !minorWords.has(word.toLowerCase())) {
        // Keep acronyms uppercase
        if (word === word.toUpperCase() && word.length > 1) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.toLowerCase();
    })
    .join(' ');
}

/**
 * Sort citations by author name (for author-year styles)
 */
export function sortByAuthor(citations: CitationData[]): CitationData[] {
  return [...citations].sort((a, b) => {
    const authorA = a.authors[0] ? getLastName(a.authors[0].name).toLowerCase() : '';
    const authorB = b.authors[0] ? getLastName(b.authors[0].name).toLowerCase() : '';
    
    if (authorA !== authorB) {
      return authorA.localeCompare(authorB);
    }
    
    // Same author, sort by year
    return a.year - b.year;
  });
}

/**
 * Sort citations by appearance order
 */
export function sortByAppearance(citations: CitationData[]): CitationData[] {
  return [...citations].sort((a, b) => (a.index || 0) - (b.index || 0));
}

/**
 * Detect publication type from citation data
 */
export function detectPublicationType(citation: CitationData): CitationData['publicationType'] {
  if (citation.publicationType) return citation.publicationType;
  
  if (citation.arxivId || citation.url?.includes('arxiv')) {
    return 'preprint';
  }
  if (citation.conference) {
    return 'conference-paper';
  }
  if (citation.isbn) {
    return citation.pages ? 'book-chapter' : 'book';
  }
  if (citation.journal) {
    return 'journal-article';
  }
  if (citation.url && !citation.doi) {
    return 'webpage';
  }
  
  return 'other';
}









