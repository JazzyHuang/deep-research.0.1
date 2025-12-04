'use client';

import { cn } from '@/lib/utils';
import { BaseCard } from '@/components/cards';
import type { 
  ResearchDataParts,
  InteractiveCard,
  LogLineData,
  SummaryBlockData,
} from '@/types/ui-message';
import { 
  Search, Filter, FileText, PenTool, Check, Info, 
  AlertTriangle, Database, ChevronRight,
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
    <div className="stream-card py-3">
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
    
    // Checkpoint - handled at card level in ResearchStream
    case 'data-checkpoint':
      // Checkpoints are now embedded as actions in their associated cards
      return null;
    
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
