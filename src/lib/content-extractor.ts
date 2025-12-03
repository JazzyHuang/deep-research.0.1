/**
 * ContentExtractor - Intelligent content extraction from papers
 * Provides context-aware extraction for different Agent stages
 */

import type { Paper, PaperSection, SectionType, DataSourceName } from '@/types/paper';
import { DataAvailability } from '@/types/paper';
import { paperEnricher, getPaperSection, getPaperSections } from '@/lib/data-sources/enricher';

/**
 * Data extraction request specifying what data is needed
 */
export interface DataExtractionRequest {
  paperId: string;
  requiredLevel: DataAvailability;
  specificSections?: SectionType[];
  maxTokens?: number;
  includeMetadata?: boolean;
}

/**
 * Extracted content result
 */
export interface ExtractedContent {
  paperId: string;
  title: string;
  authors: string[];
  year: number;
  abstract?: string;
  sections?: ExtractedSection[];
  fullText?: string;
  metadata?: PaperMetadata;
  dataLevel: DataAvailability;
  truncated: boolean;
  tokenEstimate: number;
}

export interface ExtractedSection {
  type: SectionType;
  title: string;
  content: string;
  tokenEstimate: number;
}

export interface PaperMetadata {
  doi?: string;
  journal?: string;
  conference?: string;
  citations?: number;
  sourceUrl?: string;
  pdfUrl?: string;
}

/**
 * Agent stage definitions with their data requirements
 */
export type AgentStage = 
  | 'planning' 
  | 'searching' 
  | 'filtering' 
  | 'analyzing' 
  | 'writing' 
  | 'citing';

/**
 * Stage-specific data requirements
 */
export const STAGE_REQUIREMENTS: Record<AgentStage, {
  minLevel: DataAvailability;
  preferredSections: SectionType[];
  maxTokensPerPaper: number;
  includeAbstract: boolean;
  includeFullText: boolean;
}> = {
  planning: {
    minLevel: DataAvailability.METADATA_ONLY,
    preferredSections: [],
    maxTokensPerPaper: 100,
    includeAbstract: false,
    includeFullText: false,
  },
  searching: {
    minLevel: DataAvailability.WITH_ABSTRACT,
    preferredSections: ['abstract'],
    maxTokensPerPaper: 500,
    includeAbstract: true,
    includeFullText: false,
  },
  filtering: {
    minLevel: DataAvailability.WITH_ABSTRACT,
    preferredSections: ['abstract', 'introduction', 'conclusion'],
    maxTokensPerPaper: 1000,
    includeAbstract: true,
    includeFullText: false,
  },
  analyzing: {
    minLevel: DataAvailability.WITH_FULL_TEXT,
    preferredSections: ['methods', 'results', 'discussion'],
    maxTokensPerPaper: 4000,
    includeAbstract: true,
    includeFullText: true,
  },
  writing: {
    minLevel: DataAvailability.WITH_ABSTRACT,
    preferredSections: ['abstract', 'introduction', 'conclusion'],
    maxTokensPerPaper: 2000,
    includeAbstract: true,
    includeFullText: false,
  },
  citing: {
    minLevel: DataAvailability.WITH_ABSTRACT,
    preferredSections: ['abstract'],
    maxTokensPerPaper: 500,
    includeAbstract: true,
    includeFullText: false,
  },
};

// Rough estimate: 1 token ≈ 4 characters for English text
const CHARS_PER_TOKEN = 4;

/**
 * ContentExtractor class
 */
export class ContentExtractor {
  /**
   * Extract content from a paper based on requirements
   */
  async extractContent(
    paper: Paper,
    request: Partial<DataExtractionRequest>
  ): Promise<ExtractedContent> {
    const requiredLevel = request.requiredLevel || DataAvailability.WITH_ABSTRACT;
    const maxTokens = request.maxTokens || 2000;
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    
    let workingPaper = paper;
    
    // Try to enrich if we need higher data level
    if (paper.dataAvailability < requiredLevel) {
      const enrichResult = await paperEnricher.enrichPaper(paper, {
        targetLevel: requiredLevel,
      });
      workingPaper = enrichResult.paper;
    }
    
    const result: ExtractedContent = {
      paperId: workingPaper.id,
      title: workingPaper.title,
      authors: workingPaper.authors.map(a => a.name),
      year: workingPaper.year,
      dataLevel: workingPaper.dataAvailability,
      truncated: false,
      tokenEstimate: 0,
    };
    
    let usedChars = 0;
    const titleAndAuthors = `${workingPaper.title} by ${result.authors.join(', ')} (${workingPaper.year})`;
    usedChars += titleAndAuthors.length;
    
    // Include abstract if available and fits
    if (workingPaper.abstract && usedChars + workingPaper.abstract.length <= maxChars) {
      result.abstract = workingPaper.abstract;
      usedChars += workingPaper.abstract.length;
    } else if (workingPaper.abstract) {
      // Truncate abstract
      const availableChars = maxChars - usedChars;
      if (availableChars > 100) {
        result.abstract = workingPaper.abstract.slice(0, availableChars - 3) + '...';
        result.truncated = true;
        usedChars += result.abstract.length;
      }
    }
    
    // Extract specific sections if requested
    if (request.specificSections && request.specificSections.length > 0) {
      result.sections = [];
      
      for (const sectionType of request.specificSections) {
        if (usedChars >= maxChars) break;
        
        const section = getPaperSection(workingPaper, sectionType);
        if (section) {
          const availableChars = maxChars - usedChars;
          let content = section.content;
          
          if (content.length > availableChars) {
            content = content.slice(0, availableChars - 3) + '...';
            result.truncated = true;
          }
          
          result.sections.push({
            type: sectionType,
            title: section.title,
            content,
            tokenEstimate: Math.ceil(content.length / CHARS_PER_TOKEN),
          });
          
          usedChars += content.length;
        }
      }
    }
    
    // Include full text if requested and we have enough room
    if (requiredLevel >= DataAvailability.WITH_FULL_TEXT && workingPaper.fullText) {
      const availableChars = maxChars - usedChars;
      if (availableChars > 500) {
        if (workingPaper.fullText.length <= availableChars) {
          result.fullText = workingPaper.fullText;
        } else {
          result.fullText = workingPaper.fullText.slice(0, availableChars - 3) + '...';
          result.truncated = true;
        }
        usedChars += result.fullText.length;
      }
    }
    
    // Include metadata if requested
    if (request.includeMetadata) {
      result.metadata = {
        doi: workingPaper.doi,
        journal: workingPaper.journal,
        conference: workingPaper.conference,
        citations: workingPaper.citations,
        sourceUrl: workingPaper.sourceUrl,
        pdfUrl: workingPaper.pdfUrl,
      };
    }
    
    result.tokenEstimate = Math.ceil(usedChars / CHARS_PER_TOKEN);
    
    return result;
  }
  
  /**
   * Extract content from papers for a specific agent stage
   */
  async extractForStage(
    papers: Paper[],
    stage: AgentStage,
    options?: {
      totalMaxTokens?: number;
      priorityPaperIds?: string[];
    }
  ): Promise<ExtractedContent[]> {
    const stageReqs = STAGE_REQUIREMENTS[stage];
    const totalMaxTokens = options?.totalMaxTokens || 16000;
    const priorityIds = new Set(options?.priorityPaperIds || []);
    
    // Sort papers: priority papers first, then by data availability
    const sortedPapers = [...papers].sort((a, b) => {
      const aPriority = priorityIds.has(a.id) ? 1 : 0;
      const bPriority = priorityIds.has(b.id) ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      return (b.dataAvailability || 0) - (a.dataAvailability || 0);
    });
    
    const results: ExtractedContent[] = [];
    let totalUsedTokens = 0;
    
    for (const paper of sortedPapers) {
      // Check if we have budget for this paper
      const paperBudget = Math.min(
        stageReqs.maxTokensPerPaper,
        totalMaxTokens - totalUsedTokens
      );
      
      if (paperBudget < 100) break; // Not enough budget for meaningful content
      
      const content = await this.extractContent(paper, {
        requiredLevel: stageReqs.minLevel,
        specificSections: stageReqs.preferredSections,
        maxTokens: paperBudget,
        includeMetadata: stage === 'writing' || stage === 'citing',
      });
      
      results.push(content);
      totalUsedTokens += content.tokenEstimate;
      
      if (totalUsedTokens >= totalMaxTokens) break;
    }
    
    return results;
  }
  
  /**
   * Format extracted content as a string for LLM context
   */
  formatForContext(
    contents: ExtractedContent[],
    options?: {
      includeIndex?: boolean;
      format?: 'compact' | 'detailed';
    }
  ): string {
    const includeIndex = options?.includeIndex ?? true;
    const format = options?.format || 'compact';
    
    return contents.map((content, idx) => {
      const parts: string[] = [];
      
      // Header
      if (includeIndex) {
        parts.push(`[${idx + 1}] ${content.title}`);
      } else {
        parts.push(content.title);
      }
      
      parts.push(`Authors: ${content.authors.join(', ')} (${content.year})`);
      
      // Metadata in detailed format
      if (format === 'detailed' && content.metadata) {
        if (content.metadata.doi) parts.push(`DOI: ${content.metadata.doi}`);
        if (content.metadata.journal) parts.push(`Journal: ${content.metadata.journal}`);
        if (content.metadata.citations) parts.push(`Citations: ${content.metadata.citations}`);
      }
      
      // Abstract
      if (content.abstract) {
        parts.push(`\nAbstract: ${content.abstract}`);
      }
      
      // Sections
      if (content.sections && content.sections.length > 0) {
        for (const section of content.sections) {
          parts.push(`\n${section.title}:\n${section.content}`);
        }
      }
      
      // Full text (if no sections)
      if (content.fullText && (!content.sections || content.sections.length === 0)) {
        parts.push(`\nFull Text:\n${content.fullText}`);
      }
      
      return parts.join('\n');
    }).join('\n\n---\n\n');
  }
  
  /**
   * Get a summary of available data for papers
   */
  getDataSummary(papers: Paper[]): {
    total: number;
    byLevel: Record<DataAvailability, number>;
    withFullText: number;
    withPdfUrl: number;
    withAbstract: number;
  } {
    const summary = {
      total: papers.length,
      byLevel: {
        [DataAvailability.METADATA_ONLY]: 0,
        [DataAvailability.WITH_ABSTRACT]: 0,
        [DataAvailability.WITH_PDF_LINK]: 0,
        [DataAvailability.WITH_FULL_TEXT]: 0,
      },
      withFullText: 0,
      withPdfUrl: 0,
      withAbstract: 0,
    };
    
    for (const paper of papers) {
      const level = paper.dataAvailability || DataAvailability.METADATA_ONLY;
      summary.byLevel[level]++;
      
      if (paper.fullText) summary.withFullText++;
      if (paper.pdfUrl) summary.withPdfUrl++;
      if (paper.abstract && paper.abstract.length > 10) summary.withAbstract++;
    }
    
    return summary;
  }
}

// Export singleton
export const contentExtractor = new ContentExtractor();

/**
 * Convenience function: Extract content for a specific stage
 */
export async function extractForStage(
  papers: Paper[],
  stage: AgentStage,
  options?: { totalMaxTokens?: number; priorityPaperIds?: string[] }
): Promise<ExtractedContent[]> {
  return contentExtractor.extractForStage(papers, stage, options);
}

/**
 * Convenience function: Format papers for LLM context
 */
export async function formatPapersForContext(
  papers: Paper[],
  stage: AgentStage,
  maxTokens?: number
): Promise<string> {
  const contents = await contentExtractor.extractForStage(papers, stage, {
    totalMaxTokens: maxTokens,
  });
  return contentExtractor.formatForContext(contents);
}

/**
 * Convenience function: Get specific section from paper
 */
export function extractSection(
  paper: Paper,
  sectionType: SectionType
): string | null {
  const section = getPaperSection(paper, sectionType);
  return section?.content || null;
}

/**
 * Convenience function: Get multiple sections as formatted text
 */
export function extractSections(
  paper: Paper,
  sectionTypes: SectionType[]
): string {
  const sections = getPaperSections(paper, sectionTypes);
  return sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n');
}

