/**
 * Verifiable Checklist Module
 * 
 * Based on RhinoInsight framework (arxiv:2511.18743)
 * Transforms user requirements into trackable, verifiable sub-goals
 * that anchor subsequent research actions and prevent unexecutable plans.
 */

import { generateObject } from 'ai';
import { z } from 'zod';
import type { ResearchPlan } from '@/types/research';
import type { Paper } from '@/types/paper';
import { openrouter, MODELS } from '@/lib/models';

// ============================================
// Types
// ============================================

/**
 * Verification status for a checklist item
 */
export type VerificationStatus = 'pending' | 'in_progress' | 'verified' | 'partially_verified' | 'failed' | 'not_applicable';

/**
 * Evidence supporting a checklist item
 */
export interface ChecklistEvidence {
  paperId: string;
  paperTitle: string;
  excerpt: string;
  relevanceScore: number;  // 0-100
  addedAt: number;
}

/**
 * A single verifiable checklist item
 */
export interface ChecklistItem {
  id: string;
  requirement: string;           // User requirement transformed into verifiable statement
  verificationCriteria: string;  // How to verify this requirement is met
  priority: 'high' | 'medium' | 'low';
  category: 'coverage' | 'depth' | 'accuracy' | 'completeness';
  status: VerificationStatus;
  evidence: ChecklistEvidence[];
  sourceIds: string[];           // Paper IDs supporting this item
  verificationNotes?: string;    // Notes from verification process
  parentId?: string;             // For hierarchical checklists
  children?: string[];           // Child item IDs
  createdAt: number;
  updatedAt: number;
}

/**
 * Complete verifiable checklist for a research session
 */
export interface VerifiableChecklist {
  id: string;
  sessionId: string;
  items: ChecklistItem[];
  totalItems: number;
  verifiedCount: number;
  failedCount: number;
  pendingCount: number;
  overallProgress: number;  // 0-100
  createdAt: number;
  updatedAt: number;
}

/**
 * Result of checklist verification
 */
export interface ChecklistVerificationResult {
  itemId: string;
  previousStatus: VerificationStatus;
  newStatus: VerificationStatus;
  evidenceAdded: ChecklistEvidence[];
  confidence: number;  // 0-100
  reasoning: string;
}

// ============================================
// Schemas
// ============================================

const ChecklistItemSchema = z.object({
  requirement: z.string().describe('A clear, verifiable requirement statement'),
  verificationCriteria: z.string().describe('Specific criteria to verify this requirement is met'),
  priority: z.enum(['high', 'medium', 'low']).describe('Priority level'),
  category: z.enum(['coverage', 'depth', 'accuracy', 'completeness']).describe('Category of requirement'),
});

const ChecklistGenerationSchema = z.object({
  items: z.array(ChecklistItemSchema).describe('List of verifiable checklist items'),
  reasoning: z.string().describe('Explanation of how the checklist was constructed'),
});

const VerificationResultSchema = z.object({
  isVerified: z.boolean().describe('Whether the requirement is verified'),
  confidence: z.number().min(0).max(100).describe('Confidence level in verification'),
  status: z.enum(['verified', 'partially_verified', 'failed', 'not_applicable']).describe('Verification status'),
  reasoning: z.string().describe('Reasoning for the verification result'),
  relevantExcerpts: z.array(z.object({
    paperId: z.string(),
    excerpt: z.string(),
    relevanceScore: z.number().min(0).max(100),
  })).describe('Relevant excerpts from papers supporting verification'),
});

// ============================================
// Core Functions
// ============================================

/**
 * Generate a unique ID for checklist items
 */
function generateChecklistId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Build a verifiable checklist from a research plan
 * Called after Phase 1 (Planning) to anchor subsequent actions
 */
export async function buildVerifiableChecklist(
  plan: ResearchPlan,
  userQuery: string,
  sessionId: string,
): Promise<VerifiableChecklist> {
  const now = Date.now();
  
  let generatedItems: Array<{
    requirement: string;
    verificationCriteria: string;
    priority: 'high' | 'medium' | 'low';
    category: 'coverage' | 'depth' | 'accuracy' | 'completeness';
  }> = [];
  
  try {
    const { object } = await generateObject({
      model: openrouter(MODELS.WRITER),
      schema: ChecklistGenerationSchema,
      prompt: `You are an expert research methodology specialist. Create a verifiable checklist that transforms the user's research question and plan into trackable, verifiable requirements.

USER'S RESEARCH QUESTION:
${userQuery}

RESEARCH PLAN:
Main Question: ${plan.mainQuestion}

Sub-Questions to Address:
${plan.subQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Expected Sections: ${plan.expectedSections.join(', ')}

Search Strategies: ${plan.searchStrategies.map(s => s.query).join('; ')}

TASK:
Create a comprehensive checklist of verifiable requirements that:
1. Transforms each sub-question into a verifiable requirement
2. Adds requirements for completeness (all sections covered)
3. Adds requirements for accuracy (claims must be supported by evidence)
4. Adds requirements for depth (sufficient analysis, not just summarization)
5. Prioritizes requirements by importance to answering the main question

For each requirement:
- Write it as a clear, verifiable statement (not a question)
- Define specific criteria that can be checked
- Assign appropriate priority and category

Generate 8-15 checklist items that comprehensively cover the research needs.`,
    });
    generatedItems = object.items;
  } catch (error) {
    console.error('[VerifiableChecklist] Failed to generate checklist:', error);
    // Create minimal fallback checklist from sub-questions
    generatedItems = plan.subQuestions.slice(0, 5).map((q, i) => ({
      requirement: `Address sub-question: ${q}`,
      verificationCriteria: `Report must contain analysis addressing: ${q}`,
      priority: (i === 0 ? 'high' : 'medium') as 'high' | 'medium' | 'low',
      category: 'coverage' as const,
    }));
  }
  
  // Transform generated items into full ChecklistItems
  const items: ChecklistItem[] = generatedItems.map((item, index) => ({
    id: generateChecklistId('chk'),
    requirement: item.requirement,
    verificationCriteria: item.verificationCriteria,
    priority: item.priority,
    category: item.category,
    status: 'pending' as VerificationStatus,
    evidence: [],
    sourceIds: [],
    createdAt: now,
    updatedAt: now,
  }));

  // Add core checklist items that are always required
  const coreItems: ChecklistItem[] = [
    {
      id: generateChecklistId('chk-core'),
      requirement: 'All claims in the report are supported by cited sources',
      verificationCriteria: 'Every factual claim has at least one citation from the collected papers',
      priority: 'high',
      category: 'accuracy',
      status: 'pending',
      evidence: [],
      sourceIds: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateChecklistId('chk-core'),
      requirement: 'The main research question is directly addressed in the conclusion',
      verificationCriteria: 'The conclusion section explicitly answers the main research question',
      priority: 'high',
      category: 'completeness',
      status: 'pending',
      evidence: [],
      sourceIds: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: generateChecklistId('chk-core'),
      requirement: 'Sources are recent and relevant (majority from last 5 years)',
      verificationCriteria: 'At least 60% of citations are from papers published within the last 5 years',
      priority: 'medium',
      category: 'accuracy',
      status: 'pending',
      evidence: [],
      sourceIds: [],
      createdAt: now,
      updatedAt: now,
    },
  ];

  const allItems = [...items, ...coreItems];

  return {
    id: generateChecklistId('checklist'),
    sessionId,
    items: allItems,
    totalItems: allItems.length,
    verifiedCount: 0,
    failedCount: 0,
    pendingCount: allItems.length,
    overallProgress: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Verify a single checklist item against the report content and papers
 */
export async function verifyChecklistItem(
  item: ChecklistItem,
  reportContent: string,
  papers: Paper[],
): Promise<ChecklistVerificationResult> {
  // Create paper context for verification
  const paperContext = papers.slice(0, 20).map(p => ({
    id: p.id,
    title: p.title,
    year: p.year,
    abstract: p.abstract?.slice(0, 300) || 'No abstract',
  }));

  const { object } = await generateObject({
    model: openrouter(MODELS.LIGHTWEIGHT),
    schema: VerificationResultSchema,
    prompt: `You are verifying whether a research report meets a specific requirement.

REQUIREMENT:
${item.requirement}

VERIFICATION CRITERIA:
${item.verificationCriteria}

REPORT CONTENT (excerpt):
${reportContent.slice(0, 8000)}

AVAILABLE SOURCES:
${paperContext.map(p => `[${p.id}] ${p.title} (${p.year})`).join('\n')}

TASK:
1. Check if the report content satisfies the requirement
2. Find specific excerpts from the report that demonstrate compliance
3. Identify which sources support the verification
4. Assign a confidence level to your verification

Be thorough but fair. Partial verification is acceptable if some but not all criteria are met.`,
  });

  const evidenceAdded: ChecklistEvidence[] = object.relevantExcerpts.map(e => ({
    paperId: e.paperId,
    paperTitle: papers.find(p => p.id === e.paperId)?.title || 'Unknown',
    excerpt: e.excerpt,
    relevanceScore: e.relevanceScore,
    addedAt: Date.now(),
  }));

  return {
    itemId: item.id,
    previousStatus: item.status,
    newStatus: object.status,
    evidenceAdded,
    confidence: object.confidence,
    reasoning: object.reasoning,
  };
}

/**
 * Verify all pending items in a checklist
 */
export async function verifyChecklist(
  checklist: VerifiableChecklist,
  reportContent: string,
  papers: Paper[],
): Promise<{
  checklist: VerifiableChecklist;
  results: ChecklistVerificationResult[];
}> {
  const pendingItems = checklist.items.filter(
    item => item.status === 'pending' || item.status === 'in_progress'
  );

  const results: ChecklistVerificationResult[] = [];

  // Process items in batches for efficiency
  for (const item of pendingItems) {
    try {
      const result = await verifyChecklistItem(item, reportContent, papers);
      results.push(result);

      // Update the item in the checklist
      const itemIndex = checklist.items.findIndex(i => i.id === item.id);
      if (itemIndex !== -1) {
        checklist.items[itemIndex] = {
          ...checklist.items[itemIndex],
          status: result.newStatus,
          evidence: [...checklist.items[itemIndex].evidence, ...result.evidenceAdded],
          sourceIds: [...new Set([
            ...checklist.items[itemIndex].sourceIds,
            ...result.evidenceAdded.map(e => e.paperId),
          ])],
          verificationNotes: result.reasoning,
          updatedAt: Date.now(),
        };
      }
    } catch (error) {
      console.error(`Failed to verify checklist item ${item.id}:`, error);
      // Mark as failed on error
      const itemIndex = checklist.items.findIndex(i => i.id === item.id);
      if (itemIndex !== -1) {
        checklist.items[itemIndex].status = 'failed';
        checklist.items[itemIndex].verificationNotes = 
          `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
  }

  // Update checklist statistics
  const stats = calculateChecklistStats(checklist.items);
  
  return {
    checklist: {
      ...checklist,
      ...stats,
      updatedAt: Date.now(),
    },
    results,
  };
}

/**
 * Calculate statistics for a checklist
 */
export function calculateChecklistStats(items: ChecklistItem[]): {
  verifiedCount: number;
  failedCount: number;
  pendingCount: number;
  overallProgress: number;
} {
  const verifiedCount = items.filter(
    i => i.status === 'verified' || i.status === 'partially_verified'
  ).length;
  const failedCount = items.filter(i => i.status === 'failed').length;
  const pendingCount = items.filter(
    i => i.status === 'pending' || i.status === 'in_progress'
  ).length;
  
  // Calculate progress: verified = 100%, partially = 50%, failed/pending = 0%
  const totalWeight = items.length;
  const verifiedWeight = items.filter(i => i.status === 'verified').length;
  const partialWeight = items.filter(i => i.status === 'partially_verified').length * 0.5;
  
  const overallProgress = totalWeight > 0 
    ? Math.round(((verifiedWeight + partialWeight) / totalWeight) * 100)
    : 0;

  return {
    verifiedCount,
    failedCount,
    pendingCount,
    overallProgress,
  };
}

/**
 * Get unverified high-priority items that need attention
 */
export function getUnverifiedHighPriority(checklist: VerifiableChecklist): ChecklistItem[] {
  return checklist.items.filter(
    item => item.priority === 'high' && 
    (item.status === 'pending' || item.status === 'failed')
  );
}

/**
 * Generate feedback for improving the report based on checklist status
 */
export async function generateChecklistFeedback(
  checklist: VerifiableChecklist,
): Promise<{
  summary: string;
  criticalGaps: string[];
  suggestions: string[];
  readyForFinalization: boolean;
}> {
  const unverifiedHigh = getUnverifiedHighPriority(checklist);
  const failedItems = checklist.items.filter(i => i.status === 'failed');
  const partialItems = checklist.items.filter(i => i.status === 'partially_verified');

  const criticalGaps = unverifiedHigh.map(item => item.requirement);
  
  const suggestions: string[] = [];
  
  if (failedItems.length > 0) {
    suggestions.push(
      `Address ${failedItems.length} failed requirements: ${failedItems.map(i => i.requirement).join('; ')}`
    );
  }
  
  if (partialItems.length > 0) {
    suggestions.push(
      `Strengthen ${partialItems.length} partially verified requirements for full compliance`
    );
  }

  // Ready for finalization if no high-priority items are unverified/failed
  const readyForFinalization = unverifiedHigh.length === 0 && 
    checklist.overallProgress >= 70;

  const summary = `Checklist Progress: ${checklist.overallProgress}% (${checklist.verifiedCount}/${checklist.totalItems} verified). ` +
    `${criticalGaps.length} critical gaps, ${failedItems.length} failed, ${partialItems.length} partial.`;

  return {
    summary,
    criticalGaps,
    suggestions,
    readyForFinalization,
  };
}

/**
 * Update checklist item status manually
 */
export function updateChecklistItemStatus(
  checklist: VerifiableChecklist,
  itemId: string,
  status: VerificationStatus,
  notes?: string,
): VerifiableChecklist {
  const itemIndex = checklist.items.findIndex(i => i.id === itemId);
  if (itemIndex === -1) return checklist;

  checklist.items[itemIndex] = {
    ...checklist.items[itemIndex],
    status,
    verificationNotes: notes || checklist.items[itemIndex].verificationNotes,
    updatedAt: Date.now(),
  };

  const stats = calculateChecklistStats(checklist.items);
  
  return {
    ...checklist,
    ...stats,
    updatedAt: Date.now(),
  };
}

/**
 * Add evidence to a checklist item
 */
export function addEvidenceToItem(
  checklist: VerifiableChecklist,
  itemId: string,
  evidence: ChecklistEvidence,
): VerifiableChecklist {
  const itemIndex = checklist.items.findIndex(i => i.id === itemId);
  if (itemIndex === -1) return checklist;

  checklist.items[itemIndex] = {
    ...checklist.items[itemIndex],
    evidence: [...checklist.items[itemIndex].evidence, evidence],
    sourceIds: [...new Set([...checklist.items[itemIndex].sourceIds, evidence.paperId])],
    updatedAt: Date.now(),
  };

  return {
    ...checklist,
    updatedAt: Date.now(),
  };
}

/**
 * Serialize checklist for storage/transmission
 */
export function serializeChecklist(checklist: VerifiableChecklist): string {
  return JSON.stringify(checklist);
}

/**
 * Deserialize checklist from storage
 */
export function deserializeChecklist(data: string): VerifiableChecklist {
  return JSON.parse(data);
}

