'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Search, Sparkles, BookOpen, Dices, ChevronRight } from 'lucide-react';
import { CitationStyleSelector } from './citation-style-selector';
import { type CitationStyle } from '@/lib/citation';
import { cn } from '@/lib/utils';

interface ResearchInputProps {
  onSubmit: (query: string, citationStyle: CitationStyle) => void;
  isLoading?: boolean;
}

const EXAMPLE_QUERIES = [
  'What are the latest advances in transformer architecture for natural language processing?',
  'How does climate change affect marine biodiversity in coral reef ecosystems?',
  'What are the psychological effects of social media on adolescent mental health?',
  'Explore the relationship between gut microbiome and neurodegenerative diseases',
  'What are the current approaches to quantum error correction in superconducting qubits?',
  'How do large language models learn and represent semantic knowledge?',
];

export function ResearchInput({ onSubmit, isLoading }: ResearchInputProps) {
  const [query, setQuery] = useState('');
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('ieee');
  const [isHoverOpen, setIsHoverOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSubmit(query.trim(), citationStyle);
    }
  };

  const handleExampleSelect = useCallback((example: string) => {
    setQuery(example);
    setIsHoverOpen(false);
  }, []);

  const handleLuckyClick = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * EXAMPLE_QUERIES.length);
    setQuery(EXAMPLE_QUERIES[randomIndex]);
    setIsHoverOpen(false);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-serif mb-3">
          Deep Research
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          AI-powered academic research assistant. Enter your research question and get a 
          comprehensive report with real citations from peer-reviewed papers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="p-2 research-card bg-card/50 backdrop-blur border-2 border-primary/10 focus-within:border-primary/30 transition-colors">
          <Textarea
            placeholder="Enter your research question... (e.g., What are the environmental impacts of electric vehicles?)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[120px] text-lg border-0 bg-transparent resize-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
            disabled={isLoading}
          />
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-3 pl-2">
              <p className="text-xs text-muted-foreground hidden sm:block">
                200M+ papers
              </p>
              <CitationStyleSelector
                value={citationStyle}
                onChange={setCitationStyle}
                compact
                disabled={isLoading}
              />
            </div>
            <div className="flex items-center gap-2">
              {/* I'm Feeling Lucky Button with HoverCard */}
              <HoverCard 
                open={isHoverOpen} 
                onOpenChange={setIsHoverOpen}
                openDelay={200}
                closeDelay={100}
              >
                <HoverCardTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={handleLuckyClick}
                    disabled={isLoading}
                    className="gap-2 lucky-button group relative overflow-hidden"
                  >
                    <Dices className="w-4 h-4 transition-transform group-hover:rotate-12" />
                    <span className="hidden sm:inline">I'm Feeling Lucky</span>
                    <span className="sm:hidden">Lucky</span>
                  </Button>
                </HoverCardTrigger>
                <HoverCardContent 
                  className="w-80 p-0 overflow-hidden"
                  side="top"
                  align="end"
                  sideOffset={8}
                >
                  <div className="p-3 border-b border-border bg-muted/30">
                    <p className="text-sm font-medium">Choose a research topic</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Or click the button to pick randomly
                    </p>
                  </div>
                  <ScrollArea className="max-h-64">
                    <div className="p-2">
                      {EXAMPLE_QUERIES.map((example, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleExampleSelect(example)}
                          className={cn(
                            "w-full text-left p-3 rounded-md text-sm transition-all duration-150",
                            "hover:bg-accent/10 hover:translate-x-1",
                            "focus:outline-none focus:bg-accent/10",
                            "group/item"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <ChevronRight className="w-3 h-3 mt-1 text-accent opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0" />
                            <span className="text-muted-foreground group-hover/item:text-foreground transition-colors line-clamp-2">
                              {example}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </HoverCardContent>
              </HoverCard>

              {/* Start Research Button */}
              <Button 
                type="submit" 
                size="lg"
                disabled={!query.trim() || isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Researching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Start Research
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
}
