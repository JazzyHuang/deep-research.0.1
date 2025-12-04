'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { 
  Target, 
  FileText, 
  Clock, 
  BookOpen, 
  Shield, 
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import type { QualityMetrics } from '@/types/research';

interface QualityMetricsCardProps {
  metrics: QualityMetrics;
  className?: string;
  compact?: boolean;
}

/**
 * QualityMetricsCard - Visual quality metrics display
 * 
 * Features radial progress indicators and clean metric cards
 */
export function QualityMetricsCard({ 
  metrics, 
  className,
  compact = false 
}: QualityMetricsCardProps) {
  // Calculate overall score (weighted average)
  const overallScore = useMemo(() => {
    const coverageScore = (metrics.subQuestionsCovered / Math.max(metrics.totalSubQuestions, 1)) * 100;
    const citationScore = Math.min(metrics.citationDensity / 3, 1) * 100; // Target: 3 citations per 500 words
    const sourceScore = Math.min(metrics.uniqueSourcesUsed / 10, 1) * 100; // Target: 10 unique sources
    
    return Math.round(
      coverageScore * 0.3 +
      citationScore * 0.25 +
      sourceScore * 0.2 +
      metrics.recencyScore * 0.15 +
      metrics.openAccessPercentage * 0.1
    );
  }, [metrics]);

  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-4 p-3 rounded-xl',
        'bg-muted/30 border border-border/50',
        className
      )}>
        <RadialProgress 
          value={overallScore} 
          size={48} 
          strokeWidth={4}
          showLabel
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">质量评分</span>
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-md',
              overallScore >= 80 && 'bg-green-500/10 text-green-600 dark:text-green-400',
              overallScore >= 60 && overallScore < 80 && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
              overallScore < 60 && 'bg-red-500/10 text-red-600 dark:text-red-400'
            )}>
              {overallScore >= 80 ? '优秀' : overallScore >= 60 ? '良好' : '需改进'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {metrics.uniqueSourcesUsed} 来源 · {metrics.subQuestionsCovered}/{metrics.totalSubQuestions} 覆盖
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-xl border border-border/50',
      'bg-card/50 backdrop-blur',
      'overflow-hidden',
      className
    )}>
      {/* Header with Overall Score */}
      <div className="p-4 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-4">
          <RadialProgress 
            value={overallScore} 
            size={64} 
            strokeWidth={5}
            showLabel
          />
          <div>
            <h3 className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              研究质量评估
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              基于覆盖度、引用密度和来源质量
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <MetricItem
          icon={<Target className="w-4 h-4" />}
          label="问题覆盖"
          value={`${metrics.subQuestionsCovered}/${metrics.totalSubQuestions}`}
          subValue={`${Math.round((metrics.subQuestionsCovered / Math.max(metrics.totalSubQuestions, 1)) * 100)}%`}
          color="primary"
        />
        <MetricItem
          icon={<FileText className="w-4 h-4" />}
          label="引用密度"
          value={metrics.citationDensity.toFixed(1)}
          subValue="每500字"
          color={metrics.citationDensity >= 2 ? 'success' : metrics.citationDensity >= 1 ? 'warning' : 'error'}
        />
        <MetricItem
          icon={<BookOpen className="w-4 h-4" />}
          label="独立来源"
          value={metrics.uniqueSourcesUsed.toString()}
          subValue="篇论文"
          color={metrics.uniqueSourcesUsed >= 8 ? 'success' : metrics.uniqueSourcesUsed >= 5 ? 'warning' : 'error'}
        />
        <MetricItem
          icon={<Clock className="w-4 h-4" />}
          label="时效性"
          value={`${metrics.recencyScore}`}
          subValue="/100"
          color={metrics.recencyScore >= 70 ? 'success' : metrics.recencyScore >= 50 ? 'warning' : 'error'}
        />
        <MetricItem
          icon={<Shield className="w-4 h-4" />}
          label="开放获取"
          value={`${metrics.openAccessPercentage}%`}
          subValue="可访问"
          color={metrics.openAccessPercentage >= 50 ? 'success' : 'warning'}
        />
        {/* Placeholder for additional metric */}
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
          <div className="p-1.5 rounded-md bg-muted/50">
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium text-muted-foreground">更多指标</span>
            <p className="text-[10px] text-muted-foreground/60">即将推出</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RadialProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  className?: string;
}

/**
 * RadialProgress - Circular progress indicator
 */
export function RadialProgress({ 
  value, 
  size = 60, 
  strokeWidth = 4,
  showLabel = false,
  className 
}: RadialProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  
  const getColor = (v: number) => {
    if (v >= 80) return 'text-green-500';
    if (v >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="fill-none stroke-muted/50"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('fill-none transition-all duration-500 ease-out', getColor(value))}
          style={{ stroke: 'currentColor' }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-sm font-semibold tabular-nums', getColor(value))}>
            {value}
          </span>
        </div>
      )}
    </div>
  );
}

interface MetricItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'muted';
}

function MetricItem({ icon, label, value, subValue, color = 'primary' }: MetricItemProps) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-500/10 text-green-600 dark:text-green-400',
    warning: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    error: 'bg-red-500/10 text-red-600 dark:text-red-400',
    muted: 'bg-muted/50 text-muted-foreground',
  };

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
      <div className={cn('p-1.5 rounded-md', colorClasses[color])}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-semibold tabular-nums">{value}</span>
          {subValue && (
            <span className="text-[10px] text-muted-foreground">{subValue}</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

/**
 * MiniQualityBadge - Tiny inline quality indicator
 */
interface MiniQualityBadgeProps {
  score: number;
  className?: string;
}

export function MiniQualityBadge({ score, className }: MiniQualityBadgeProps) {
  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full',
      'text-xs font-medium',
      score >= 80 && 'bg-green-500/10 text-green-600 dark:text-green-400',
      score >= 60 && score < 80 && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
      score < 60 && 'bg-red-500/10 text-red-600 dark:text-red-400',
      className
    )}>
      <RadialProgress value={score} size={16} strokeWidth={2} />
      <span>{score}/100</span>
    </div>
  );
}

export default QualityMetricsCard;




