'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { DocumentCardData } from '@/types/cards';

interface DocumentEditorProps {
  data: DocumentCardData;
  onSave: (changes: Partial<DocumentCardData>) => void;
  onCancel: () => void;
}

export function DocumentEditor({ data, onSave, onCancel }: DocumentEditorProps) {
  const [content, setContent] = useState(data.content);
  const [title, setTitle] = useState(data.title);
  
  const handleSave = () => {
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    onSave({
      title,
      content,
      wordCount,
      version: data.version + 1,
    });
  };
  
  // Calculate word count
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Title */}
      <div className="flex-shrink-0 pb-4">
        <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
          标题
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 rounded-md border bg-background text-sm font-medium"
        />
      </div>
      
      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">
            内容 (Markdown)
          </label>
          <span className="text-xs text-muted-foreground">
            {wordCount.toLocaleString()} 字
          </span>
        </div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="输入研究报告内容..."
          className="flex-1 min-h-[200px] max-h-[calc(100vh-400px)] font-mono text-sm resize-none overflow-y-auto"
        />
      </div>
      
      {/* Info */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground py-2 border-t flex-shrink-0 mt-4">
        <span>版本: v{data.version}</span>
        <span>引用: {data.citationCount}</span>
        {data.qualityScore !== undefined && (
          <span>质量分: {data.qualityScore}/100</span>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t flex-shrink-0">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          取消
        </Button>
        <Button onClick={handleSave} className="flex-1">
          保存修改
        </Button>
      </div>
    </div>
  );
}


