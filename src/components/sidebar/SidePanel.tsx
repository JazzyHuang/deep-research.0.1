'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { InteractiveCard } from '@/types/cards';
import { PlanEditor } from './PlanEditor';
import { PaperSelector } from './PaperSelector';
import { DocumentEditor } from './DocumentEditor';
import { QualityViewer } from './QualityViewer';

interface SidePanelProps {
  isOpen: boolean;
  card?: InteractiveCard;
  onClose: () => void;
  onSave: (changes: Record<string, unknown>) => void;
}

/**
 * SidePanel - Cursor 2.0 style push panel (no modal overlay)
 * Fixed to right side, pushes content instead of overlaying
 */
export function SidePanel({ isOpen, card, onClose, onSave }: SidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  
  return (
    <div
      ref={panelRef}
      className={cn(
        "fixed top-0 right-0 bottom-0",
        "w-full sm:w-[400px]",
        "bg-card border-l border-border",
        "flex flex-col",
        "shadow-2xl",
        "z-40",
        "transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header - Cursor style */}
      <div className="flex items-center justify-between h-12 px-4 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-medium">
          {card ? getPanelTitle(card.type) : '详情'}
        </h2>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose} 
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {card ? (
            <PanelContent card={card} onSave={onSave} onClose={onClose} />
          ) : (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">选择一个卡片查看详情</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function getPanelTitle(type: InteractiveCard['type']): string {
  switch (type) {
    case 'plan': return '研究计划';
    case 'paper_list': return '论文列表';
    case 'search_result': return '搜索结果';
    case 'document': return '文档编辑';
    case 'quality': return '质量报告';
    case 'citation_list': return '引用列表';
    default: return '详情';
  }
}

interface PanelContentProps {
  card: InteractiveCard;
  onSave: (changes: Record<string, unknown>) => void;
  onClose: () => void;
}

function PanelContent({ card, onSave, onClose }: PanelContentProps) {
  switch (card.data.type) {
    case 'plan':
      return (
        <PlanEditor
          data={card.data}
          onSave={(changes) => onSave({ data: { ...card.data, ...changes } })}
          onCancel={onClose}
        />
      );
    case 'paper_list':
      return (
        <PaperSelector
          data={card.data}
          onSave={(changes) => onSave({ data: { ...card.data, ...changes } })}
          onCancel={onClose}
        />
      );
    case 'document':
      return (
        <DocumentEditor
          data={card.data}
          onSave={(changes) => onSave({ data: { ...card.data, ...changes } })}
          onCancel={onClose}
        />
      );
    case 'quality':
      return <QualityViewer data={card.data} />;
    case 'search_result':
      return (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">搜索词</p>
            <p className="text-sm font-medium">{card.data.query}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">轮次</p>
            <p className="text-sm">Round {card.data.roundNumber}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">结果数量</p>
            <p className="text-sm">{card.data.resultsCount} 篇论文</p>
          </div>
          {card.data.filters && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">筛选条件</p>
              <div className="text-sm space-y-1">
                {card.data.filters.yearFrom && (
                  <p>年份: {card.data.filters.yearFrom} - {card.data.filters.yearTo || '至今'}</p>
                )}
                {card.data.filters.openAccess && (
                  <p>仅开放获取</p>
                )}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground italic">
            搜索结果不可编辑
          </p>
        </div>
      );
    default:
      return <p className="text-sm text-muted-foreground">不支持的内容类型</p>;
  }
}
