'use client';

import { cn } from '@/lib/utils';
import type { QualityCardData } from '@/types/cards';

interface QualityViewerProps {
  data: QualityCardData;
}

export function QualityViewer({ data }: QualityViewerProps) {
  const { metrics, analysis, iteration, improvements } = data;
  
  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="text-center p-4 rounded-lg bg-muted/50">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          综合评分
        </p>
        <p className={cn(
          "text-4xl font-bold",
          analysis.overallScore >= 80 ? "text-green-500" :
          analysis.overallScore >= 60 ? "text-yellow-500" : "text-red-500"
        )}>
          {analysis.overallScore}
          <span className="text-lg text-muted-foreground">/100</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          第 {iteration} 次迭代
        </p>
      </div>
      
      {/* Detailed Scores */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
          详细评分
        </p>
        <div className="space-y-3">
          <ScoreBar label="覆盖度" value={analysis.coverageScore} />
          <ScoreBar label="引用准确性" value={analysis.citationAccuracy} />
          <ScoreBar label="逻辑连贯性" value={analysis.coherenceScore} />
          <ScoreBar label="分析深度" value={analysis.depthScore} />
        </div>
      </div>
      
      {/* Metrics */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
          量化指标
        </p>
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="覆盖子问题"
            value={`${metrics.subQuestionsCovered}/${metrics.totalSubQuestions}`}
          />
          <MetricCard
            label="引用密度"
            value={`${metrics.citationDensity.toFixed(1)}/500词`}
          />
          <MetricCard
            label="独立来源"
            value={metrics.uniqueSourcesUsed.toString()}
          />
          <MetricCard
            label="平均引用年份"
            value={metrics.averageCitationYear.toString()}
          />
          <MetricCard
            label="时效性"
            value={`${metrics.recencyScore}%`}
          />
          <MetricCard
            label="开放获取"
            value={`${metrics.openAccessPercentage}%`}
          />
        </div>
      </div>
      
      {/* Strengths */}
      {analysis.strengths.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            优点
          </p>
          <ul className="space-y-1">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="text-sm text-green-600 dark:text-green-400 flex items-start gap-2">
                <span>✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Weaknesses */}
      {analysis.weaknesses.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            待改进
          </p>
          <ul className="space-y-1">
            {analysis.weaknesses.map((w, i) => (
              <li key={i} className="text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
                <span>!</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Gaps */}
      {analysis.gapsIdentified.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            未覆盖内容
          </p>
          <ul className="space-y-1">
            {analysis.gapsIdentified.map((g, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-red-500">○</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Improvements */}
      {improvements.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            改进建议
          </p>
          <ul className="space-y-1">
            {improvements.map((item, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-primary">{i + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Feedback */}
      {analysis.feedback && (
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            评审反馈
          </p>
          <p className="text-sm">{analysis.feedback}</p>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground italic text-center pt-4 border-t">
        质量报告为只读，无法编辑
      </p>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm">{label}</span>
        <span className={cn(
          "text-sm font-medium",
          value >= 80 ? "text-green-500" :
          value >= 60 ? "text-yellow-500" : "text-red-500"
        )}>
          {value}%
        </span>
      </div>
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
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-lg bg-muted/50 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}







