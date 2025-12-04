/**
 * Report-related types for Deep Research
 */

import type { QualityMetrics } from './quality';

/**
 * Citation in a research report
 */
export interface Citation {
  id: string;
  paperId: string;
  title: string;
  authors: string[];
  year: number;
  doi?: string;
  url?: string;
  inTextRef: string; // e.g., "[1]" or "(Smith et al., 2023)"
  // Extended citation metadata
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  conference?: string;
}

/**
 * Section of a research report
 */
export interface ReportSection {
  heading: string;
  content: string;
  level: number; // 1, 2, or 3 for h1, h2, h3
}

/**
 * Complete research report
 */
export interface ResearchReport {
  title: string;
  abstract: string;
  sections: ReportSection[];
  citations: Citation[];
  generatedAt: Date;
  qualityMetrics?: QualityMetrics;
  iterationCount?: number;
}

/**
 * Research plan structure
 */
export interface ResearchPlan {
  mainQuestion: string;
  subQuestions: string[];
  searchStrategies: Array<{
    query: string;
    filters?: {
      yearFrom?: number;
      yearTo?: number;
      openAccess?: boolean;
    };
  }>;
  expectedSections: string[];
}




