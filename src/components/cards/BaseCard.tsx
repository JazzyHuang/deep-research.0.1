'use client';

import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  FileText,
  Search,
  BookOpen,
  BarChart3,
  ListChecks,
  ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InteractiveCard, CardType, CardAction } from '@/types/cards';

interface BaseCardProps {
  card: InteractiveCard;
  onTitleClick: () => void;
  onAction?: (action: string) => void;
  className?: string;
}

const CARD_ICONS: Record<CardType, React.ReactNode> = {
  plan: <ClipboardList className="w-4 h-4" />,
  paper_list: <BookOpen className="w-4 h-4" />,
  search_result: <Search className="w-4 h-4" />,
  document: <FileText className="w-4 h-4" />,
  quality: <BarChart3 className="w-4 h-4" />,
  citation_list: <ListChecks className="w-4 h-4" />,
};

export function BaseCard({ card, onTitleClick, onAction, className }: BaseCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(card.isCollapsed);
  
  const icon = card.icon || CARD_ICONS[card.type];
  
  return (
    <div className={cn(
      "rounded-xl border bg-card overflow-hidden transition-all duration-200",
      card.isCheckpoint && "border-amber-500/50 shadow-amber-500/10 shadow-lg",
      className
    )}>
      {/* Header - Clickable title */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <button
          onClick={onTitleClick}
          className="flex items-center gap-2 flex-1 min-w-0 text-left hover:text-primary transition-colors group"
        >
          <span className="text-primary/70 group-hover:text-primary transition-colors">
            {icon}
          </span>
          <span className="font-medium text-sm truncate">
            {card.title}
          </span>
          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>
      
      {/* Content */}
      {!isCollapsed && (
        <div className="px-4 py-3">
          <CardContent card={card} />
        </div>
      )}
      
      {/* Checkpoint Actions */}
      {card.isCheckpoint && card.actions && card.actions.length > 0 && (
        <div className="px-4 py-3 border-t bg-muted/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              等待您的确认
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {card.actions.map((action) => (
              <ActionButton
                key={action.id}
                action={action}
                onClick={() => onAction?.(action.action)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CardContent({ card }: { card: InteractiveCard }) {
  switch (card.data.type) {
    case 'plan':
      return <PlanCardContent data={card.data} />;
    case 'paper_list':
      return <PaperListCardContent data={card.data} />;
    case 'search_result':
      return <SearchResultCardContent data={card.data} />;
    case 'document':
      return <DocumentCardContent data={card.data} />;
    case 'quality':
      return <QualityCardContent data={card.data} />;
    case 'citation_list':
      return <CitationListCardContent data={card.data} />;
    default:
      return null;
  }
}

function PlanCardContent({ data }: { data: import('@/types/cards').PlanCardData }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">主题</p>
        <p className="text-sm font-medium">{data.plan.mainQuestion}</p>
      </div>
      
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          子问题 · {data.summary.subQuestionsCount}个
        </p>
        <ul className="space-y-1">
          {data.plan.subQuestions.slice(0, 3).map((q, i) => (
            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
              <span className="text-primary">•</span>
              <span className="line-clamp-1">{q}</span>
            </li>
          ))}
          {data.plan.subQuestions.length > 3 && (
            <li className="text-sm text-muted-foreground">
              +{data.plan.subQuestions.length - 3} 更多...
            </li>
          )}
        </ul>
      </div>
      
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>搜索策略: {data.summary.searchStrategiesCount}个</span>
        <span>预期章节: {data.summary.expectedSectionsCount}个</span>
      </div>
    </div>
  );
}

function PaperListCardContent({ data }: { data: import('@/types/cards').PaperListCardData }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        共找到 {data.totalFound} 篇相关论文，展示 Top {data.displayCount}
      </p>
      <ul className="space-y-2">
        {data.papers.slice(0, 3).map((paper, i) => (
          <li key={paper.id} className="text-sm">
            <p className="font-medium line-clamp-1">{i + 1}. {paper.title}</p>
            <p className="text-xs text-muted-foreground">
              {paper.journal || 'Unknown Journal'}, {paper.year}
              {paper.citations !== undefined && ` · 引用 ${paper.citations}`}
            </p>
          </li>
        ))}
      </ul>
      {data.papers.length > 3 && (
        <p className="text-xs text-muted-foreground">+{data.papers.length - 3} 更多...</p>
      )}
    </div>
  );
}

function SearchResultCardContent({ data }: { data: import('@/types/cards').SearchResultCardData }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded bg-muted">Round {data.roundNumber}</span>
      </div>
      <p className="text-sm">
        搜索: <span className="font-medium">&ldquo;{data.query}&rdquo;</span>
      </p>
      <p className="text-sm text-muted-foreground">
        找到 {data.resultsCount} 篇论文
      </p>
    </div>
  );
}

function DocumentCardContent({ data }: { data: import('@/types/cards').DocumentCardData }) {
  // Render first few lines of content
  const preview = data.content.slice(0, 500);
  
  return (
    <div className="space-y-3">
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <div 
          className="line-clamp-6 text-sm"
          dangerouslySetInnerHTML={{ 
            __html: preview
              .replace(/^# (.*)$/gm, '<strong>$1</strong>')
              .replace(/^## (.*)$/gm, '<strong class="text-sm">$1</strong>')
              .replace(/\n/g, '<br>')
          }} 
        />
        {data.content.length > 500 && (
          <span className="text-muted-foreground">...</span>
        )}
      </div>
      
      <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t">
        <span>字数: {data.wordCount.toLocaleString()}</span>
        <span>引用: {data.citationCount}</span>
        {data.qualityScore !== undefined && (
          <span>质量分: {data.qualityScore}/100</span>
        )}
      </div>
    </div>
  );
}

function QualityCardContent({ data }: { data: import('@/types/cards').QualityCardData }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">综合评分</span>
        <span className={cn(
          "text-lg font-bold",
          data.analysis.overallScore >= 80 ? "text-green-500" :
          data.analysis.overallScore >= 60 ? "text-yellow-500" : "text-red-500"
        )}>
          {data.analysis.overallScore}/100
        </span>
      </div>
      
      <div className="space-y-2">
        <ProgressBar label="覆盖度" value={data.metrics.coverageScore} />
        <ProgressBar label="引用密度" value={Math.min(data.metrics.citationDensity * 20, 100)} />
        <ProgressBar label="时效性" value={data.metrics.recencyScore} />
      </div>
      
      {data.improvements.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">待改进</p>
          <ul className="space-y-1">
            {data.improvements.slice(0, 2).map((item, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-amber-500">•</span>
                <span className="line-clamp-1">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CitationListCardContent({ data }: { data: import('@/types/cards').CitationListCardData }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        共 {data.citations.length} 条引用 · {data.style.toUpperCase()} 格式
      </p>
      <ul className="space-y-1 text-sm">
        {data.citations.slice(0, 3).map((citation, i) => (
          <li key={citation.id} className="text-muted-foreground line-clamp-1">
            [{i + 1}] {citation.authors[0]} et al. ({citation.year}). {citation.title}
          </li>
        ))}
      </ul>
      {data.citations.length > 3 && (
        <p className="text-xs text-muted-foreground">+{data.citations.length - 3} 更多...</p>
      )}
    </div>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all",
              value >= 80 ? "bg-green-500" :
              value >= 60 ? "bg-yellow-500" : "bg-red-500"
            )}
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
      <span className="text-xs text-muted-foreground w-20">{label} {Math.round(value)}%</span>
    </div>
  );
}

function ActionButton({ action, onClick }: { action: CardAction; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={action.disabled}
      className={cn(
        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        action.variant === 'primary' && "bg-primary text-primary-foreground hover:bg-primary/90",
        action.variant === 'secondary' && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        action.variant === 'outline' && "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        action.variant === 'destructive' && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      )}
    >
      {action.label}
    </button>
  );
}

