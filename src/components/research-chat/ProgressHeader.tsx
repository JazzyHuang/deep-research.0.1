'use client';

import { useMemo } from 'react';
import { 
  Brain, 
  Search, 
  FileText, 
  PenTool, 
  CheckCircle2, 
  Circle,
  Loader2 
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
  icon: React.ReactNode;
}

const STAGES: StageConfig[] = [
  { id: 'planning', label: '规划', icon: <Brain className="w-3.5 h-3.5" /> },
  { id: 'searching', label: '检索', icon: <Search className="w-3.5 h-3.5" /> },
  { id: 'analyzing', label: '分析', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'writing', label: '撰写', icon: <PenTool className="w-3.5 h-3.5" /> },
  { id: 'reviewing', label: '审核', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
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
 * ProgressHeader - Sticky progress indicator showing research stages
 * 
 * Displays a horizontal progress bar with stages:
 * Planning → Searching → Analyzing → Writing → Review
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
    const currentIndex = STAGES.findIndex(s => s.id === currentStage);
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
      "sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50",
      "px-4 py-3",
      className
    )}>
      {/* Progress bar background */}
      <div className="relative">
        {/* Track */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-border rounded-full" />
        
        {/* Progress fill */}
        <div 
          className="absolute top-4 left-4 h-0.5 bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `calc(${progressPercent}% - 2rem)` }}
        />
        
        {/* Stage indicators */}
        <div className="relative flex items-center justify-between">
          {STAGES.map((stage, index) => {
            const status = stageStatuses[index];
            
            return (
              <div key={stage.id} className="flex flex-col items-center gap-1.5">
                {/* Stage circle */}
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                  "border-2",
                  status === 'completed' && "bg-primary border-primary text-primary-foreground",
                  status === 'current' && "bg-background border-primary text-primary",
                  status === 'pending' && "bg-background border-muted-foreground/30 text-muted-foreground/50"
                )}>
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : status === 'current' && isActive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    stage.icon
                  )}
                </div>
                
                {/* Stage label */}
                <span className={cn(
                  "text-xs font-medium transition-colors",
                  status === 'completed' && "text-primary",
                  status === 'current' && "text-foreground",
                  status === 'pending' && "text-muted-foreground/50"
                )}>
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Current step and time remaining */}
      <div className="mt-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {isActive && currentStepName && (
            <>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {currentStepName}
              </span>
            </>
          )}
          {!isActive && currentStage === 'complete' && (
            <span className="text-primary font-medium">研究完成</span>
          )}
        </div>
        
        {formattedTime && isActive && (
          <span className="text-muted-foreground">
            预计剩余 {formattedTime}
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

