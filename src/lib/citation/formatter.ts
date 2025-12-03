/**
 * Citation Formatter Factory and Manager
 * Central hub for formatting citations across different styles
 */

import type { 
  CitationStyle, 
  CitationData, 
  CitationFormatter, 
  InTextOptions,
  CITATION_STYLES 
} from './types';
import type { Paper } from '@/types/paper';
import type { Citation } from '@/types/research';
import { APAFormatter } from './styles/apa';
import { MLAFormatter } from './styles/mla';
import { ChicagoFormatter } from './styles/chicago';
import { IEEEFormatter } from './styles/ieee';
import { GBT7714Formatter } from './styles/gbt7714';

// Formatter instances
const formatters: Record<CitationStyle, CitationFormatter> = {
  apa: new APAFormatter(),
  mla: new MLAFormatter(),
  chicago: new ChicagoFormatter(),
  ieee: new IEEEFormatter(),
  gbt7714: new GBT7714Formatter(),
};

/**
 * Get a formatter for a specific citation style
 */
export function getFormatter(style: CitationStyle): CitationFormatter {
  const formatter = formatters[style];
  if (!formatter) {
    console.warn(`Unknown citation style: ${style}, falling back to APA`);
    return formatters.apa;
  }
  return formatter;
}

/**
 * Format a single in-text citation
 */
export function formatInText(
  citation: CitationData,
  style: CitationStyle,
  options?: InTextOptions
): string {
  return getFormatter(style).formatInText(citation, options);
}

/**
 * Format multiple in-text citations
 */
export function formatInTextGroup(
  citations: CitationData[],
  style: CitationStyle,
  options?: InTextOptions
): string {
  return getFormatter(style).formatInTextGroup(citations, options);
}

/**
 * Format a single reference for bibliography
 */
export function formatReference(
  citation: CitationData,
  style: CitationStyle
): string {
  return getFormatter(style).formatReference(citation);
}

/**
 * Format a complete reference list
 */
export function formatReferenceList(
  citations: CitationData[],
  style: CitationStyle
): string {
  return getFormatter(style).formatReferenceList(citations);
}

/**
 * Convert Paper to CitationData
 */
export function paperToCitationData(
  paper: Paper,
  index?: number
): CitationData {
  return {
    id: paper.id,
    paperId: paper.id,
    title: paper.title,
    authors: paper.authors,
    year: paper.year,
    journal: paper.journal,
    volume: paper.volume,
    issue: paper.issue,
    pages: paper.pages,
    doi: paper.doi,
    url: paper.downloadUrl || paper.sourceUrl,
    publisher: paper.publisher,
    conference: paper.conference,
    arxivId: paper.id.startsWith('arxiv-') ? paper.id.replace('arxiv-', '') : undefined,
    pmid: paper.id.startsWith('pubmed-') ? paper.id.replace('pubmed-', '') : undefined,
    index,
    publicationType: detectPublicationType(paper),
  };
}

/**
 * Convert Citation to CitationData
 */
export function citationToCitationData(
  citation: Citation,
  index?: number
): CitationData {
  return {
    id: citation.id,
    paperId: citation.paperId,
    title: citation.title,
    authors: citation.authors.map(name => ({ name })),
    year: citation.year,
    journal: citation.journal,
    volume: citation.volume,
    issue: citation.issue,
    pages: citation.pages,
    doi: citation.doi,
    url: citation.url,
    index: index ?? extractIndex(citation.inTextRef),
  };
}

/**
 * Extract citation index from in-text reference like "[1]"
 */
function extractIndex(inTextRef?: string): number | undefined {
  if (!inTextRef) return undefined;
  const match = inTextRef.match(/\[(\d+)\]/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Detect publication type from Paper
 */
function detectPublicationType(paper: Paper): CitationData['publicationType'] {
  if (paper.id.startsWith('arxiv-')) {
    return 'preprint';
  }
  if (paper.conference) {
    return 'conference-paper';
  }
  if (paper.journal) {
    return 'journal-article';
  }
  return 'other';
}

/**
 * Create citations from papers with assigned indices
 */
export function createCitationMap(
  papers: Paper[],
  style: CitationStyle = 'ieee'
): Map<string, CitationData> {
  const formatter = getFormatter(style);
  const citationMap = new Map<string, CitationData>();
  
  papers.forEach((paper, idx) => {
    const citationData = paperToCitationData(paper, idx + 1);
    citationMap.set(paper.id, citationData);
  });
  
  return citationMap;
}

/**
 * Generate in-text reference string based on style
 */
export function generateInTextRef(
  citation: CitationData,
  style: CitationStyle
): string {
  const formatter = getFormatter(style);
  
  // For numeric styles, use the index
  if (formatter.inTextFormat === 'numeric') {
    return `[${citation.index || 1}]`;
  }
  
  // For author-year styles, format appropriately
  return formatter.formatInText(citation, { parenthetical: true });
}

/**
 * Batch convert citations to formatted references
 */
export function formatAllReferences(
  citations: CitationData[],
  style: CitationStyle
): { formatted: string[]; list: string } {
  const formatter = getFormatter(style);
  const sorted = formatter.sortCitations(citations);
  
  return {
    formatted: sorted.map(c => formatter.formatReference(c)),
    list: formatter.formatReferenceList(sorted),
  };
}

/**
 * Check if a style uses numeric citations
 */
export function isNumericStyle(style: CitationStyle): boolean {
  return getFormatter(style).inTextFormat === 'numeric';
}

/**
 * Get the recommended sort order for a style
 */
export function getSortOrder(style: CitationStyle): 'author' | 'number' | 'appearance' {
  const formatter = getFormatter(style);
  if (formatter.inTextFormat === 'numeric') {
    return 'appearance';
  }
  return 'author';
}









