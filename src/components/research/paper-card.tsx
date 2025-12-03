'use client';

import { Paper } from '@/types/paper';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ExternalLink, 
  FileText, 
  Calendar, 
  Users, 
  BookOpen,
  Download
} from 'lucide-react';

interface PaperCardProps {
  paper: Paper;
  compact?: boolean;
  citationNumber?: number;
}

export function PaperCard({ paper, compact = false, citationNumber }: PaperCardProps) {
  const authorsList = paper.authors.slice(0, 3).map(a => a.name).join(', ');
  const hasMoreAuthors = paper.authors.length > 3;

  if (compact) {
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group">
        {citationNumber && (
          <span className="text-xs font-mono text-primary font-medium mt-0.5">
            [{citationNumber}]
          </span>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {paper.title}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            {authorsList}{hasMoreAuthors && ' et al.'} • {paper.year}
          </p>
        </div>
        {paper.downloadUrl && (
          <a
            href={paper.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    );
  }

  return (
    <Card className="research-card overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {citationNumber && (
              <Badge variant="secondary" className="mb-2 font-mono">
                [{citationNumber}]
              </Badge>
            )}
            <h3 className="font-serif text-lg font-medium leading-snug line-clamp-2">
              {paper.title}
            </h3>
          </div>
          {paper.openAccess && (
            <Badge className="shrink-0 bg-green-500/10 text-green-600 border-green-500/20">
              Open Access
            </Badge>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {authorsList}{hasMoreAuthors && ' et al.'}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {paper.year}
          </span>
          {paper.journal && (
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              {paper.journal}
            </span>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {paper.abstract && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
            {paper.abstract}
          </p>
        )}

        {paper.subjects && paper.subjects.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {paper.subjects.slice(0, 4).map((subject, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {subject}
              </Badge>
            ))}
            {paper.subjects.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{paper.subjects.length - 4}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          {paper.doi && (
            <a
              href={`https://doi.org/${paper.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <FileText className="w-3 h-3" />
              DOI: {paper.doi}
            </a>
          )}
          <div className="flex-1" />
          {paper.downloadUrl && (
            <Button variant="ghost" size="sm" asChild>
              <a href={paper.downloadUrl} target="_blank" rel="noopener noreferrer">
                <Download className="w-3.5 h-3.5 mr-1" />
                PDF
              </a>
            </Button>
          )}
          {paper.sourceUrl && (
            <Button variant="ghost" size="sm" asChild>
              <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Source
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface PaperListProps {
  papers: Paper[];
  compact?: boolean;
  showCitations?: boolean;
}

export function PaperList({ papers, compact = false, showCitations = false }: PaperListProps) {
  if (papers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No papers found
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {papers.map((paper, index) => (
          <PaperCard 
            key={paper.id} 
            paper={paper} 
            compact 
            citationNumber={showCitations ? index + 1 : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {papers.map((paper, index) => (
        <PaperCard 
          key={paper.id} 
          paper={paper}
          citationNumber={showCitations ? index + 1 : undefined}
        />
      ))}
    </div>
  );
}









