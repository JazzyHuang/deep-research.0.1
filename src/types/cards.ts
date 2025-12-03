/**
 * Interactive Card Types for Human-AI Collaboration
 */

import type { Paper } from './paper';
import type { ResearchPlan, QualityMetrics, CriticAnalysis, Citation } from './research';

// Card types
export type CardType = 
  | 'plan'           // Research plan card
  | 'paper_list'     // Paper list card
  | 'search_result'  // Search result card
  | 'document'       // Document/report card
  | 'quality'        // Quality assessment card
  | 'citation_list'; // Citation list card

// Card status
export type CardStatus = 
  | 'pending'    // Awaiting user action
  | 'approved'   // User approved
  | 'modified'   // User made modifications
  | 'rejected';  // User rejected

// Base card interface
export interface InteractiveCard {
  id: string;
  type: CardType;
  title: string;
  icon?: string;
  status: CardStatus;
  isCollapsed: boolean;
  isCheckpoint: boolean;    // Whether this card is a checkpoint
  checkpointId?: string;    // Associated checkpoint ID
  createdAt: number;
  updatedAt?: number;
  
  // Type-specific data
  data: CardData;
  
  // Actions shown at card footer (for checkpoints)
  actions?: CardAction[];
}

// Card action button
export interface CardAction {
  id: string;
  label: string;
  description?: string;
  variant: 'primary' | 'secondary' | 'outline' | 'destructive';
  action: string;
  disabled?: boolean;
}

// Union type for card data
export type CardData = 
  | PlanCardData
  | PaperListCardData
  | SearchResultCardData
  | DocumentCardData
  | QualityCardData
  | CitationListCardData;

// Research plan card data
export interface PlanCardData {
  type: 'plan';
  plan: ResearchPlan;
  summary: {
    subQuestionsCount: number;
    searchStrategiesCount: number;
    expectedSectionsCount: number;
  };
}

// Paper list card data
export interface PaperListCardData {
  type: 'paper_list';
  papers: Paper[];
  totalFound: number;
  displayCount: number;
  roundNumber?: number;
  query?: string;
  selectedPaperIds?: string[];  // Papers selected by user
  excludedPaperIds?: string[];  // Papers excluded by user
}

// Search result card data
export interface SearchResultCardData {
  type: 'search_result';
  query: string;
  filters?: {
    yearFrom?: number;
    yearTo?: number;
    openAccess?: boolean;
  };
  resultsCount: number;
  roundNumber: number;
}

// Document card data (report/outline)
export interface DocumentCardData {
  type: 'document';
  title: string;
  content: string;           // Markdown content
  version: number;
  wordCount: number;
  citationCount: number;
  qualityScore?: number;
  sections?: DocumentSection[];
}

export interface DocumentSection {
  id: string;
  heading: string;
  level: number;
  startIndex: number;
  endIndex: number;
}

// Quality assessment card data
export interface QualityCardData {
  type: 'quality';
  metrics: QualityMetrics;
  analysis: CriticAnalysis;
  iteration: number;
  recommendation: 'pass' | 'iterate' | 'fail';
  improvements: string[];
}

// Citation list card data
export interface CitationListCardData {
  type: 'citation_list';
  citations: Citation[];
  style: string;
}

// Side panel content types (for editing)
export type SidePanelContent = 
  | { type: 'plan_editor'; cardId: string; data: PlanCardData }
  | { type: 'paper_selector'; cardId: string; data: PaperListCardData }
  | { type: 'document_editor'; cardId: string; data: DocumentCardData }
  | { type: 'quality_viewer'; cardId: string; data: QualityCardData }
  | { type: 'search_viewer'; cardId: string; data: SearchResultCardData };

// Helper function to create a card
export function createCard(
  type: CardType,
  title: string,
  data: CardData,
  options?: Partial<InteractiveCard>
): InteractiveCard {
  return {
    id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title,
    status: 'pending',
    isCollapsed: false,
    isCheckpoint: false,
    createdAt: Date.now(),
    data,
    ...options,
  };
}

// Helper to create checkpoint card actions
export function createCheckpointActions(type: CardType): CardAction[] {
  switch (type) {
    case 'plan':
      return [
        { id: 'continue', label: '继续研究', variant: 'primary', action: 'approve' },
        { id: 'adjust', label: '我有调整...', variant: 'outline', action: 'edit' },
      ];
    case 'quality':
      return [
        { id: 'accept', label: '接受建议，继续', variant: 'primary', action: 'iterate' },
        { id: 'enough', label: '已经足够', variant: 'secondary', action: 'approve' },
        { id: 'specify', label: '指定方向...', variant: 'outline', action: 'edit' },
      ];
    case 'document':
      return [
        { id: 'satisfied', label: '满意，完成', variant: 'primary', action: 'approve' },
        { id: 'optimize', label: '继续优化', variant: 'secondary', action: 'iterate' },
        { id: 'modify', label: '我有修改...', variant: 'outline', action: 'edit' },
      ];
    default:
      return [
        { id: 'continue', label: '继续', variant: 'primary', action: 'approve' },
      ];
  }
}







