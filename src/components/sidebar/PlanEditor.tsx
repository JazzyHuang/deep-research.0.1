'use client';

import { useState } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { PlanCardData } from '@/types/cards';

interface PlanEditorProps {
  data: PlanCardData;
  onSave: (changes: Partial<PlanCardData>) => void;
  onCancel: () => void;
}

export function PlanEditor({ data, onSave, onCancel }: PlanEditorProps) {
  const [mainQuestion, setMainQuestion] = useState(data.plan.mainQuestion);
  const [subQuestions, setSubQuestions] = useState([...data.plan.subQuestions]);
  const [searchStrategies, setSearchStrategies] = useState(
    data.plan.searchStrategies.map(s => s.query)
  );
  const [newSubQuestion, setNewSubQuestion] = useState('');
  const [newStrategy, setNewStrategy] = useState('');
  
  const handleAddSubQuestion = () => {
    if (newSubQuestion.trim()) {
      setSubQuestions([...subQuestions, newSubQuestion.trim()]);
      setNewSubQuestion('');
    }
  };
  
  const handleRemoveSubQuestion = (index: number) => {
    setSubQuestions(subQuestions.filter((_, i) => i !== index));
  };
  
  const handleUpdateSubQuestion = (index: number, value: string) => {
    setSubQuestions(subQuestions.map((q, i) => i === index ? value : q));
  };
  
  const handleAddStrategy = () => {
    if (newStrategy.trim()) {
      setSearchStrategies([...searchStrategies, newStrategy.trim()]);
      setNewStrategy('');
    }
  };
  
  const handleRemoveStrategy = (index: number) => {
    setSearchStrategies(searchStrategies.filter((_, i) => i !== index));
  };
  
  const handleUpdateStrategy = (index: number, value: string) => {
    setSearchStrategies(searchStrategies.map((s, i) => i === index ? value : s));
  };
  
  const handleSave = () => {
    onSave({
      plan: {
        ...data.plan,
        mainQuestion,
        subQuestions,
        searchStrategies: searchStrategies.map(query => ({ query })),
      },
      summary: {
        subQuestionsCount: subQuestions.length,
        searchStrategiesCount: searchStrategies.length,
        expectedSectionsCount: data.summary.expectedSectionsCount,
      },
    });
  };
  
  return (
    <div className="space-y-6">
      {/* Main Question */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
          主题
        </label>
        <Textarea
          value={mainQuestion}
          onChange={(e) => setMainQuestion(e.target.value)}
          placeholder="研究主题"
          className="min-h-[80px] resize-none"
        />
      </div>
      
      {/* Sub Questions */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
          子问题
        </label>
        <div className="space-y-2">
          {subQuestions.map((q, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <GripVertical className="w-4 h-4 text-muted-foreground/50 cursor-grab" />
              <Input
                value={q}
                onChange={(e) => handleUpdateSubQuestion(i, e.target.value)}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveSubQuestion(i)}
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          {/* Add new sub question */}
          <div className="flex items-center gap-2">
            <div className="w-4" /> {/* Spacer for alignment */}
            <Input
              value={newSubQuestion}
              onChange={(e) => setNewSubQuestion(e.target.value)}
              placeholder="添加子问题..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSubQuestion();
                }
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAddSubQuestion}
              disabled={!newSubQuestion.trim()}
              className="h-8 w-8"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Search Strategies */}
      <div>
        <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
          搜索策略
        </label>
        <div className="space-y-2">
          {searchStrategies.map((s, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
              <Input
                value={s}
                onChange={(e) => handleUpdateStrategy(i, e.target.value)}
                className="flex-1 font-mono text-sm"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveStrategy(i)}
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          {/* Add new strategy */}
          <div className="flex items-center gap-2">
            <div className="w-4" />
            <Input
              value={newStrategy}
              onChange={(e) => setNewStrategy(e.target.value)}
              placeholder="添加搜索策略..."
              className="flex-1 font-mono text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddStrategy();
                }
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAddStrategy}
              disabled={!newStrategy.trim()}
              className="h-8 w-8"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
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







