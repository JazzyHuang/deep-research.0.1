'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaperList } from './paper-card';
import { CitationList } from './citation-list';
import { CitationStyleSelector } from './citation-style-selector';
import { ExecutionTimeline, CompactTimeline, useExecutionTimeline } from '@/components/execution';
import type { Paper } from '@/types/paper';
import type { 
  Citation, 
  ResearchPlan, 
  ResearchReport, 
  ResearchStatus, 
  ExtendedStreamEvent,
  QualityMetrics,
  CriticAnalysis,
} from '@/types/research';
import type { CitationStyle } from '@/lib/citation';
import { 
  FileText, 
  Search, 
  Sparkles, 
  BookOpen,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Copy,
  Check,
  ListTree,
  RefreshCw,
  Shield,
  TrendingUp,
  AlertTriangle,
  Target,
  Gauge,
  Activity,
} from 'lucide-react';

interface ResearchStreamProps {
  query: string;
  citationStyle?: CitationStyle;
  onComplete?: (report: ResearchReport) => void;
  onError?: (error: string) => void;
}

type Phase = 'planning' | 'searching' | 'analyzing' | 'writing' | 'reviewing' | 'iterating' | 'complete' | 'error';

export function ResearchStream({ 
  query, 
  citationStyle: initialStyle = 'ieee',
  onComplete, 
  onError 
}: ResearchStreamProps) {
  const [phase, setPhase] = useState<Phase>('planning');
  const [status, setStatus] = useState<string>('Initializing research...');
  const [plan, setPlan] = useState<ResearchPlan | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [content, setContent] = useState<string>('');
  const [searchRound, setSearchRound] = useState(0);
  const [currentSection, setCurrentSection] = useState<string>('');
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [copied, setCopied] = useState(false);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>(initialStyle);
  const [highlightedCitation, setHighlightedCitation] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'report' | 'execution'>('report');
  
  // New state for quality control
  const [iteration, setIteration] = useState(1);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [criticAnalysis, setCriticAnalysis] = useState<CriticAnalysis | null>(null);
  const [gaps, setGaps] = useState<string[]>([]);
  const [iterationFeedback, setIterationFeedback] = useState<string>('');
  
  // Execution timeline state
  const { 
    state: executionState, 
    handleEvent: handleExecutionEvent, 
    toggleCollapse, 
    expandAll, 
    collapseAll 
  } = useExecutionTimeline();
  
  const contentRef = useRef<HTMLDivElement>(null);
  const referencesRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Scroll to citation reference
  const scrollToCitation = useCallback((citationId: string) => {
    const element = document.getElementById(`ref-${citationId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedCitation(citationId);
      setTimeout(() => setHighlightedCitation(null), 2000);
    }
  }, []);

  // Handle citation click in content
  const handleCitationClick = useCallback((citationNumber: number) => {
    const citation = citations.find(c => c.inTextRef === `[${citationNumber}]`);
    if (citation) {
      scrollToCitation(citation.id);
    }
  }, [citations, scrollToCitation]);

  useEffect(() => {
    const startResearch = async () => {
      try {
        const response = await fetch('/api/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query,
            config: {
              citationStyle,
            }
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to start research');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: ExtendedStreamEvent = JSON.parse(line.slice(6));
                handleEvent(event);
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setPhase('error');
        setStatus(message);
        onError?.(message);
      }
    };

    startResearch();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [query, citationStyle]);

  const handleEvent = (event: ExtendedStreamEvent) => {
    // Handle agent step events (for execution timeline)
    if (event.type.startsWith('agent_step_')) {
      handleExecutionEvent(event);
      return;
    }
    
    switch (event.type) {
      case 'status':
        setPhase(event.status as Phase);
        setStatus(event.message);
        break;
      case 'plan':
        setPlan(event.plan);
        break;
      case 'search_start':
        setSearchRound(event.round);
        setStatus(`Searching: "${event.query}"`);
        break;
      case 'papers_found':
        setPapers(prev => {
          const newPapers = event.papers.filter(
            p => !prev.some(existing => existing.id === p.id)
          );
          return [...prev, ...newPapers];
        });
        break;
      case 'analysis':
        setStatus(event.insight);
        break;
      case 'writing_start':
        setCurrentSection(event.section);
        break;
      case 'content':
        setContent(prev => prev + event.content);
        // Auto-scroll
        if (contentRef.current) {
          contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
        break;
      case 'citation':
        setCitations(prev => {
          if (prev.some(c => c.id === event.citation.id)) return prev;
          return [...prev, event.citation];
        });
        break;
      case 'complete':
        setReport(event.report);
        onComplete?.(event.report);
        break;
      case 'error':
        setPhase('error');
        setStatus(event.error);
        onError?.(event.error);
        break;
      // New event handlers for quality control
      case 'quality_check_start':
        setIteration(event.iteration);
        break;
      case 'quality_metrics':
        setQualityMetrics(event.metrics);
        break;
      case 'critic_analysis':
        setCriticAnalysis(event.analysis);
        break;
      case 'iteration_start':
        setIteration(event.iteration);
        setIterationFeedback(event.feedback);
        // Clear content for new iteration
        setContent('');
        break;
      case 'gap_identified':
        setGaps(prev => [...prev, event.gap]);
        break;
      case 'quality_gate_result':
        // Handled through quality_metrics and critic_analysis
        break;
      case 'citation_validated':
        // Could show validation status on citations
        break;
    }
  };

  const copyContent = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPhaseIcon = (p: Phase) => {
    switch (p) {
      case 'planning': return <ListTree className="w-4 h-4" />;
      case 'searching': return <Search className="w-4 h-4" />;
      case 'analyzing': return <Sparkles className="w-4 h-4" />;
      case 'writing': return <FileText className="w-4 h-4" />;
      case 'reviewing': return <Shield className="w-4 h-4" />;
      case 'iterating': return <RefreshCw className="w-4 h-4" />;
      case 'complete': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-destructive" />;
    }
  };

  const phases: Phase[] = ['planning', 'searching', 'analyzing', 'writing', 'reviewing', 'complete'];
  
  const isPhaseActive = (p: Phase) => {
    // Handle iterating as part of the review cycle
    const currentIndex = p === 'iterating' ? phases.indexOf('writing') : phases.indexOf(phase);
    const targetIndex = phases.indexOf(p);
    return targetIndex <= currentIndex;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Enhanced markdown renderer with clickable citations
  const renderMarkdownWithCitations = (text: string): string => {
    return text
      // Headers
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      // Citations - make them clickable with data attributes
      .replace(/\[(\d+(?:,\s*\d+)*)\]/g, (match, nums) => {
        const numbers = nums.split(',').map((n: string) => n.trim());
        return numbers.map((n: string) => 
          `<button class="citation" data-citation="${n}" onclick="window.handleCitationClick && window.handleCitationClick(${n})">${n}</button>`
        ).join(', ');
      })
      // Lists
      .replace(/^\* (.*$)/gm, '<li>$1</li>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
      // Blockquotes
      .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
      // Paragraphs
      .replace(/\n\n/g, '</p><p>')
      // Line breaks
      .replace(/\n/g, '<br>');
  };

  // Set up global click handler for citations
  useEffect(() => {
    (window as any).handleCitationClick = handleCitationClick;
    return () => {
      delete (window as any).handleCitationClick;
    };
  }, [handleCitationClick]);

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Progress Header */}
      <Card className="mb-6 bg-card/50 backdrop-blur">
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {phase !== 'complete' && phase !== 'error' && (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              )}
              {getPhaseIcon(phase)}
              <span className="font-medium">{status}</span>
            </div>
            <div className="flex items-center gap-2">
              {phase === 'searching' && (
                <Badge variant="secondary">Round {searchRound}</Badge>
              )}
              {(phase === 'writing' || phase === 'reviewing' || phase === 'iterating') && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Iteration {iteration}
                </Badge>
              )}
              {phase === 'writing' && currentSection && (
                <Badge variant="outline">{currentSection}</Badge>
              )}
              {qualityMetrics && phase !== 'planning' && phase !== 'searching' && (
                <Badge 
                  variant="outline" 
                  className={`flex items-center gap-1 ${getScoreColor(criticAnalysis?.overallScore || 0)}`}
                >
                  <Gauge className="w-3 h-3" />
                  {criticAnalysis?.overallScore || '...'}/100
                </Badge>
              )}
            </div>
          </div>
          
          {/* Phase Progress */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {phases.map((p, i) => (
              <div key={p} className="flex items-center">
                <div 
                  className={`
                    flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap
                    ${phase === p || (phase === 'iterating' && p === 'writing') ? 'bg-primary text-primary-foreground' : ''}
                    ${isPhaseActive(p) && phase !== p && !(phase === 'iterating' && p === 'writing') ? 'bg-primary/20 text-primary' : ''}
                    ${!isPhaseActive(p) ? 'bg-muted text-muted-foreground' : ''}
                  `}
                >
                  {getPhaseIcon(p)}
                  <span className="hidden sm:inline capitalize">{p}</span>
                </div>
                {i < phases.length - 1 && (
                  <div className={`w-4 h-0.5 mx-0.5 ${isPhaseActive(phases[i + 1]) ? 'bg-primary/40' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Iteration Feedback */}
          {iterationFeedback && phase === 'iterating' && (
            <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-500 mb-1">Improving Report (Iteration {iteration})</p>
                  <p className="text-muted-foreground">{iterationFeedback.slice(0, 200)}...</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Content with Tabs */}
        <div className="lg:col-span-2">
          <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as 'report' | 'execution')}>
            <div className="flex items-center justify-between mb-4">
              <TabsList className="grid w-fit grid-cols-2">
                <TabsTrigger value="report" className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Report
                </TabsTrigger>
                <TabsTrigger value="execution" className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Execution
                  {executionState.steps.size > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {executionState.steps.size}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              
              {activeMainTab === 'report' && (phase === 'complete' || content.length > 0) && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={copyContent}>
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={downloadMarkdown}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
            
            {/* Report Tab */}
            <TabsContent value="report" className="mt-0">
              <Card className="bg-card/50 backdrop-blur min-h-[600px] flex flex-col">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 font-serif">
                      <BookOpen className="w-5 h-5 text-primary" />
                      Research Report
                      {iteration > 1 && (
                        <Badge variant="outline" className="ml-2 text-xs">v{iteration}</Badge>
                      )}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                  <ScrollArea className="h-[calc(100vh-450px)] min-h-[500px]">
                    <div 
                      ref={contentRef}
                      className="p-6 prose-research"
                    >
                      {content ? (
                        <div 
                          className={phase === 'writing' || phase === 'iterating' ? 'streaming-cursor' : ''}
                          dangerouslySetInnerHTML={{ 
                            __html: renderMarkdownWithCitations(content) 
                          }} 
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
                          <Sparkles className="w-12 h-12 mb-4 opacity-50" />
                          <p>Generating your research report...</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Execution Timeline Tab */}
            <TabsContent value="execution" className="mt-0">
              <ExecutionTimeline
                steps={executionState.steps}
                rootStepIds={executionState.rootStepIds}
                onToggle={toggleCollapse}
                onExpandAll={expandAll}
                onCollapseAll={collapseAll}
                maxHeight="calc(100vh - 400px)"
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Compact Execution Timeline - always visible */}
          {executionState.steps.size > 0 && (
            <Card className="bg-card/50 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-serif">
                  <Activity className="w-5 h-5 text-primary" />
                  Agent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CompactTimeline
                  steps={executionState.steps}
                  rootStepIds={executionState.rootStepIds}
                />
                <Button 
                  variant="link" 
                  size="sm" 
                  className="mt-2 p-0 h-auto text-xs"
                  onClick={() => setActiveMainTab('execution')}
                >
                  View full timeline
                </Button>
              </CardContent>
            </Card>
          )}
          
          {/* Quality Metrics Card */}
          {qualityMetrics && (
            <Card className="bg-card/50 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-serif">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Quality Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Overall Score */}
                  {criticAnalysis && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Overall Score</span>
                      <span className={`text-lg font-bold ${getScoreColor(criticAnalysis.overallScore)}`}>
                        {criticAnalysis.overallScore}/100
                      </span>
                    </div>
                  )}
                  <Separator />
                  
                  {/* Coverage */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      Coverage
                    </span>
                    <span className="text-sm font-medium">
                      {qualityMetrics.subQuestionsCovered}/{qualityMetrics.totalSubQuestions}
                    </span>
                  </div>
                  
                  {/* Citation Density */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Citations/500 words</span>
                    <span className="text-sm font-medium">{qualityMetrics.citationDensity.toFixed(1)}</span>
                  </div>
                  
                  {/* Sources */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Unique Sources</span>
                    <span className="text-sm font-medium">{qualityMetrics.uniqueSourcesUsed}</span>
                  </div>
                  
                  {/* Recency */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Recency Score</span>
                    <span className={`text-sm font-medium ${getScoreColor(qualityMetrics.recencyScore)}`}>
                      {qualityMetrics.recencyScore}/100
                    </span>
                  </div>

                  {/* Open Access */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Open Access</span>
                    <span className="text-sm font-medium">{qualityMetrics.openAccessPercentage}%</span>
                  </div>
                </div>

                {/* Gaps Identified */}
                {gaps.length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                        Gaps Being Addressed
                      </p>
                      <ul className="space-y-1">
                        {gaps.slice(0, 3).map((gap, i) => (
                          <li key={i} className="text-xs text-amber-500 flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            {gap}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Research Plan */}
          {plan && (
            <Card className="bg-card/50 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg font-serif">
                  <ListTree className="w-5 h-5 text-primary" />
                  Research Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      Main Question
                    </p>
                    <p className="text-sm font-medium">{plan.mainQuestion}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      Sub-questions
                    </p>
                    <ul className="space-y-1">
                      {plan.subQuestions.map((q, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary">•</span>
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Papers & Citations Tabs */}
          <Tabs defaultValue="citations" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="citations" className="flex-1">
                References ({citations.length})
              </TabsTrigger>
              <TabsTrigger value="papers" className="flex-1">
                Papers ({papers.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="citations" className="mt-4" ref={referencesRef}>
              <CitationList 
                citations={citations} 
                defaultStyle={citationStyle}
                onCitationClick={(citation) => {
                  // Highlight the citation in the list
                  setHighlightedCitation(citation.id);
                  setTimeout(() => setHighlightedCitation(null), 2000);
                }}
              />
            </TabsContent>
            <TabsContent value="papers" className="mt-4">
              <Card className="bg-card/50 backdrop-blur">
                <CardContent className="p-4">
                  <ScrollArea className="h-[400px]">
                    <PaperList papers={papers} compact showCitations />
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
