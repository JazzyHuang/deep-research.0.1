'use client';

import { useState } from 'react';
import { Check, Loader2, FileText, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface HistoryItemData {
  id: string;
  title: string;
  preview?: string;
  status: 'completed' | 'running' | 'error' | 'draft';
  createdAt: number;
  citationCount?: number;
}

interface HistoryItemProps {
  item: HistoryItemData;
  isActive?: boolean;
  isFocused?: boolean;
  dataIndex?: number;
  onSelect: () => void;
  onDelete?: () => void;
}

/**
 * HistoryItem - Cursor 2.0 style history list item
 * Supports keyboard focus state for navigation
 */
export function HistoryItem({ 
  item, 
  isActive,
  isFocused,
  dataIndex,
  onSelect, 
  onDelete 
}: HistoryItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const timeAgo = getTimeAgo(item.createdAt);
  
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative"
    >
      <button
        onClick={onSelect}
        data-index={dataIndex}
        role="option"
        aria-selected={isActive}
        className={cn(
          "group w-full max-w-full flex items-start gap-2.5 p-2 pr-8 rounded-lg text-left transition-colors overflow-hidden box-border",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
          isActive 
            ? "bg-accent/10 border border-accent/20" 
            : "hover:bg-muted/50",
          isFocused && !isActive && "bg-muted/70 ring-1 ring-accent/30"
        )}
      >
        {/* Status Icon */}
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
          item.status === 'completed' && "bg-status-success/10",
          item.status === 'running' && "bg-status-running/10",
          item.status === 'error' && "bg-status-error/10",
          item.status === 'draft' && "bg-muted"
        )}>
          {item.status === 'completed' ? (
            <Check className="w-3.5 h-3.5 text-status-success" />
          ) : item.status === 'running' ? (
            <Loader2 className="w-3.5 h-3.5 text-status-running animate-spin" />
          ) : item.status === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5 text-status-error" />
          ) : (
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0 text-left overflow-hidden">
          <div className={cn(
            "text-sm font-medium truncate",
            isActive ? "text-accent" : "text-foreground"
          )}>
            {item.title}
          </div>
          
          {/* Preview text */}
          {item.preview && (
            <p className="text-xs text-muted-foreground truncate mt-0.5 overflow-hidden">
              {item.preview}
            </p>
          )}
          
          {/* Meta info */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 min-w-0 overflow-hidden">
            <span className="truncate flex-shrink-0">{timeAgo}</span>
            {item.citationCount !== undefined && item.citationCount > 0 && (
              <>
                <span className="flex-shrink-0">·</span>
                <span className="truncate">{item.citationCount} 引用</span>
              </>
            )}
          </div>
        </div>
      </button>
      
      {/* Delete button - positioned at bottom right corner */}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={cn(
            "absolute bottom-1.5 right-1.5 h-6 w-6 rounded-md transition-all duration-200",
            "text-accent hover:bg-accent/10 hover:text-accent",
            isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          aria-label="删除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}


