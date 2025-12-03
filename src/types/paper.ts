/**
 * Data availability levels for progressive loading
 * Higher levels include all data from lower levels
 */
export enum DataAvailability {
  METADATA_ONLY = 1,    // Only title, authors, year
  WITH_ABSTRACT = 2,    // Includes abstract
  WITH_PDF_LINK = 3,    // Has downloadable PDF link
  WITH_FULL_TEXT = 4,   // Full text content parsed and available
}

/**
 * Section types for structured full text
 */
export type SectionType = 
  | 'abstract' 
  | 'introduction' 
  | 'background'
  | 'methods' 
  | 'results' 
  | 'discussion' 
  | 'conclusion' 
  | 'references'
  | 'acknowledgments'
  | 'other';

/**
 * Structured section of a paper's full text
 */
export interface PaperSection {
  title: string;
  content: string;
  sectionType: SectionType;
  startIndex?: number;  // Character position in original text
  endIndex?: number;
}

/**
 * Data source names for tracking paper origins
 */
export type DataSourceName = 'core' | 'semantic-scholar' | 'openalex' | 'arxiv' | 'pubmed';

export interface Paper {
  id: string;
  title: string;
  authors: Author[];
  abstract: string;
  year: number;
  publishedDate?: string;
  doi?: string;
  downloadUrl?: string;
  sourceUrl?: string;
  journal?: string;
  publisher?: string;
  subjects?: string[];
  citations?: number;
  references?: string[];
  openAccess: boolean;
  language?: string;
  fullText?: string;
  // Extended citation metadata
  volume?: string;
  issue?: string;
  pages?: string;
  isbn?: string;
  issn?: string;
  conference?: string;
  edition?: string;
  location?: string;
  // Data availability and source tracking (new fields)
  dataAvailability: DataAvailability;
  sourceOrigin: DataSourceName[];      // Data sources this paper came from (can be merged)
  lastEnriched?: string;               // ISO date string of last enrichment
  fullTextSections?: PaperSection[];   // Structured full text sections
  pdfUrl?: string;                     // Direct PDF URL (may differ from downloadUrl)
}

export interface Author {
  name: string;
  affiliations?: string[];
  orcid?: string;
}

export interface CoreApiResponse {
  totalHits: number;
  limit: number;
  offset: number;
  scrollId?: string;
  results: CorePaper[];
}

export interface CorePaper {
  id: number;
  doi?: string;
  title: string;
  authors?: CoreAuthor[];
  abstract?: string;
  yearPublished?: number;
  publishedDate?: string;
  downloadUrl?: string;
  sourceFulltextUrls?: string[];
  journals?: CoreJournal[];
  publisher?: string;
  subjects?: string[];
  citationCount?: number;
  references?: CoreReference[];
  language?: CoreLanguage;
  fullText?: string;
  documentType?: string;
}

export interface CoreAuthor {
  id?: number;
  name: string;
  affiliations?: string[];
  orcid?: string;
}

export interface CoreJournal {
  title?: string;
  identifiers?: string[];
}

export interface CoreReference {
  id?: number;
  title?: string;
  authors?: string;
  date?: string;
  doi?: string;
}

export interface CoreLanguage {
  code?: string;
  name?: string;
}

/**
 * Calculate data availability level based on available fields
 */
export function calculateDataAvailability(paper: {
  abstract?: string;
  downloadUrl?: string;
  pdfUrl?: string;
  fullText?: string;
}): DataAvailability {
  if (paper.fullText && paper.fullText.length > 100) {
    return DataAvailability.WITH_FULL_TEXT;
  }
  if (paper.downloadUrl || paper.pdfUrl) {
    return DataAvailability.WITH_PDF_LINK;
  }
  if (paper.abstract && paper.abstract.length > 10) {
    return DataAvailability.WITH_ABSTRACT;
  }
  return DataAvailability.METADATA_ONLY;
}

/**
 * Get human-readable label for data availability level
 */
export function getDataAvailabilityLabel(level: DataAvailability): string {
  switch (level) {
    case DataAvailability.WITH_FULL_TEXT:
      return 'Full Text Available';
    case DataAvailability.WITH_PDF_LINK:
      return 'PDF Available';
    case DataAvailability.WITH_ABSTRACT:
      return 'Abstract Only';
    case DataAvailability.METADATA_ONLY:
    default:
      return 'Metadata Only';
  }
}

// Helper function to convert CORE API response to our Paper type
export function corePaperToPaper(corePaper: CorePaper): Paper {
  const downloadUrl = corePaper.downloadUrl || corePaper.sourceFulltextUrls?.[0];
  const hasFullText = !!corePaper.fullText && corePaper.fullText.length > 100;
  
  return {
    id: String(corePaper.id),
    title: corePaper.title || 'Untitled',
    authors: (corePaper.authors || []).map(a => ({
      name: a.name,
      affiliations: a.affiliations,
      orcid: a.orcid,
    })),
    abstract: corePaper.abstract || '',
    year: corePaper.yearPublished || new Date().getFullYear(),
    publishedDate: corePaper.publishedDate,
    doi: corePaper.doi,
    downloadUrl,
    sourceUrl: corePaper.sourceFulltextUrls?.[0],
    journal: corePaper.journals?.[0]?.title,
    publisher: corePaper.publisher,
    subjects: corePaper.subjects,
    citations: corePaper.citationCount,
    references: corePaper.references?.map(r => r.title || '').filter(Boolean),
    openAccess: !!downloadUrl,
    language: corePaper.language?.name || corePaper.language?.code,
    fullText: corePaper.fullText,
    // New fields
    dataAvailability: calculateDataAvailability({
      abstract: corePaper.abstract,
      downloadUrl,
      fullText: corePaper.fullText,
    }),
    sourceOrigin: ['core'],
    pdfUrl: downloadUrl?.endsWith('.pdf') ? downloadUrl : undefined,
  };
}

// Format authors for citation
export function formatAuthorsForCitation(authors: Author[], style: 'apa' | 'short' = 'short'): string {
  if (authors.length === 0) return 'Unknown';
  
  if (style === 'short') {
    if (authors.length === 1) {
      const lastName = authors[0].name.split(' ').pop() || authors[0].name;
      return lastName;
    }
    if (authors.length === 2) {
      const lastName1 = authors[0].name.split(' ').pop() || authors[0].name;
      const lastName2 = authors[1].name.split(' ').pop() || authors[1].name;
      return `${lastName1} & ${lastName2}`;
    }
    const lastName = authors[0].name.split(' ').pop() || authors[0].name;
    return `${lastName} et al.`;
  }
  
  // APA style
  return authors.map(a => {
    const parts = a.name.split(' ');
    const lastName = parts.pop() || '';
    const initials = parts.map(p => p[0] + '.').join(' ');
    return `${lastName}, ${initials}`.trim();
  }).join(', ');
}

