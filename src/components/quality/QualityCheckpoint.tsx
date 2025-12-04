'use client';

import { useState } from 'react';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Search,
  Target,
  BookOpen,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { QualityMetrics, CriticAnalysis, QualityGateResult } from '@/types/research';

interface QualityCheckpointProps {
  result: QualityGateResult;
  previousResult?: QualityGateResult;
  iteration: number;
  onRequestResearch?: (gap: string) => void;
  onApprove?: () => void;
  onRequestIteration?: () => void;
  className?: string;
}

/**
 * QualityCheckpoint - Interactive quality gate visualization
 * Shows Critic evaluation, scores, gaps, and allows user intervention
 */
export function QualityCheckpoint({
  result,
  previousResult,
  iteration,
  onRequestResearch,
  onApprove,
  onRequestIteration,
  className,
}: QualityCheckpointProps) {
  const [gapsExpanded, setGapsExpanded] = useState(true);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  
  const { metrics, analysis, decision, reason } = result;
  
  // Calculate score changes from previous iteration
  const getScoreChange = (current: number, previous?: number): { change: number; trend: 'up' | 'down' | 'same' } => {
    if (previous === undefined) return { change: 0, trend: 'same' };
    const change = current - previous;
    return {
      change,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'same',
    };
  };
  
  const overallChange = getScoreChange(analysis.overallScore, previousResult?.analysis.overallScore);
  const coverageChange = getScoreChange(analysis.coverageScore, previousResult?.analysis.coverageScore);
  
  // Get status color and icon
  const getStatusConfig = () => {
    switch (decision) {
      case 'pass':
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          color: 'text-emerald-500',
          bgColor: 'bg-emerald-500/10',
          borderColor: 'border-emerald-500/30',
          label: 'Quality Gate Passed',
        };
      case 'iterate':
        return {
          icon: <RefreshCw className="w-5 h-5" />,
          color: 'text-amber-500',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
          label: 'Iteration Recommended',
        };
      case 'fail':
        return {
          icon: <XCircle className="w-5 h-5" />,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          label: 'Quality Gate Failed',
        };
    }
  };
  
  const statusConfig = getStatusConfig();
  
  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };
  
  // Render trend indicator
  const TrendIndicator = ({ change, trend }: { change: number; trend: 'up' | 'down' | 'same' }) => {
    if (trend === 'same') return null;
    
    const Icon = trend === 'up' ? TrendingUp : TrendingDown;
    const color = trend === 'up' ? 'text-emerald-500' : 'text-red-500';
    
    return (
      <span className={cn('flex items-center text-xs', color)}>
        <Icon className="w-3 h-3 mr-0.5" />
        {Math.abs(change)}
      </span>
    );
  };
  
  return (
    <Card className={cn('overflow-hidden', statusConfig.borderColor, 'border-2', className)}>
      {/* Header */}
      <CardHeader className={cn('pb-3', statusConfig.bgColor)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-serif">
            <Shield className={cn('w-5 h-5', statusConfig.color)} />
            Quality Gate
            <Badge variant="outline" className="ml-2 text-xs">
              Iteration {iteration}
            </Badge>
          </CardTitle>
          
          <div className={cn('flex items-center gap-2', statusConfig.color)}>
            {statusConfig.icon}
            <span className="font-medium text-sm">{statusConfig.label}</span>
          </div>
        </div>
        
        {reason && (
          <p className="text-sm text-muted-foreground mt-2">{reason}</p>
        )}
      </CardHeader>
      
      <CardContent className="p-4 space-y-4">
        {/* Score Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Overall Score */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Overall</span>
              <TrendIndicator {...overallChange} />
            </div>
            <div className={cn('text-2xl font-bold', getScoreColor(analysis.overallScore))}>
              {analysis.overallScore}
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <Progress value={analysis.overallScore} className="h-1.5 mt-2" />
          </div>
          
          {/* Coverage Score */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Target className="w-3 h-3" />
                Coverage
              </span>
              <TrendIndicator {...coverageChange} />
            </div>
            <div className={cn('text-2xl font-bold', getScoreColor(analysis.coverageScore))}>
              {analysis.coverageScore}
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {metrics.subQuestionsCovered}/{metrics.totalSubQuestions} questions
            </div>
          </div>
          
          {/* Citation Accuracy */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                Citations
              </span>
            </div>
            <div className={cn('text-2xl font-bold', getScoreColor(analysis.citationAccuracy))}>
              {analysis.citationAccuracy}
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Density: {metrics.citationDensity}/500w
            </div>
          </div>
          
          {/* Depth Score */}
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Depth</span>
            </div>
            <div className={cn('text-2xl font-bold', getScoreColor(analysis.depthScore))}>
              {analysis.depthScore}
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {metrics.uniqueSourcesUsed} sources
            </div>
          </div>
        </div>
        
        <Separator />
        
        {/* Gaps Identified */}
        {analysis.gapsIdentified.length > 0 && (
          <Collapsible open={gapsExpanded} onOpenChange={setGapsExpanded}>
            <CollapsibleTrigger className="flex items-center justify-between w-full group">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="font-medium text-sm">Gaps Identified</span>
                <Badge variant="secondary" className="text-xs">
                  {analysis.gapsIdentified.length}
                </Badge>
              </div>
              {gapsExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
              )}
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="mt-3 space-y-2">
                {analysis.gapsIdentified.map((gap, index) => (
                  <div 
                    key={index}
                    className="flex items-start justify-between gap-2 p-2 rounded-md bg-amber-500/5 border border-amber-500/20"
                  >
                    <span className="text-sm text-muted-foreground flex-1">{gap}</span>
                    {onRequestResearch && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                        onClick={() => onRequestResearch(gap)}
                      >
                        <Search className="w-3 h-3 mr-1" />
                        Search
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {/* Detailed Feedback */}
        {analysis.feedback && (
          <Collapsible open={feedbackExpanded} onOpenChange={setFeedbackExpanded}>
            <CollapsibleTrigger className="flex items-center justify-between w-full group">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="font-medium text-sm">Detailed Feedback</span>
              </div>
              {feedbackExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
              )}
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="mt-3 p-3 rounded-md bg-muted/30 border border-border/50">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {analysis.feedback}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
        
        {/* Strengths & Weaknesses Summary */}
        <div className="grid grid-cols-2 gap-4">
          {/* Strengths */}
          {analysis.strengths.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                Strengths
              </h4>
              <ul className="space-y-1">
                {analysis.strengths.slice(0, 3).map((strength, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                    <span className="text-emerald-500">•</span>
                    {strength.slice(0, 60)}{strength.length > 60 && '...'}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Weaknesses */}
          {analysis.weaknesses.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                Improvements Needed
              </h4>
              <ul className="space-y-1">
                {analysis.weaknesses.slice(0, 3).map((weakness, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                    <span className="text-amber-500">•</span>
                    {weakness.slice(0, 60)}{weakness.length > 60 && '...'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        {(onApprove || onRequestIteration) && decision !== 'pass' && (
          <>
            <Separator />
            <div className="flex items-center justify-end gap-2">
              {onRequestIteration && decision === 'iterate' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRequestIteration}
                  className="gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Request Iteration
                </Button>
              )}
              {onApprove && (
                <Button
                  size="sm"
                  onClick={onApprove}
                  className="gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Approve & Continue
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact Quality Badge - For sidebar display
 */
export function QualityBadge({ 
  score, 
  decision,
  className,
}: { 
  score: number; 
  decision: 'pass' | 'iterate' | 'fail';
  className?: string;
}) {
  const getConfig = () => {
    switch (decision) {
      case 'pass':
        return { icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-emerald-500 bg-emerald-500/10' };
      case 'iterate':
        return { icon: <RefreshCw className="w-3.5 h-3.5" />, color: 'text-amber-500 bg-amber-500/10' };
      case 'fail':
        return { icon: <XCircle className="w-3.5 h-3.5" />, color: 'text-red-500 bg-red-500/10' };
    }
  };
  
  const config = getConfig();
  
  return (
    <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium', config.color, className)}>
      {config.icon}
      <span>{score}/100</span>
    </div>
  );
}

