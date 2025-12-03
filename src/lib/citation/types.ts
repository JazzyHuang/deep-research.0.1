/**
 * Citation Style Types and Interfaces
 * Supports multiple academic citation formats
 */

import type { Author } from '@/types/paper';

// Supported citation styles
export type CitationStyle = 'apa' | 'mla' | 'chicago' | 'ieee' | 'gbt7714';

// In-text citation format type
export type InTextFormat = 'numeric' | 'author-year' | 'author-date' | 'note';

// Publication type for determining format rules
export type PublicationType = 
  | 'journal-article'
  | 'conference-paper'
  | 'book'
  | 'book-chapter'
  | 'thesis'
  | 'report'
  | 'preprint'
  | 'webpage'
  | 'other';

// Complete citation data structure with all metadata
export interface CitationData {
  id: string;
  paperId: string;
  
  // Core bibliographic data
  title: string;
  authors: Author[];
  year: number;
  
  // Publication details
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  
  // Identifiers
  doi?: string;
  url?: string;
  isbn?: string;
  issn?: string;
  arxivId?: string;
  pmid?: string;
  
  // Additional metadata
  publisher?: string;
  location?: string;        // Publication location/city
  conference?: string;      // Conference name
  edition?: string;
  publicationType?: PublicationType;
  accessDate?: Date;        // For web sources
  language?: string;
  
  // Generated reference info
  index?: number;           // Citation number [1], [2], etc.
  inTextRef?: string;       // Pre-formatted in-text reference
}

// Options for in-text citation formatting
export interface InTextOptions {
  includeYear?: boolean;
  parenthetical?: boolean;  // (Smith, 2023) vs Smith (2023)
  pageNumbers?: string;     // Specific page reference
  prefix?: string;          // e.g., "see" in "see Smith, 2023"
  suffix?: string;          // e.g., "emphasis added"
  suppressAuthor?: boolean; // For narrative citations where author is in text
}

// Citation formatter interface - implemented by each style
export interface CitationFormatter {
  // Style metadata
  readonly style: CitationStyle;
  readonly name: string;
  readonly inTextFormat: InTextFormat;
  
  // Format a single in-text citation
  formatInText(citation: CitationData, options?: InTextOptions): string;
  
  // Format multiple in-text citations (e.g., [1, 2, 3] or (Smith, 2020; Jones, 2021))
  formatInTextGroup(citations: CitationData[], options?: InTextOptions): string;
  
  // Format a single reference for the bibliography
  formatReference(citation: CitationData): string;
  
  // Format the complete reference list
  formatReferenceList(citations: CitationData[]): string;
  
  // Sort citations according to style rules
  sortCitations(citations: CitationData[]): CitationData[];
}

// Style configuration
export interface StyleConfig {
  style: CitationStyle;
  name: string;
  description: string;
  inTextFormat: InTextFormat;
  requiresSorting: boolean;
  sortBy: 'author' | 'number' | 'appearance';
}

// Style metadata for UI
export const CITATION_STYLES: Record<CitationStyle, StyleConfig> = {
  apa: {
    style: 'apa',
    name: 'APA 7th Edition',
    description: 'American Psychological Association - commonly used in social sciences',
    inTextFormat: 'author-year',
    requiresSorting: true,
    sortBy: 'author',
  },
  mla: {
    style: 'mla',
    name: 'MLA 9th Edition',
    description: 'Modern Language Association - commonly used in humanities',
    inTextFormat: 'author-date',
    requiresSorting: true,
    sortBy: 'author',
  },
  chicago: {
    style: 'chicago',
    name: 'Chicago 17th Edition',
    description: 'Chicago Manual of Style - versatile style for various disciplines',
    inTextFormat: 'author-date',
    requiresSorting: true,
    sortBy: 'author',
  },
  ieee: {
    style: 'ieee',
    name: 'IEEE',
    description: 'Institute of Electrical and Electronics Engineers - used in engineering/CS',
    inTextFormat: 'numeric',
    requiresSorting: false,
    sortBy: 'appearance',
  },
  gbt7714: {
    style: 'gbt7714',
    name: 'GB/T 7714-2015',
    description: '中国国家标准 - 中文学术论文引用格式',
    inTextFormat: 'numeric',
    requiresSorting: false,
    sortBy: 'appearance',
  },
};









