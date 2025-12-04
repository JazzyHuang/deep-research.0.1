/**
 * Multimodal Processing Module
 * 
 * Handles PDF parsing, figure extraction, and image analysis
 * for enhanced paper understanding.
 */

import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { openrouter, MODELS } from '@/lib/models';

// ============================================
// Types
// ============================================

/**
 * Extracted figure from a PDF
 */
export interface ExtractedFigure {
  id: string;
  pageNumber: number;
  caption: string;
  description: string;
  type: 'chart' | 'diagram' | 'photograph' | 'illustration' | 'table' | 'other';
  relevanceToQuery?: number;  // 0-100
}

/**
 * Extracted table from a PDF
 */
export interface ExtractedTable {
  id: string;
  pageNumber: number;
  caption: string;
  headers: string[];
  data: string[][];
  summary: string;
}

/**
 * Parsed PDF content
 */
export interface ParsedPdfContent {
  text: string;
  wordCount: number;
  pageCount: number;
  figures: ExtractedFigure[];
  tables: ExtractedTable[];
  sections: Array<{
    title: string;
    content: string;
    level: number;
  }>;
  metadata: {
    title?: string;
    authors?: string[];
    abstract?: string;
    keywords?: string[];
  };
  extractedAt: number;
}

/**
 * Figure analysis result
 */
export interface FigureAnalysis {
  description: string;
  keyFindings: string[];
  dataType?: 'quantitative' | 'qualitative' | 'mixed';
  confidence: number;
}

/**
 * Image analysis result
 */
export interface ImageAnalysis {
  description: string;
  type: 'chart' | 'diagram' | 'photograph' | 'table' | 'text' | 'other';
  elements: string[];
  insights: string[];
}

// ============================================
// Schemas
// ============================================

const ImageAnalysisSchema = z.object({
  description: z.string().describe('Detailed description of the image content'),
  type: z.enum(['chart', 'diagram', 'photograph', 'table', 'text', 'other']).describe('Type of visual content'),
  elements: z.array(z.string()).describe('Key visual elements identified'),
  insights: z.array(z.string()).describe('Scientific insights or findings from the image'),
});

const FigureAnalysisSchema = z.object({
  description: z.string().describe('Description of what the figure shows'),
  keyFindings: z.array(z.string()).describe('Key findings or data points from the figure'),
  dataType: z.enum(['quantitative', 'qualitative', 'mixed']).optional().describe('Type of data presented'),
  confidence: z.number().min(0).max(100).describe('Confidence in the analysis'),
});

const SectionExtractionSchema = z.object({
  sections: z.array(z.object({
    title: z.string(),
    level: z.number().min(1).max(4),
    summary: z.string(),
  })).describe('Extracted document sections'),
});

// ============================================
// Core Functions
// ============================================

/**
 * Generate a unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Analyze an image using Gemini's vision capabilities
 */
export async function analyzeImage(
  imageUrl: string,
  context?: string,
): Promise<ImageAnalysis> {
  try {
    const { object } = await generateObject({
      model: openrouter(MODELS.WRITER), // Gemini 2.5 Flash has vision
      schema: ImageAnalysisSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this image from a scientific paper. ${context ? `Context: ${context}` : ''}
              
Provide:
1. A detailed description of what the image shows
2. The type of visual (chart, diagram, photograph, table, etc.)
3. Key visual elements present
4. Scientific insights or findings that can be derived from it`,
            },
            {
              type: 'image',
              image: imageUrl,
            },
          ],
        },
      ],
    });

    return object;
  } catch (error) {
    console.error('[Multimodal] Failed to analyze image:', error);
    return {
      description: 'Unable to analyze image',
      type: 'other',
      elements: [],
      insights: [],
    };
  }
}

/**
 * Analyze a figure from a paper with context
 */
export async function analyzeFigure(
  imageUrl: string,
  caption?: string,
  paperContext?: string,
): Promise<FigureAnalysis> {
  try {
    const contextParts: string[] = [];
    if (caption) contextParts.push(`Figure caption: "${caption}"`);
    if (paperContext) contextParts.push(`Paper context: ${paperContext}`);
    
    const { object } = await generateObject({
      model: openrouter(MODELS.WRITER),
      schema: FigureAnalysisSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this scientific figure and extract key information.
              
${contextParts.length > 0 ? contextParts.join('\n') : ''}

Focus on:
1. What the figure shows (describe accurately)
2. Key data points or findings
3. Whether the data is quantitative or qualitative
4. How confident you are in your analysis`,
            },
            {
              type: 'image',
              image: imageUrl,
            },
          ],
        },
      ],
    });

    return object;
  } catch (error) {
    console.error('[Multimodal] Failed to analyze figure:', error);
    return {
      description: 'Unable to analyze figure',
      keyFindings: [],
      confidence: 0,
    };
  }
}

/**
 * Extract text content from a PDF URL
 * Note: This is a placeholder - full PDF parsing would require a PDF library
 */
export async function extractPdfText(pdfUrl: string): Promise<string | null> {
  // In production, you would use a PDF parsing library or service
  // Options include:
  // - pdf-parse (Node.js)
  // - pdfjs-dist (browser/Node.js)
  // - Cloud services (Google Document AI, AWS Textract)
  
  console.warn('[Multimodal] PDF text extraction requires additional setup. Using placeholder.');
  
  return null;
}

/**
 * Parse a PDF and extract structured content
 * This is a high-level function that combines text extraction and analysis
 */
export async function parsePdf(
  pdfUrl: string,
  options: {
    extractFigures?: boolean;
    extractTables?: boolean;
    summarize?: boolean;
  } = {},
): Promise<ParsedPdfContent | null> {
  const { extractFigures = true, extractTables = true, summarize = true } = options;
  
  // Attempt to extract text
  const text = await extractPdfText(pdfUrl);
  
  if (!text) {
    // If we can't extract text, return minimal structure
    return {
      text: '',
      wordCount: 0,
      pageCount: 0,
      figures: [],
      tables: [],
      sections: [],
      metadata: {},
      extractedAt: Date.now(),
    };
  }
  
  const wordCount = text.split(/\s+/).length;
  
  // Extract sections using LLM
  let sections: ParsedPdfContent['sections'] = [];
  
  if (summarize && text.length > 0) {
    try {
      const { object } = await generateObject({
        model: openrouter(MODELS.LIGHTWEIGHT),
        schema: SectionExtractionSchema,
        prompt: `Extract the main sections from this academic paper text:

${text.slice(0, 10000)}

Identify section titles, their hierarchy level (1=main, 2=sub, 3=subsub), and provide a brief summary of each section's content.`,
      });
      
      sections = object.sections.map(s => ({
        title: s.title,
        content: s.summary,
        level: s.level,
      }));
    } catch (error) {
      console.error('[Multimodal] Failed to extract sections:', error);
    }
  }
  
  // Extract metadata from text
  const metadata = extractMetadataFromText(text);
  
  return {
    text,
    wordCount,
    pageCount: Math.ceil(wordCount / 500), // Rough estimate
    figures: [], // Would need actual PDF parsing for figures
    tables: [], // Would need actual PDF parsing for tables
    sections,
    metadata,
    extractedAt: Date.now(),
  };
}

/**
 * Extract basic metadata from paper text
 */
function extractMetadataFromText(text: string): ParsedPdfContent['metadata'] {
  const metadata: ParsedPdfContent['metadata'] = {};
  
  // Try to extract title (usually first line or lines before "Abstract")
  const titleMatch = text.match(/^(.+?)(?:\n|Abstract)/i);
  if (titleMatch) {
    metadata.title = titleMatch[1].trim().slice(0, 200);
  }
  
  // Try to extract abstract
  const abstractMatch = text.match(/Abstract\s*[:\.]?\s*([\s\S]+?)(?=\n\n|Introduction|1\.|Keywords)/i);
  if (abstractMatch) {
    metadata.abstract = abstractMatch[1].trim().slice(0, 2000);
  }
  
  // Try to extract keywords
  const keywordsMatch = text.match(/Keywords?\s*[:\.]?\s*(.+?)(?=\n\n|1\.|Introduction)/i);
  if (keywordsMatch) {
    metadata.keywords = keywordsMatch[1]
      .split(/[,;]/)
      .map(k => k.trim())
      .filter(k => k.length > 0 && k.length < 50);
  }
  
  return metadata;
}

/**
 * Analyze chart/graph image and extract data insights
 */
export async function analyzeChart(
  imageUrl: string,
  chartType?: string,
): Promise<{
  chartType: string;
  axes: { x?: string; y?: string };
  dataPoints: string[];
  trends: string[];
  conclusions: string[];
}> {
  try {
    const { text } = await generateText({
      model: openrouter(MODELS.WRITER),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this chart/graph image and extract:
1. The type of chart (bar, line, scatter, pie, etc.)
2. What the X and Y axes represent
3. Key data points or values you can identify
4. Trends or patterns in the data
5. Main conclusions that can be drawn

${chartType ? `Expected chart type: ${chartType}` : ''}

Provide a structured analysis.`,
            },
            {
              type: 'image',
              image: imageUrl,
            },
          ],
        },
      ],
    });

    // Parse the response (simplified - in production, use structured output)
    return {
      chartType: chartType || 'unknown',
      axes: {},
      dataPoints: [],
      trends: [text],
      conclusions: [],
    };
  } catch (error) {
    console.error('[Multimodal] Failed to analyze chart:', error);
    return {
      chartType: 'unknown',
      axes: {},
      dataPoints: [],
      trends: [],
      conclusions: [],
    };
  }
}

/**
 * Compare multiple figures to identify relationships
 */
export async function compareFigures(
  figures: Array<{ url: string; caption?: string }>,
): Promise<{
  comparison: string;
  commonFindings: string[];
  differences: string[];
  synthesis: string;
}> {
  if (figures.length < 2) {
    return {
      comparison: 'Need at least 2 figures to compare',
      commonFindings: [],
      differences: [],
      synthesis: '',
    };
  }

  try {
    const figureDescriptions: string[] = [];
    
    for (let i = 0; i < Math.min(figures.length, 4); i++) {
      const analysis = await analyzeImage(figures[i].url, figures[i].caption);
      figureDescriptions.push(`Figure ${i + 1}: ${analysis.description}`);
    }

    const { text } = await generateText({
      model: openrouter(MODELS.LIGHTWEIGHT),
      prompt: `Compare these figures from scientific papers:

${figureDescriptions.join('\n\n')}

Provide:
1. A comparison of what each figure shows
2. Common findings or themes across figures
3. Key differences between figures
4. A synthesis of insights from all figures combined`,
    });

    return {
      comparison: text,
      commonFindings: [],
      differences: [],
      synthesis: text,
    };
  } catch (error) {
    console.error('[Multimodal] Failed to compare figures:', error);
    return {
      comparison: 'Unable to compare figures',
      commonFindings: [],
      differences: [],
      synthesis: '',
    };
  }
}

/**
 * Extract and summarize tables from text
 */
export async function summarizeTable(
  tableText: string,
  context?: string,
): Promise<{
  summary: string;
  keyMetrics: string[];
  insights: string[];
}> {
  try {
    const { text } = await generateText({
      model: openrouter(MODELS.LIGHTWEIGHT),
      prompt: `Summarize this table from a scientific paper:

${tableText}

${context ? `Context: ${context}` : ''}

Provide:
1. A brief summary of what the table shows
2. Key metrics or values
3. Insights that can be drawn from the data`,
    });

    return {
      summary: text,
      keyMetrics: [],
      insights: [],
    };
  } catch (error) {
    console.error('[Multimodal] Failed to summarize table:', error);
    return {
      summary: 'Unable to summarize table',
      keyMetrics: [],
      insights: [],
    };
  }
}

/**
 * Check if a URL points to an image
 */
export function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const lowercaseUrl = url.toLowerCase();
  return imageExtensions.some(ext => lowercaseUrl.includes(ext));
}

/**
 * Check if a URL points to a PDF
 */
export function isPdfUrl(url: string): boolean {
  return url.toLowerCase().includes('.pdf');
}

