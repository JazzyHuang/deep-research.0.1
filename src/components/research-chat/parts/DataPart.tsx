'use client';

import { cn } from '@/lib/utils';
import { BaseCard } from '@/components/cards';
import type { 
  ResearchDataParts,
  InteractiveCard,
  CheckpointData,
  LogLineData,
  SummaryBlockData,
} from '@/types/ui-message';
import { 
  Search, Filter, FileText, PenTool, Check, Info, 
  AlertTriangle, Database, ChevronRight, AlertCircle,
  CircleDot
} from 'lucide-react';

// ============================================================================
// Data Part Props
// ============================================================================

interface DataPartProps {
  type: string;
  id?: string;
  data: unknown;
  onCardClick?: (cardId: string) => void;
  onCheckpointAction?: (checkpointId: string, action: string) => void;
  className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

// Log line icons
const logIcons: Record<string, React.ReactNode> = {
  search: <Search className="w-3 h-3" />,
  filter: <Filter className="w-3 h-3" />,
  analyze: <FileText className="w-3 h-3" />,
  write: <PenTool className="w-3 h-3" />,
  check: <Check className="w-3 h-3" />,
  info: <Info className="w-3 h-3" />,
  warning: <AlertTriangle className="w-3 h-3" />,
  database: <Database className="w-3 h-3" />,
};

function LogLineRenderer({ data }: { data: LogLineData }) {
  const icon = data.icon ? logIcons[data.icon] : <ChevronRight className="w-3 h-3" />;
  
  return (
    <div className="flex items-start gap-2 py-1 text-xs text-muted-foreground/70 log-entry-enter">
      <span className="mt-0.5 opacity-60 flex-shrink-0">{icon}</span>
      <span className="leading-relaxed">{data.text}</span>
    </div>
  );
}

function SummaryRenderer({ data }: { data: SummaryBlockData }) {
  return (
    <div className="py-3 px-4 my-3 rounded-xl bg-card border border-border/50 shadow-sm summary-block-enter">
      {data.title && (
        <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
          {data.title}
        </div>
      )}
      <div className="text-sm text-foreground leading-relaxed">
        {data.content}
      </div>
      {data.bulletPoints && data.bulletPoints.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {data.bulletPoints.map((point, i) => (
            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
              <span className="text-primary mt-1.5 flex-shrink-0">
                <CircleDot className="w-2 h-2" />
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * CheckpointRenderer - Redesigned for prominence
 * 
 * Features:
 * - Full-width design with clear visual separation
 * - Pulsing border animation to draw attention
 * - Improved button styling with hover effects
 */
function CheckpointRenderer({ 
  data, 
  onAction 
}: { 
  data: CheckpointData;
  onAction?: (action: string) => void;
}) {
  if (data.resolvedAt) {
    // Already resolved - show minimal indicator
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground/70">
        <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center">
          <Check className="w-3 h-3 text-green-500" />
        </div>
        <span>{data.title}</span>
        <span className="text-muted-foreground/50">· {data.resolution || '已确认'}</span>
      </div>
    );
  }
  
  return (
    <div className="checkpoint-container my-4 animate-in slide-in-from-bottom-2 duration-300">
      {/* Checkpoint card with prominent styling */}
      <div className={cn(
        "relative rounded-xl border-2 border-amber-500/60 bg-card overflow-hidden",
        "shadow-lg shadow-amber-500/10",
        "checkpoint-pulse-border"
      )}>
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" />
        
        {/* Content */}
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-foreground">
                {data.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {data.description}
              </p>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {data.options.map((option) => (
              <button
                key={option.id}
                onClick={() => onAction?.(option.action)}
                className={cn(
                  "flex-1 min-w-[120px] px-4 py-2.5 rounded-lg text-sm font-medium",
                  "transition-all duration-200",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  option.variant === 'primary' && [
                    "bg-amber-500 text-white",
                    "hover:bg-amber-600",
                    "shadow-sm shadow-amber-500/30"
                  ],
                  option.variant === 'secondary' && [
                    "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                    "hover:bg-amber-500/20"
                  ],
                  option.variant === 'outline' && [
                    "border border-border bg-background",
                    "hover:bg-muted"
                  ]
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          
          {/* Help text */}
          <p className="mt-4 text-xs text-muted-foreground/60 text-center">
            请选择操作以继续研究流程
          </p>
        </div>
      </div>
    </div>
  );
}

function CardRenderer({ 
  type, 
  id, 
  data, 
  onCardClick 
}: { 
  type: string;
  id: string;
  data: ResearchDataParts[keyof ResearchDataParts];
  onCardClick?: (cardId: string) => void;
}) {
  // Build card object from data part
  const cardType = type.replace('data-', '') as InteractiveCard['type'];
  
  const card: InteractiveCard = {
    id,
    type: cardType,
    title: getCardTitle(cardType, data),
    data: data as InteractiveCard['data'],
    status: 'pending',
    isCollapsed: false,
    isCheckpoint: false,
    createdAt: Date.now(),
  };
  
  return (
    <div className="py-2">
      <BaseCard
        card={card}
        onTitleClick={() => onCardClick?.(id)}
        animate={true}
      />
    </div>
  );
}

function getCardTitle(type: string, data: unknown): string {
  switch (type) {
    case 'plan':
      return '研究计划';
    case 'paper-list':
      const paperData = data as ResearchDataParts['paper-list'];
      return `检索结果 · Round ${paperData.roundNumber}`;
    case 'quality':
      return '质量评估报告';
    case 'document':
      return '研究报告';
    default:
      return type;
  }
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * DataPart - Renders custom data parts from the stream
 * 
 * Handles various data-* part types:
 * - Cards: plan, paper-list, quality, document
 * - UI elements: log-line, summary, notification
 * - Flow control: checkpoint, agent-step, session-*
 */
export function DataPart({ 
  type, 
  id, 
  data, 
  onCardClick,
  onCheckpointAction,
  className 
}: DataPartProps) {
  // Handle different data part types
  switch (type) {
    // Cards
    case 'data-plan':
    case 'data-paper-list':
    case 'data-quality':
    case 'data-document':
      if (id) {
        return (
          <div className={className}>
            <CardRenderer 
              type={type} 
              id={id} 
              data={data as ResearchDataParts[keyof ResearchDataParts]} 
              onCardClick={onCardClick}
            />
          </div>
        );
      }
      return null;
    
    // Checkpoint
    case 'data-checkpoint':
      return (
        <div className={className}>
          <CheckpointRenderer 
            data={data as CheckpointData}
            onAction={(action) => {
              const checkpoint = data as CheckpointData;
              onCheckpointAction?.(checkpoint.id, action);
            }}
          />
        </div>
      );
    
    // Agent steps - rendered by AgentTimeline, not individually
    case 'data-agent-step':
      // AgentTimeline aggregates and renders all steps together
      return null;
    
    // Log lines
    case 'data-log-line':
      return (
        <div className={className}>
          <LogLineRenderer data={data as LogLineData} />
        </div>
      );
    
    // Summary blocks
    case 'data-summary':
      return (
        <div className={className}>
          <SummaryRenderer data={data as SummaryBlockData} />
        </div>
      );
    
    // Notifications (transient - usually handled separately)
    case 'data-notification':
      // Notifications are transient and typically shown as toasts
      return null;
    
    // Session control events
    case 'data-session-complete':
    case 'data-session-error':
    case 'data-agent-paused':
    case 'data-step-complete':
      // These are typically handled at the hook level
      return null;
    
    default:
      // Unknown data part - render as JSON in dev mode
      if (process.env.NODE_ENV === 'development') {
        return (
          <div className={cn('text-xs text-muted-foreground/60 py-1', className)}>
            <pre className="overflow-x-auto p-2 rounded bg-muted/50">
              {JSON.stringify({ type, id, data }, null, 2)}
            </pre>
          </div>
        );
      }
      return null;
  }
}

export default DataPart;
