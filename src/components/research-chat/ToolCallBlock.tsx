'use client';

import { useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToolStatus = 'running' | 'success' | 'error' | 'pending';

interface ToolCallBlockProps {
  tool: string;
  args?: Record<string, unknown>;
  result?: string;
  status: ToolStatus;
  duration?: number;
}

/**
 * ToolCallBlock - Cursor 2.0 style tool call indicator
 * Features: ⬢ status icon, collapsible args/result
 */
export function ToolCallBlock({ 
  tool, 
  args, 
  result, 
  status,
  duration 
}: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const toolLabel = getToolLabel(tool);
  
  return (
    <div className="my-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        {/* Status hexagon icon */}
        <span className={cn(
          status === 'running' && "text-status-running animate-pulse",
          status === 'success' && "text-status-success",
          status === 'error' && "text-status-error",
          status === 'pending' && "text-status-pending"
        )}>
          ⬢
        </span>
        
        <span className="font-medium">{toolLabel}</span>
        
        {status === 'running' && (
          <Loader2 className="w-3 h-3 animate-spin text-status-running" />
        )}
        
        {duration !== undefined && status !== 'running' && (
          <span className="text-muted-foreground">{duration}s</span>
        )}
        
        {(args || result) && (
          <ChevronRight className={cn(
            "w-3 h-3 transition-transform duration-200",
            isExpanded && "rotate-90"
          )} />
        )}
      </button>
      
      {/* Expanded content */}
      {isExpanded && (args || result) && (
        <div className="mt-2 pl-5 text-xs font-mono bg-muted/50 rounded-lg p-3 border border-border">
          {args && (
            <div className="mb-2">
              <span className="text-muted-foreground">Args:</span>
              <pre className="mt-1 text-foreground overflow-x-auto">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div>
              <span className="text-muted-foreground">Result:</span>
              <pre className="mt-1 text-foreground overflow-x-auto whitespace-pre-wrap">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getToolLabel(tool: string): string {
  const labels: Record<string, string> = {
    'search_papers': '搜索论文',
    'read_paper': '阅读论文',
    'analyze_citations': '分析引用',
    'generate_outline': '生成大纲',
    'write_section': '撰写章节',
    'check_quality': '质量检查',
    'web_search': '网络搜索',
    'thinking': '思考中',
  };
  
  return labels[tool] || tool;
}







