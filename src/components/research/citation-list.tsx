'use client';

import { useState, useMemo } from 'react';
import { Citation } from '@/types/research';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BookMarked, 
  Copy, 
  Check, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Hash,
  User,
} from 'lucide-react';
import { 
  type CitationStyle, 
  type CitationData,
  getFormatter,
  isNumericStyle,
  CITATION_STYLES,
} from '@/lib/citation';
import { CitationStyleSelector } from './citation-style-selector';

interface CitationListProps {
  citations: Citation[];
  onCitationClick?: (citation: Citation) => void;
  defaultStyle?: CitationStyle;
  allowStyleChange?: boolean;
}

export function CitationList({ 
  citations, 
  onCitationClick,
  defaultStyle = 'ieee',
  allowStyleChange = true,
}: CitationListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>(defaultStyle);

  // Convert Citation[] to CitationData[] for formatting
  const citationDataList: CitationData[] = useMemo(() => 
    citations.map((cite, index) => ({
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
    })),
    [citations]
  );

  const formatter = getFormatter(citationStyle);
  
  // Sort citations according to style rules
  const sortedCitationData = useMemo(() => 
    formatter.sortCitations(citationDataList),
    [citationDataList, formatter]
  );

  const displayedCitations = expanded ? sortedCitationData : sortedCitationData.slice(0, 5);
  const hasMore = sortedCitationData.length > 5;

  const copyToClipboard = async (citationData: CitationData) => {
    const text = formatter.formatReference(citationData);
    // Remove markdown formatting for clipboard
    const cleanText = text
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[|\]/g, '');
    await navigator.clipboard.writeText(cleanText);
    setCopiedId(citationData.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyAllReferences = async () => {
    const text = formatter.formatReferenceList(sortedCitationData);
    const cleanText = text
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[|\]/g, '');
    await navigator.clipboard.writeText(cleanText);
    setCopiedId('all');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatInText = (citationData: CitationData): string => {
    if (isNumericStyle(citationStyle)) {
      return `[${citationData.index}]`;
    }
    return formatter.formatInText(citationData, { parenthetical: true });
  };

  // Get the original Citation object for a CitationData
  const getOriginalCitation = (citationData: CitationData): Citation | undefined => {
    return citations.find(c => c.id === citationData.id);
  };

  if (citations.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg font-serif">
            <BookMarked className="w-5 h-5 text-primary" />
            References
            <Badge variant="secondary" className="ml-2">
              {citations.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {allowStyleChange && (
              <CitationStyleSelector
                value={citationStyle}
                onChange={setCitationStyle}
                compact
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={copyAllReferences}
              className="gap-1"
            >
              {copiedId === 'all' ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Copy All</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className={expanded && sortedCitationData.length > 8 ? 'h-[400px]' : undefined}>
          <div className="space-y-3">
            {displayedCitations.map((citationData) => {
              const originalCitation = getOriginalCitation(citationData);
              const formattedRef = formatter.formatReference(citationData);
              
              return (
                <div
                  key={citationData.id}
                  id={`ref-${citationData.id}`}
                  className="group flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => originalCitation && onCitationClick?.(originalCitation)}
                >
                  <Badge 
                    variant="outline" 
                    className="shrink-0 font-mono text-xs mt-0.5"
                  >
                    {formatInText(citationData)}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                      {citationData.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {citationData.authors.slice(0, 2).map(a => a.name.split(' ').pop()).join(', ')}
                        {citationData.authors.length > 2 && ' et al.'}
                      </span>
                      <span>•</span>
                      <span>{citationData.year}</span>
                      {citationData.journal && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[120px]">{citationData.journal}</span>
                        </>
                      )}
                    </p>
                    {/* Show formatted reference preview */}
                    <p 
                      className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2"
                      dangerouslySetInnerHTML={{ 
                        __html: formattedRef
                          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                          .replace(/^\[\d+\]\s*/, '')
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(citationData);
                      }}
                      title="Copy reference"
                    >
                      {copiedId === citationData.id ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    {(citationData.doi || citationData.url) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a
                          href={citationData.doi ? `https://doi.org/${citationData.doi}` : citationData.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open source"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-3"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                Show {sortedCitationData.length - 5} More
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Inline citation component with tooltip preview
interface InlineCitationProps {
  citation: Citation;
  index?: number;
  style?: CitationStyle;
  onClick?: () => void;
}

export function InlineCitation({ 
  citation, 
  index, 
  style = 'ieee',
  onClick,
}: InlineCitationProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const citationData: CitationData = {
    id: citation.id,
    paperId: citation.paperId,
    title: citation.title,
    authors: citation.authors.map(name => ({ name })),
    year: citation.year,
    doi: citation.doi,
    url: citation.url,
    journal: citation.journal,
    volume: citation.volume,
    issue: citation.issue,
    pages: citation.pages,
    index,
  };
  
  const formatter = getFormatter(style);
  const inTextRef = isNumericStyle(style) 
    ? (index ?? citation.inTextRef.replace(/[\[\]]/g, ''))
    : formatter.formatInText(citationData, { parenthetical: false });

  return (
    <span className="relative inline-block">
      <button
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="citation"
        title={`${citation.authors[0] || 'Unknown'} et al. (${citation.year})`}
      >
        {isNumericStyle(style) ? inTextRef : inTextRef}
      </button>
      
      {/* Tooltip preview */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 p-3 bg-popover border rounded-lg shadow-lg text-left">
          <p className="text-sm font-medium line-clamp-2">{citation.title}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {citation.authors.slice(0, 2).join(', ')}
            {citation.authors.length > 2 && ' et al.'}
            {' • '}{citation.year}
          </p>
          {citation.journal && (
            <p className="text-xs text-muted-foreground mt-0.5 italic">
              {citation.journal}
            </p>
          )}
          {citation.doi && (
            <a 
              href={`https://doi.org/${citation.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-1 block"
              onClick={(e) => e.stopPropagation()}
            >
              View source →
            </a>
          )}
        </div>
      )}
    </span>
  );
}

// Export formatted reference list as component
interface FormattedReferenceListProps {
  citations: Citation[];
  style?: CitationStyle;
}

export function FormattedReferenceList({ 
  citations, 
  style = 'ieee' 
}: FormattedReferenceListProps) {
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
  
  const formatter = getFormatter(style);
  const sortedCitations = formatter.sortCitations(citationDataList);
  
  return (
    <div className="space-y-3 font-serif">
      {sortedCitations.map((citationData) => (
        <div 
          key={citationData.id}
          id={`ref-${citationData.id}`}
          className="text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ 
            __html: formatter.formatReference(citationData)
              .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          }}
        />
      ))}
    </div>
  );
}
