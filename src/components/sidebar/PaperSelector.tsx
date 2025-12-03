'use client';

import { useState } from 'react';
import { ExternalLink, Check, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PaperListCardData } from '@/types/cards';

interface PaperSelectorProps {
  data: PaperListCardData;
  onSave: (changes: Partial<PaperListCardData>) => void;
  onCancel: () => void;
}

export function PaperSelector({ data, onSave, onCancel }: PaperSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(data.selectedPaperIds || data.papers.map(p => p.id))
  );
  const [excludedIds, setExcludedIds] = useState<Set<string>>(
    new Set(data.excludedPaperIds || [])
  );
  
  const togglePaper = (paperId: string) => {
    const newSelected = new Set(selectedIds);
    const newExcluded = new Set(excludedIds);
    
    if (selectedIds.has(paperId)) {
      newSelected.delete(paperId);
      newExcluded.add(paperId);
    } else {
      newSelected.add(paperId);
      newExcluded.delete(paperId);
    }
    
    setSelectedIds(newSelected);
    setExcludedIds(newExcluded);
  };
  
  const handleSave = () => {
    onSave({
      selectedPaperIds: Array.from(selectedIds),
      excludedPaperIds: Array.from(excludedIds),
    });
  };
  
  const selectAll = () => {
    setSelectedIds(new Set(data.papers.map(p => p.id)));
    setExcludedIds(new Set());
  };
  
  const selectNone = () => {
    setSelectedIds(new Set());
    setExcludedIds(new Set(data.papers.map(p => p.id)));
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 flex-shrink-0">
        <p className="text-sm text-muted-foreground">
          已选择 {selectedIds.size} / {data.papers.length} 篇
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={selectAll}>全选</Button>
          <Button variant="ghost" size="sm" onClick={selectNone}>全不选</Button>
        </div>
      </div>
      
      {/* Paper List */}
      <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
        {data.papers.map((paper) => {
          const isSelected = selectedIds.has(paper.id);
          
          return (
            <div
              key={paper.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                isSelected 
                  ? "border-primary/50 bg-primary/5" 
                  : "border-border hover:border-muted-foreground/30"
              )}
              onClick={() => togglePaper(paper.id)}
            >
              {/* Checkbox */}
              <button
                className={cn(
                  "flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors mt-0.5",
                  isSelected
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/30"
                )}
              >
                {isSelected ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Circle className="w-2 h-2 text-muted-foreground/30" />
                )}
              </button>
              
              {/* Paper Info */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium line-clamp-2",
                  !isSelected && "text-muted-foreground"
                )}>
                  {paper.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {paper.authors?.slice(0, 3).map(a => a.name).join(', ')}
                  {paper.authors && paper.authors.length > 3 && ' et al.'}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{paper.journal || 'Unknown Journal'}</span>
                  <span>·</span>
                  <span>{paper.year}</span>
                  {paper.citations !== undefined && (
                    <>
                      <span>·</span>
                      <span>引用 {paper.citations}</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* External Link */}
              {(paper.doi || paper.sourceUrl) && (
                <a
                  href={paper.doi ? `https://doi.org/${paper.doi}` : paper.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-shrink-0 p-1.5 hover:bg-muted rounded transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t mt-4 flex-shrink-0 bg-card">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          取消
        </Button>
        <Button onClick={handleSave} className="flex-1">
          保存选择
        </Button>
      </div>
    </div>
  );
}

