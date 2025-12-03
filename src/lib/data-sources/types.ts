import type { Paper, Author, DataSourceName as PaperDataSourceName } from '@/types/paper';
import { DataAvailability, calculateDataAvailability } from '@/types/paper';

export interface DataSourceConfig {
  enabled: boolean;
  apiKey?: string;
  rateLimit?: number; // requests per second
  timeout?: number; // ms
}

export interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  yearFrom?: number;
  yearTo?: number;
  openAccess?: boolean;
  fields?: string[];
  sortBy?: 'relevance' | 'citations' | 'date';
}

export interface SearchResult {
  papers: Paper[];
  totalHits: number;
  source: DataSourceName;
  nextCursor?: string;
}

export type DataSourceName = 'core' | 'semantic-scholar' | 'openalex' | 'arxiv' | 'pubmed';

export interface DataSource {
  name: DataSourceName;
  search(options: SearchOptions): Promise<SearchResult>;
  getPaper(id: string): Promise<Paper | null>;
  isAvailable(): Promise<boolean>;
}

export interface AggregatedSearchResult {
  papers: Paper[];
  totalHits: number;
  sourceBreakdown: Record<DataSourceName, number>;
  dedupedCount: number;
}

// Semantic Scholar types
export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract?: string;
  year?: number;
  citationCount?: number;
  referenceCount?: number;
  authors?: SemanticScholarAuthor[];
  externalIds?: {
    DOI?: string;
    ArXiv?: string;
    PubMed?: string;
    DBLP?: string;
  };
  url?: string;
  venue?: string;
  publicationVenue?: {
    name?: string;
    type?: string;
    issn?: string;
  };
  openAccessPdf?: {
    url?: string;
  };
  fieldsOfStudy?: string[];
  publicationDate?: string;
  isOpenAccess?: boolean;
  // Extended publication metadata
  journal?: {
    name?: string;
    volume?: string;
    pages?: string;
  };
  publicationTypes?: string[];
}

export interface SemanticScholarAuthor {
  authorId?: string;
  name: string;
  affiliations?: string[];
}

export interface SemanticScholarResponse {
  total: number;
  offset: number;
  next?: number;
  data: SemanticScholarPaper[];
}

// OpenAlex types
export interface OpenAlexWork {
  id: string;
  doi?: string;
  title?: string;
  display_name?: string;
  publication_year?: number;
  publication_date?: string;
  cited_by_count?: number;
  authorships?: OpenAlexAuthorship[];
  primary_location?: {
    source?: {
      display_name?: string;
      issn_l?: string;
      issn?: string[];
      type?: string;
      host_organization_name?: string;
    };
    pdf_url?: string;
    landing_page_url?: string;
  };
  open_access?: {
    is_oa?: boolean;
    oa_url?: string;
  };
  abstract_inverted_index?: Record<string, number[]>;
  concepts?: OpenAlexConcept[];
  referenced_works?: string[];
  // Extended metadata
  biblio?: {
    volume?: string;
    issue?: string;
    first_page?: string;
    last_page?: string;
  };
  type?: string; // article, book-chapter, conference-paper, etc.
}

export interface OpenAlexAuthorship {
  author?: {
    id?: string;
    display_name?: string;
    orcid?: string;
  };
  institutions?: {
    display_name?: string;
  }[];
}

export interface OpenAlexConcept {
  display_name?: string;
  level?: number;
}

export interface OpenAlexResponse {
  meta: {
    count: number;
    page: number;
    per_page: number;
  };
  results: OpenAlexWork[];
}

// arXiv types
export interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  published: string;
  updated: string;
  authors: { name: string }[];
  categories: string[];
  links: { href: string; type?: string; title?: string }[];
  doi?: string;
}

export interface ArxivResponse {
  feed: {
    entry: ArxivEntry | ArxivEntry[];
    'opensearch:totalResults': string;
    'opensearch:startIndex': string;
  };
}

// PubMed types
export interface PubMedArticle {
  uid: string;
  title?: string;
  sortpubdate?: string;
  authors?: { name: string; authtype?: string }[];
  source?: string;
  fulljournalname?: string;
  elocationid?: string;
  pubdate?: string;
  epubdate?: string;
  abstract?: string;
  // Extended metadata
  volume?: string;
  issue?: string;
  pages?: string;
  issn?: string;
  essn?: string;
}

export interface PubMedSearchResponse {
  header: { type: string };
  esearchresult: {
    count: string;
    retmax: string;
    retstart: string;
    idlist: string[];
  };
}

export interface PubMedSummaryResponse {
  result: {
    uids: string[];
    [uid: string]: PubMedArticle | string[];
  };
}

// Helper to convert various sources to Paper type
export function semanticScholarToPaper(paper: SemanticScholarPaper): Paper {
  // Parse pages if available
  let pages: string | undefined;
  if (paper.journal?.pages) {
    pages = paper.journal.pages;
  }
  
  // Detect if conference paper
  const isConference = paper.publicationTypes?.includes('Conference') || 
                       paper.publicationVenue?.type === 'conference';
  
  const pdfUrl = paper.openAccessPdf?.url;
  const abstract = paper.abstract || '';
  
  return {
    id: `s2-${paper.paperId}`,
    title: paper.title || 'Untitled',
    authors: (paper.authors || []).map(a => ({
      name: a.name,
      affiliations: a.affiliations,
    })),
    abstract,
    year: paper.year || new Date().getFullYear(),
    publishedDate: paper.publicationDate,
    doi: paper.externalIds?.DOI,
    downloadUrl: pdfUrl,
    sourceUrl: paper.url,
    journal: isConference ? undefined : (paper.journal?.name || paper.venue || paper.publicationVenue?.name),
    conference: isConference ? (paper.venue || paper.publicationVenue?.name) : undefined,
    volume: paper.journal?.volume,
    pages,
    issn: paper.publicationVenue?.issn,
    subjects: paper.fieldsOfStudy,
    citations: paper.citationCount,
    openAccess: paper.isOpenAccess || !!pdfUrl,
    // New fields for data tracking
    dataAvailability: calculateDataAvailability({
      abstract,
      downloadUrl: pdfUrl,
      pdfUrl,
    }),
    sourceOrigin: ['semantic-scholar'],
    pdfUrl,
  };
}

export function openAlexToPaper(work: OpenAlexWork): Paper {
  // Reconstruct abstract from inverted index
  let abstract = '';
  if (work.abstract_inverted_index) {
    const words: [string, number][] = [];
    for (const [word, positions] of Object.entries(work.abstract_inverted_index)) {
      for (const pos of positions) {
        words.push([word, pos]);
      }
    }
    words.sort((a, b) => a[1] - b[1]);
    abstract = words.map(w => w[0]).join(' ');
  }

  const doi = work.doi?.replace('https://doi.org/', '');
  
  // Determine if conference paper
  const isConference = work.type === 'proceedings-article' || 
                       work.primary_location?.source?.type === 'conference';
  
  // Format pages
  let pages: string | undefined;
  if (work.biblio?.first_page) {
    pages = work.biblio.last_page 
      ? `${work.biblio.first_page}-${work.biblio.last_page}`
      : work.biblio.first_page;
  }

  const pdfUrl = work.primary_location?.pdf_url;
  const downloadUrl = work.open_access?.oa_url || pdfUrl;

  return {
    id: `oa-${work.id.split('/').pop()}`,
    title: work.display_name || work.title || 'Untitled',
    authors: (work.authorships || []).map(a => ({
      name: a.author?.display_name || 'Unknown',
      affiliations: a.institutions?.map(i => i.display_name || '').filter(Boolean),
      orcid: a.author?.orcid,
    })),
    abstract,
    year: work.publication_year || new Date().getFullYear(),
    publishedDate: work.publication_date,
    doi,
    downloadUrl,
    sourceUrl: work.primary_location?.landing_page_url,
    journal: isConference ? undefined : work.primary_location?.source?.display_name,
    conference: isConference ? work.primary_location?.source?.display_name : undefined,
    publisher: work.primary_location?.source?.host_organization_name,
    volume: work.biblio?.volume,
    issue: work.biblio?.issue,
    pages,
    issn: work.primary_location?.source?.issn_l,
    subjects: work.concepts?.filter(c => c.level === 0).map(c => c.display_name || '').filter(Boolean),
    citations: work.cited_by_count,
    references: work.referenced_works,
    openAccess: work.open_access?.is_oa || false,
    // New fields for data tracking
    dataAvailability: calculateDataAvailability({
      abstract,
      downloadUrl,
      pdfUrl,
    }),
    sourceOrigin: ['openalex'],
    pdfUrl,
  };
}

export function arxivToPaper(entry: ArxivEntry): Paper {
  const arxivId = entry.id.split('/abs/').pop()?.split('v')[0] || entry.id;
  const pdfLink = entry.links.find(l => l.type === 'application/pdf')?.href;
  const absLink = entry.links.find(l => l.title === 'Abstract')?.href || entry.id;
  const abstract = entry.summary.replace(/\n/g, ' ').trim();

  return {
    id: `arxiv-${arxivId}`,
    title: entry.title.replace(/\n/g, ' ').trim(),
    authors: entry.authors.map(a => ({ name: a.name })),
    abstract,
    year: new Date(entry.published).getFullYear(),
    publishedDate: entry.published,
    doi: entry.doi,
    downloadUrl: pdfLink,
    sourceUrl: absLink,
    subjects: entry.categories,
    openAccess: true, // arXiv is always open access
    // New fields for data tracking
    // arXiv always has PDF available
    dataAvailability: DataAvailability.WITH_PDF_LINK,
    sourceOrigin: ['arxiv'],
    pdfUrl: pdfLink,
  };
}

export function pubmedToPaper(article: PubMedArticle): Paper {
  const doi = article.elocationid?.replace('doi: ', '');
  const abstract = article.abstract || '';
  
  return {
    id: `pubmed-${article.uid}`,
    title: article.title || 'Untitled',
    authors: (article.authors || []).map(a => ({ name: a.name })),
    abstract,
    year: article.sortpubdate ? parseInt(article.sortpubdate.split('/')[0]) : new Date().getFullYear(),
    publishedDate: article.pubdate || article.epubdate,
    doi,
    sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`,
    journal: article.fulljournalname || article.source,
    volume: article.volume,
    issue: article.issue,
    pages: article.pages,
    issn: article.issn || article.essn,
    openAccess: false, // PubMed doesn't indicate this directly
    // New fields for data tracking
    // PubMed typically only provides metadata and abstract
    dataAvailability: calculateDataAvailability({ abstract }),
    sourceOrigin: ['pubmed'],
  };
}

