'use client';

import { useState, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  FileText,
  Search,
  BookOpen,
  BarChart3,
  ListChecks,
  ClipboardList,
  ArrowRight,
  Pencil
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InteractiveCard, CardType, CardAction } from '@/types/cards';

interface BaseCardProps {
  card: InteractiveCard;
  onTitleClick: () => void;
  onAction?: (action: string) => void;
  className?: string;
  /** Enable slide-in animation */
  animate?: boolean;
}

const CARD_ICONS: Record<CardType, React.ReactNode> = {
  plan: <ClipboardList className="w-4 h-4" />,
  paper_list: <BookOpen className="w-4 h-4" />,
  search_result: <Search className="w-4 h-4" />,
  document: <FileText className="w-4 h-4" />,
  quality: <BarChart3 className="w-4 h-4" />,
  citation_list: <ListChecks className="w-4 h-4" />,
};

/**
 * BaseCard - Modern interactive card component
 * 
 * Features:
 * - Clean, elegant design with subtle gradients
 * - Integrated action buttons in footer
 * - Smooth hover and expand animations
 * - Status indicator for active checkpoints
 */
export function BaseCard({ 
  card, 
  onTitleClick, 
  onAction, 
  className,
  animate = true 
}: BaseCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(card.isCollapsed);
  const [isNew, setIsNew] = useState(animate);
  
  // Remove "new" state after animation completes
  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setIsNew(false), 600);
      return () => clearTimeout(timer);
    }
  }, [animate]);
  
  const icon = card.icon || CARD_ICONS[card.type];
  const hasActions = card.actions && card.actions.length > 0;
  
  return (
    <div className={cn(
      // Base card styling
      "relative overflow-hidden",
      "rounded-2xl",
      "bg-card",
      "border",
      "transition-all duration-300 ease-out",
      // Shadow and border states
      hasActions 
        ? "border-primary/20 shadow-md shadow-primary/5 hover:shadow-lg hover:shadow-primary/10 hover:border-primary/30" 
        : "border-border/50 shadow-sm hover:shadow-md hover:border-border",
      // Slide-in animation
      isNew && "card-slide-in",
      className
    )}>
      {/* Top accent gradient for cards with actions */}
      {hasActions && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
      )}
      
      {/* Header */}
      <div className={cn(
        "flex items-center gap-3 px-5 py-4",
        !isCollapsed && "border-b border-border/30"
      )}>
        {/* Icon */}
        <div className={cn(
          "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center",
          hasActions 
            ? "bg-primary/10 text-primary" 
            : "bg-muted text-muted-foreground"
        )}>
          {icon}
        </div>
        
        {/* Title - clickable */}
        <button
          onClick={onTitleClick}
          className="flex-1 min-w-0 text-left group"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
              {card.title}
            </span>
            <ExternalLink className={cn(
              "w-3.5 h-3.5 flex-shrink-0",
              "text-muted-foreground/0 group-hover:text-primary/60",
              "transition-all duration-200",
              "group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            )} />
          </div>
        </button>
        
        {/* Collapse toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-2 rounded-lg",
            "text-muted-foreground hover:text-foreground",
            "hover:bg-muted/50",
            "transition-all duration-200"
          )}
        >
          <div className={cn(
            "transition-transform duration-300",
            isCollapsed ? "rotate-0" : "rotate-180"
          )}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </button>
      </div>
      
      {/* Collapsible Content */}
      <div className={cn(
        "overflow-hidden transition-all duration-300 ease-out",
        isCollapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
      )}>
        <div className="px-5 py-4">
          <CardContent card={card} />
        </div>
      </div>
      
      {/* Action Footer - always show if actions exist */}
      {hasActions && (
        <div className={cn(
          "px-5 py-4",
          "bg-muted/20",
          "border-t border-border/30"
        )}>
          <div className="flex flex-wrap items-center gap-3">
            {card.actions!.map((action, index) => (
              <ActionButton
                key={action.id}
                action={action}
                isPrimary={index === 0}
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
    <div className="space-y-4">
      {/* Main question */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">研究主题</p>
        <p className="text-sm text-foreground leading-relaxed">{data.plan.mainQuestion}</p>
      </div>
      
      {/* Sub-questions */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          子问题 · {data.summary.subQuestionsCount}个
        </p>
        <ul className="space-y-1.5">
          {data.plan.subQuestions.slice(0, 3).map((q, i) => (
            <li key={i} className="text-sm text-foreground/80 flex items-start gap-2.5">
              <span className="w-5 h-5 flex-shrink-0 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                {i + 1}
              </span>
              <span className="line-clamp-1 pt-0.5">{q}</span>
            </li>
          ))}
          {data.plan.subQuestions.length > 3 && (
            <li className="text-sm text-muted-foreground pl-7">
              +{data.plan.subQuestions.length - 3} 更多问题
            </li>
          )}
        </ul>
      </div>
      
      {/* Stats */}
      <div className="flex gap-4 pt-3 border-t border-border/30">
        <StatBadge label="搜索策略" value={data.summary.searchStrategiesCount} />
        <StatBadge label="预期章节" value={data.summary.expectedSectionsCount} />
      </div>
    </div>
  );
}

function PaperListCardContent({ data }: { data: import('@/types/cards').PaperListCardData }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        共找到 <span className="font-semibold text-foreground">{data.totalFound}</span> 篇相关论文
      </p>
      
      <ul className="space-y-2.5">
        {data.papers.slice(0, 3).map((paper, i) => (
          <li key={paper.id} className="group">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 flex-shrink-0 rounded-lg bg-muted text-muted-foreground text-xs flex items-center justify-center font-medium">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                  {paper.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {paper.journal || 'Unknown'} · {paper.year}
                  {paper.citations !== undefined && ` · ${paper.citations} 引用`}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      
      {data.papers.length > 3 && (
        <p className="text-xs text-muted-foreground pt-1">
          还有 {data.papers.length - 3} 篇论文...
        </p>
      )}
    </div>
  );
}

function SearchResultCardContent({ data }: { data: import('@/types/cards').SearchResultCardData }) {
  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-muted text-xs font-medium">
        Round {data.roundNumber}
      </div>
      <p className="text-sm">
        搜索: <span className="font-medium text-foreground">&ldquo;{data.query}&rdquo;</span>
      </p>
      <p className="text-sm text-muted-foreground">
        找到 <span className="font-semibold text-foreground">{data.resultsCount}</span> 篇论文
      </p>
    </div>
  );
}

function DocumentCardContent({ data }: { data: import('@/types/cards').DocumentCardData }) {
  const preview = data.content.slice(0, 400);
  
  return (
    <div className="space-y-3">
      <div className="text-sm text-foreground/80 leading-relaxed line-clamp-4">
        {preview}
        {data.content.length > 400 && <span className="text-muted-foreground">...</span>}
      </div>
      
      <div className="flex flex-wrap gap-3 pt-3 border-t border-border/30">
        <StatBadge label="字数" value={data.wordCount.toLocaleString()} />
        <StatBadge label="引用" value={data.citationCount} />
        {data.qualityScore !== undefined && (
          <div className={cn(
            "px-2.5 py-1 rounded-lg text-xs font-medium",
            data.qualityScore >= 80 ? "bg-green-500/10 text-green-600 dark:text-green-400" :
            data.qualityScore >= 60 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : 
            "bg-red-500/10 text-red-600 dark:text-red-400"
          )}>
            质量 {data.qualityScore}%
          </div>
        )}
      </div>
    </div>
  );
}

function QualityCardContent({ data }: { data: import('@/types/cards').QualityCardData }) {
  return (
    <div className="space-y-4">
      {/* Overall score */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">综合评分</span>
        <div className={cn(
          "text-2xl font-bold",
          data.analysis.overallScore >= 80 ? "text-green-500" :
          data.analysis.overallScore >= 60 ? "text-amber-500" : "text-red-500"
        )}>
          {data.analysis.overallScore}
          <span className="text-sm font-normal text-muted-foreground">/100</span>
        </div>
      </div>
      
      {/* Progress bars */}
      <div className="space-y-3">
        <ProgressBar label="覆盖度" value={data.metrics.coverageScore} />
        <ProgressBar label="引用密度" value={Math.min(data.metrics.citationDensity * 20, 100)} />
        <ProgressBar label="时效性" value={data.metrics.recencyScore} />
      </div>
      
      {/* Improvements */}
      {data.improvements.length > 0 && (
        <div className="pt-3 border-t border-border/30">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">改进建议</p>
          <ul className="space-y-1.5">
            {data.improvements.slice(0, 2).map((item, i) => (
              <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
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
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        共 <span className="font-semibold text-foreground">{data.citations.length}</span> 条引用 · {data.style.toUpperCase()} 格式
      </p>
      <ul className="space-y-1.5 text-sm">
        {data.citations.slice(0, 3).map((citation, i) => (
          <li key={citation.id} className="text-foreground/80 line-clamp-1">
            <span className="text-muted-foreground">[{i + 1}]</span> {citation.authors[0]} et al. ({citation.year}). {citation.title}
          </li>
        ))}
      </ul>
      {data.citations.length > 3 && (
        <p className="text-xs text-muted-foreground">+{data.citations.length - 3} 更多引用</p>
      )}
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="px-2.5 py-1 rounded-lg bg-muted/50 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground ml-1.5">{value}</span>
    </div>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all duration-500",
            value >= 80 ? "bg-green-500" :
            value >= 60 ? "bg-amber-500" : "bg-red-500"
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function ActionButton({ 
  action, 
  isPrimary,
  onClick 
}: { 
  action: CardAction; 
  isPrimary: boolean;
  onClick: () => void;
}) {
  const isEditAction = action.action === 'edit';
  
  return (
    <button
      onClick={onClick}
      disabled={action.disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2",
        "px-4 py-2.5 rounded-xl",
        "text-sm font-medium",
        "transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        // Primary action - prominent
        isPrimary && !isEditAction && [
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90",
          "shadow-sm shadow-primary/20",
          "hover:shadow-md hover:shadow-primary/30",
          "hover:scale-[1.02] active:scale-[0.98]"
        ],
        // Secondary/Edit action - subtle
        (!isPrimary || isEditAction) && [
          "bg-muted/50 text-foreground",
          "border border-border/50",
          "hover:bg-muted hover:border-border",
          "hover:scale-[1.02] active:scale-[0.98]"
        ]
      )}
    >
      {isPrimary && !isEditAction && <ArrowRight className="w-4 h-4" />}
      {isEditAction && <Pencil className="w-3.5 h-3.5" />}
      {action.label}
    </button>
  );
}
