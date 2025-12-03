'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Search, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { HistoryItem, type HistoryItemData } from './HistoryItem';

interface HistorySidebarProps {
  history: HistoryItemData[];
  currentSessionId?: string;
  onSelect: (sessionId: string) => void;
  onNewSession: () => void;
  onDelete?: (sessionId: string) => void;
  className?: string;
}

/**
 * HistorySidebar - Cursor 2.0 style history panel
 * Groups history by Today, Past 7 Days, and Older
 * Supports keyboard navigation (Arrow keys + Enter)
 */
export function HistorySidebar({
  history,
  currentSessionId,
  onSelect,
  onNewSession,
  onDelete,
  className,
}: HistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const listRef = useRef<HTMLDivElement>(null);
  
  // Group history items by date
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgoStart = todayStart - 7 * 24 * 60 * 60 * 1000;
  
  const filteredHistory = history.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.preview?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const todayItems = filteredHistory.filter(item => item.createdAt >= todayStart);
  const weekItems = filteredHistory.filter(item => 
    item.createdAt >= weekAgoStart && item.createdAt < todayStart
  );
  const olderItems = filteredHistory.filter(item => item.createdAt < weekAgoStart);
  
  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = filteredHistory.length;
    if (totalItems === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < totalItems) {
          onSelect(filteredHistory[focusedIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setFocusedIndex(-1);
        break;
    }
  }, [filteredHistory, focusedIndex, onSelect]);
  
  // Reset focus when search changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [searchQuery]);
  
  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.querySelector(`[data-index="${focusedIndex}"]`);
      focusedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedIndex]);
  
  // Get flat index for an item
  const getItemIndex = (itemId: string): number => {
    return filteredHistory.findIndex(item => item.id === itemId);
  };
  
  return (
    <aside className={cn(
      "w-72 bg-card border-r border-border flex flex-col min-h-0 h-full overflow-hidden",
      className
    )}>
      {/* Header with New Button */}
      <div className="p-3 border-b border-border flex-shrink-0">
        <Button 
          onClick={onNewSession}
          className="w-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">新建研究</span>
        </Button>
      </div>
      
      {/* Search */}
      <div className="p-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border focus-within:border-accent/50 transition-colors overflow-hidden">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="搜索历史..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm flex-1 min-w-0 focus:outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      
      {/* History List */}
      <ScrollArea className="flex-1 min-h-0">
        <div 
          ref={listRef}
          className="p-2 pr-4 max-w-full box-border"
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="listbox"
          aria-label="研究历史记录"
        >
          {/* Empty State */}
          {filteredHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="w-10 h-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? '未找到匹配的记录' : '暂无研究历史'}
              </p>
            </div>
          )}
          
          {/* Today */}
          {todayItems.length > 0 && (
            <HistorySection title="今天">
              {todayItems.map(item => (
                <HistoryItem
                  key={item.id}
                  item={item}
                  isActive={item.id === currentSessionId}
                  isFocused={focusedIndex === getItemIndex(item.id)}
                  dataIndex={getItemIndex(item.id)}
                  onSelect={() => onSelect(item.id)}
                  onDelete={onDelete ? () => onDelete(item.id) : undefined}
                />
              ))}
            </HistorySection>
          )}
          
          {/* Past 7 Days */}
          {weekItems.length > 0 && (
            <HistorySection title="过去7天">
              {weekItems.map(item => (
                <HistoryItem
                  key={item.id}
                  item={item}
                  isActive={item.id === currentSessionId}
                  isFocused={focusedIndex === getItemIndex(item.id)}
                  dataIndex={getItemIndex(item.id)}
                  onSelect={() => onSelect(item.id)}
                  onDelete={onDelete ? () => onDelete(item.id) : undefined}
                />
              ))}
            </HistorySection>
          )}
          
          {/* Older */}
          {olderItems.length > 0 && (
            <HistorySection title="更早">
              {olderItems.map(item => (
                <HistoryItem
                  key={item.id}
                  item={item}
                  isActive={item.id === currentSessionId}
                  isFocused={focusedIndex === getItemIndex(item.id)}
                  dataIndex={getItemIndex(item.id)}
                  onSelect={() => onSelect(item.id)}
                  onDelete={onDelete ? () => onDelete(item.id) : undefined}
                />
              ))}
            </HistorySection>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

function HistorySection({ 
  title, 
  children 
}: { 
  title: string; 
  children: React.ReactNode 
}) {
  return (
    <section className="mb-4">
      <h3 className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      <div className="space-y-0.5">
        {children}
      </div>
    </section>
  );
}


