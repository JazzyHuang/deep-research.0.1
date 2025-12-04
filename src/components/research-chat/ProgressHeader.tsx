'use client';

import { useMemo } from 'react';
import { 
  Brain, 
  Search, 
  FileText, 
  PenTool, 
  CheckCircle2, 
  Circle,
  Loader2,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Research stages
export type ResearchStage = 
  | 'planning' 
  | 'searching' 
  | 'analyzing' 
  | 'writing' 
  | 'reviewing' 
  | 'complete';

interface StageConfig {
  id: ResearchStage;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}

const STAGES: StageConfig[] = [
  { id: 'planning', label: '规划研究', shortLabel: '规划', icon: <Brain className="w-3.5 h-3.5" /> },
  { id: 'searching', label: '文献检索', shortLabel: '检索', icon: <Search className="w-3.5 h-3.5" /> },
  { id: 'analyzing', label: '深度分析', shortLabel: '分析', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'writing', label: '撰写报告', shortLabel: '撰写', icon: <PenTool className="w-3.5 h-3.5" /> },
  { id: 'reviewing', label: '质量审核', shortLabel: '审核', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
];

interface ProgressHeaderProps {
  currentStage: ResearchStage;
  completedStages: ResearchStage[];
  currentStepName?: string;
  estimatedTimeRemaining?: number; // in seconds
  isActive: boolean;
  className?: string;
}

/**
 * ProgressHeader - Modern sticky progress indicator
 * 
 * Redesigned with:
 * - Pill-shaped stage indicators
 * - Gradient progress line
 * - Subtle glassmorphism
 */
export function ProgressHeader({
  currentStage,
  completedStages,
  currentStepName,
  estimatedTimeRemaining,
  isActive,
  className,
}: ProgressHeaderProps) {
  // Compute stage statuses
  const stageStatuses = useMemo(() => {
    return STAGES.map(stage => {
      if (completedStages.includes(stage.id)) {
        return 'completed';
      }
      if (stage.id === currentStage) {
        return 'current';
      }
      return 'pending';
    });
  }, [currentStage, completedStages]);

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    const completedCount = completedStages.length;
    const total = STAGES.length;
    
    if (currentStage === 'complete') return 100;
    
    // Base progress from completed stages + partial progress for current
    return ((completedCount + 0.5) / total) * 100;
  }, [currentStage, completedStages]);

  // Format time remaining
  const formattedTime = useMemo(() => {
    if (!estimatedTimeRemaining || estimatedTimeRemaining <= 0) return null;
    
    const minutes = Math.floor(estimatedTimeRemaining / 60);
    const seconds = estimatedTimeRemaining % 60;
    
    if (minutes > 0) {
      return `~${minutes}分${seconds > 0 ? `${seconds}秒` : ''}`;
    }
    return `~${seconds}秒`;
  }, [estimatedTimeRemaining]);

  if (!isActive && completedStages.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      "sticky top-0 z-20",
      "bg-background/80 backdrop-blur-lg",
      "border-b border-border/30",
      "px-4 py-2.5",
      className
    )}>
      <div className="flex items-center gap-4">
        {/* Progress Stages - Horizontal pills */}
        <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-thin py-1">
          {STAGES.map((stage, index) => {
            const status = stageStatuses[index];
            const isLast = index === STAGES.length - 1;
            
            return (
              <div key={stage.id} className="flex items-center">
                {/* Stage pill */}
                <div className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full",
                  "transition-all duration-300 whitespace-nowrap",
                  "text-xs font-medium",
                  status === 'completed' && "bg-primary/15 text-primary",
                  status === 'current' && "bg-primary text-primary-foreground shadow-sm shadow-primary/20",
                  status === 'pending' && "bg-muted/50 text-muted-foreground/50"
                )}>
                  {/* Stage icon or check */}
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : status === 'current' && isActive ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    stage.icon
                  )}
                  
                  {/* Label - show full on current, short on others */}
                  <span className="hidden sm:inline">
                    {status === 'current' ? stage.label : stage.shortLabel}
                  </span>
                  <span className="sm:hidden">
                    {stage.shortLabel}
                  </span>
                </div>
                
                {/* Connector */}
                {!isLast && (
                  <div className={cn(
                    "w-4 h-0.5 mx-1 rounded-full transition-colors duration-300",
                    stageStatuses[index + 1] !== 'pending' 
                      ? "bg-primary/40" 
                      : "bg-border"
                  )} />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Current step badge */}
        {isActive && currentStepName && (
          <div className={cn(
            "hidden md:flex items-center gap-2",
            "px-3 py-1.5 rounded-full",
            "bg-muted/50 border border-border/50"
          )}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-xs text-foreground/80 font-medium max-w-[150px] truncate">
              {currentStepName}
            </span>
          </div>
        )}
        
        {/* Completion state */}
        {!isActive && currentStage === 'complete' && (
          <div className={cn(
            "flex items-center gap-2",
            "px-3 py-1.5 rounded-full",
            "bg-primary/10 border border-primary/20"
          )}>
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-primary font-medium">研究完成</span>
          </div>
        )}
        
        {/* Time remaining */}
        {formattedTime && isActive && (
          <span className="hidden lg:block text-xs text-muted-foreground/60 whitespace-nowrap">
            {formattedTime}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Derive current stage from agent steps
 */
export function deriveStageFromSteps(steps: Array<{ name: string; status: string }>): {
  currentStage: ResearchStage;
  completedStages: ResearchStage[];
} {
  const completedStages: ResearchStage[] = [];
  let currentStage: ResearchStage = 'planning';
  
  // Map step names to stages
  const stageMapping: Record<string, ResearchStage> = {
    planning: 'planning',
    plan: 'planning',
    search: 'searching',
    searching: 'searching',
    retrieval: 'searching',
    analyze: 'analyzing',
    analyzing: 'analyzing',
    analysis: 'analyzing',
    write: 'writing',
    writing: 'writing',
    synthesize: 'writing',
    review: 'reviewing',
    reviewing: 'reviewing',
    validate: 'reviewing',
    quality: 'reviewing',
  };
  
  for (const step of steps) {
    const stepNameLower = step.name.toLowerCase();
    
    // Find matching stage
    for (const [key, stage] of Object.entries(stageMapping)) {
      if (stepNameLower.includes(key)) {
        if (step.status === 'success') {
          if (!completedStages.includes(stage)) {
            completedStages.push(stage);
          }
        } else if (step.status === 'running') {
          currentStage = stage;
        }
        break;
      }
    }
  }
  
  // If no running step, set current to next uncompleted stage
  if (!steps.some(s => s.status === 'running')) {
    const allStages: ResearchStage[] = ['planning', 'searching', 'analyzing', 'writing', 'reviewing'];
    for (const stage of allStages) {
      if (!completedStages.includes(stage)) {
        currentStage = stage;
        break;
      }
    }
    
    // If all completed, mark as complete
    if (completedStages.length === allStages.length) {
      currentStage = 'complete';
    }
  }
  
  return { currentStage, completedStages };
}

export default ProgressHeader;

