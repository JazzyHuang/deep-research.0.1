import { streamText } from 'ai';
import type { Paper } from '@/types/paper';
import type { Citation, ResearchPlan, ResearchReport, ReportSection, SearchRound } from '@/types/research';
import {
  type CitationStyle,
  type CitationData,
  paperToCitationData,
  getFormatter,
  formatReferenceList,
  isNumericStyle,
  CITATION_STYLES,
  formatAuthorsInText,
} from '@/lib/citation';
import { openrouter, MODELS, getModelConfig, THINKING_BUDGETS } from '@/lib/models';

interface WriterContext {
  plan: ResearchPlan;
  searchRounds: SearchRound[];
  allPapers: Paper[];
  previousFeedback?: string;  // Feedback from critic for iteration
  iteration?: number;         // Current iteration number
  citationStyle?: CitationStyle; // Citation format style
}

/**
 * Generate the complete research report with streaming
 */
export async function* generateReport(
  context: WriterContext
): AsyncGenerator<{ type: 'content' | 'citation' | 'section' | 'complete'; data: unknown }> {
  const { plan, allPapers, previousFeedback, iteration = 1, citationStyle = 'ieee' } = context;
  
  // Get the formatter for the selected style
  const formatter = getFormatter(citationStyle);
  const useNumericCitations = isNumericStyle(citationStyle);
  
  // Create citation data map
  const citationDataMap = new Map<string, CitationData>();
  const citationMap = new Map<string, Citation>();
  let citationIndex = 1;

  allPapers.forEach(paper => {
    if (!citationDataMap.has(paper.id)) {
      // Create CitationData for formatting
      const citationData = paperToCitationData(paper, citationIndex);
      citationDataMap.set(paper.id, citationData);
      
      // Generate appropriate in-text reference based on style
      let inTextRef: string;
      if (useNumericCitations) {
        inTextRef = `[${citationIndex}]`;
      } else {
        // Author-year format
        inTextRef = formatter.formatInText(citationData, { parenthetical: true });
      }
      
      // Create Citation for the report
      const citation: Citation = {
        id: `cite-${citationIndex}`,
        paperId: paper.id,
        title: paper.title,
        authors: paper.authors.map(a => a.name),
        year: paper.year,
        doi: paper.doi,
        url: paper.downloadUrl || paper.sourceUrl,
        journal: paper.journal,
        volume: paper.volume,
        issue: paper.issue,
        pages: paper.pages,
        publisher: paper.publisher,
        conference: paper.conference,
        inTextRef,
      };
      citationMap.set(paper.id, citation);
      citationIndex++;
    }
  });

  // Prepare paper context for the model - format depends on citation style
  const paperContext = allPapers.map(p => {
    const citationData = citationDataMap.get(p.id);
    const inTextRef = useNumericCitations 
      ? `[${citationData?.index}]` 
      : `(${formatAuthorsInText(p.authors, citationStyle === 'mla' ? 'mla' : 'apa')}, ${p.year})`;
    
    return `
${inTextRef} ${p.title}
Authors: ${p.authors.map(a => a.name).join(', ')} (${p.year})
Abstract: ${p.abstract?.slice(0, 600) || 'No abstract'}
${p.doi ? `DOI: ${p.doi}` : ''}
${p.journal ? `Journal: ${p.journal}` : ''}
---`;
  }).join('\n');

  // Generate citation format instructions based on style
  const citationInstructions = getCitationInstructions(citationStyle);

  // Generate report title
  yield { type: 'section', data: { heading: 'Generating Title...', level: 0 } };

  const reportSections: ReportSection[] = [];
  let fullContent = '';

  // Stream the main content using Gemini 2.5 Flash with thinking mode
  // for deep synthesis and high-quality academic writing
  const thinkingOptions = getModelConfig(MODELS.WRITER, true, THINKING_BUDGETS.DEEP);
  const { textStream } = streamText({
    model: openrouter(MODELS.WRITER),
    ...thinkingOptions,
    system: `You are an expert academic writer creating a comprehensive research report.

${citationInstructions}

WRITING STYLE:
- Academic but accessible tone
- Clear structure with headings
- Logical flow between sections
- Critical analysis, not just summarization
- Synthesize findings across multiple papers

FORMAT:
- Use Markdown formatting
- Start with # for the main title
- Use ## for major sections
- Use ### for subsections
- Use bullet points and numbered lists where appropriate`,

    prompt: `Write a comprehensive research report on the following topic:

RESEARCH QUESTION: ${plan.mainQuestion}

SUB-QUESTIONS TO ADDRESS:
${plan.subQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

EXPECTED SECTIONS:
${plan.expectedSections.join(', ')}

AVAILABLE SOURCES (with citation format):
${paperContext}
${previousFeedback ? `
ITERATION ${iteration} - IMPROVEMENT INSTRUCTIONS:
This is iteration ${iteration} of the report. The previous version received the following feedback:

${previousFeedback}

Please address ALL the points in the feedback while maintaining the strengths of the previous version.
Focus especially on:
- Filling any identified gaps in coverage
- Improving citation density where noted
- Fixing any flagged issues
- Enhancing analysis depth where requested
` : ''}
Write a complete, well-structured academic report that:
1. Has an engaging title
2. Includes an abstract (150-200 words)
3. Covers all expected sections${previousFeedback ? ' (especially addressing the feedback above)' : ''}
4. Synthesizes findings from multiple papers
5. Provides critical analysis
6. Ends with conclusions and future directions
7. Uses proper citations throughout as specified above

Begin writing the report now:`,
  });

  let currentSection = '';
  let buffer = '';
  
  // Pattern for detecting citations based on style
  const citationPattern = useNumericCitations 
    ? /\[(\d+(?:,\s*\d+)*)\]/g
    : /\(([A-Za-z]+(?:\s+(?:&|and)\s+[A-Za-z]+)?(?:\s+et\s+al\.?)?,?\s*\d{4}(?:;\s*[A-Za-z]+(?:\s+(?:&|and)\s+[A-Za-z]+)?(?:\s+et\s+al\.?)?,?\s*\d{4})*)\)/g;

  for await (const chunk of textStream) {
    buffer += chunk;
    fullContent += chunk;

    // Detect section headers
    const headerMatch = buffer.match(/^(#{1,3})\s+(.+)$/m);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const heading = headerMatch[2];
      if (heading !== currentSection) {
        currentSection = heading;
        yield { type: 'section', data: { heading, level } };
        reportSections.push({ heading, content: '', level });
      }
    }

    // Detect citations in the content
    if (useNumericCitations) {
      const citationMatches = chunk.matchAll(/\[(\d+(?:,\s*\d+)*)\]/g);
      for (const match of citationMatches) {
        const citationNums = match[1].split(',').map(n => parseInt(n.trim()));
        for (const num of citationNums) {
          const citation = Array.from(citationMap.values()).find(c => c.inTextRef === `[${num}]`);
          if (citation) {
            yield { type: 'citation', data: citation };
          }
        }
      }
    }

    yield { type: 'content', data: chunk };

    // Clear buffer but keep last 100 chars for header detection
    if (buffer.length > 200) {
      buffer = buffer.slice(-100);
    }
  }

  // Parse sections from full content
  const parsedSections = parseMarkdownSections(fullContent);

  // Extract title and abstract
  const titleMatch = fullContent.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : plan.mainQuestion;

  const abstractMatch = fullContent.match(/##\s*Abstract\s*\n([\s\S]*?)(?=\n##|$)/i);
  const abstract = abstractMatch ? abstractMatch[1].trim() : '';

  // Create final report
  const report: ResearchReport = {
    title,
    abstract,
    sections: parsedSections,
    citations: Array.from(citationMap.values()),
    generatedAt: new Date(),
  };

  yield { type: 'complete', data: report };
}

/**
 * Get citation instructions for the LLM based on style
 */
function getCitationInstructions(style: CitationStyle): string {
  const styleInfo = CITATION_STYLES[style];
  
  if (isNumericStyle(style)) {
    return `IMPORTANT CITATION RULES (${styleInfo.name}):
- Use the citation numbers provided in square brackets, e.g., [1], [2], [3]
- Cite specific claims with the relevant paper number
- When discussing findings from a paper, always cite it
- You can cite multiple papers together: [1, 2, 3] or [1-3] for consecutive numbers
- Every major claim should have at least one citation
- Citations come AFTER the statement, BEFORE the period: "...this finding is significant [1]."`;
  }
  
  // Author-year styles (APA, MLA, Chicago)
  const examples = style === 'mla' 
    ? '(Smith), (Smith and Jones), (Smith et al.)'
    : '(Smith, 2023), (Smith & Jones, 2023), (Smith et al., 2023)';
  
  return `IMPORTANT CITATION RULES (${styleInfo.name}):
- Use author-year parenthetical citations: ${examples}
- For narrative citations: Smith (2023) found that...
- Cite specific claims with the relevant source
- Multiple sources in one citation: ${style === 'mla' ? '(Smith; Jones)' : '(Smith, 2023; Jones, 2022)'}
- Every major claim should have at least one citation
- Use "et al." for three or more authors`;
}

/**
 * Parse markdown content into sections
 */
function parseMarkdownSections(content: string): ReportSection[] {
  const sections: ReportSection[] = [];
  const lines = content.split('\n');
  
  let currentSection: ReportSection | null = null;
  let contentBuffer: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    
    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentBuffer.join('\n').trim();
        sections.push(currentSection);
      }

      currentSection = {
        heading: headerMatch[2],
        level: headerMatch[1].length,
        content: '',
      };
      contentBuffer = [];
    } else if (currentSection) {
      contentBuffer.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = contentBuffer.join('\n').trim();
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Generate a formatted reference list using the citation formatting module
 */
export function generateStyledReferenceList(
  citations: Citation[],
  style: CitationStyle = 'ieee'
): string {
  // Convert Citations to CitationData
  const citationDataList: CitationData[] = citations.map((cite, index) => ({
    id: cite.id,
    paperId: cite.paperId,
    title: cite.title,
    authors: cite.authors.map(name => ({ name })),
    year: cite.year,
    doi: cite.doi,
    url: cite.url,
    journal: cite.journal,
    volume: cite.volume,
    issue: cite.issue,
    pages: cite.pages,
    publisher: cite.publisher,
    conference: cite.conference,
    index: index + 1,
  }));
  
  return formatReferenceList(citationDataList, style);
}

/**
 * Generate a formatted reference list (legacy function for backward compatibility)
 */
export function generateReferenceList(citations: Citation[], style: CitationStyle = 'ieee'): string {
  return generateStyledReferenceList(citations, style);
}

/**
 * Generate a brief summary for a specific section
 * Uses Gemini 2.5 Flash-Lite for efficient summary generation
 */
export async function generateSectionSummary(
  sectionContent: string,
  maxLength: number = 200
): Promise<string> {
  const { textStream } = streamText({
    model: openrouter(MODELS.LIGHTWEIGHT),
    prompt: `Summarize this section in ${maxLength} characters or less:\n\n${sectionContent}`,
  });

  let summary = '';
  for await (const chunk of textStream) {
    summary += chunk;
  }

  return summary.slice(0, maxLength);
}
