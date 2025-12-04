'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TodoItem, TaskProgress } from '@/types/conversation';

interface TodoProgressProps {
  taskProgress: TaskProgress;
  className?: string;
}

/**
 * TodoProgress - Displays task progress with collapsible todo list
 * Positioned above the input area, shows completion status
 */
export function TodoProgress({ taskProgress, className }: TodoProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { todos, currentPhase } = taskProgress;
  const completedCount = todos.filter(t => t.status === 'completed').length;
  const totalCount = todos.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isAllComplete = completedCount === totalCount && totalCount > 0;
  
  if (totalCount === 0) return null;
  
  return (
    <div className={cn("mb-3", className)}>
      {/* Collapsed Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg",
          "text-left transition-colors",
          "hover:bg-muted/50",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        {/* Expand/Collapse Icon */}
        <div className="text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </div>
        
        {/* Progress Text */}
        <div className="flex-1 flex items-center gap-2">
          <span className={cn(
            "text-sm font-medium",
            isAllComplete ? "text-primary" : "text-foreground"
          )}>
            {completedCount} of {totalCount} To-dos Completed
          </span>
          
          {/* Current Phase Badge */}
          {currentPhase && !isAllComplete && (
            <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
              {currentPhase}
            </span>
          )}
        </div>
        
        {/* Progress Bar */}
        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              isAllComplete ? "bg-primary" : "bg-primary/70"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </button>
      
      {/* Expanded Todo List */}
      {isExpanded && (
        <div className="mt-2 ml-7 space-y-1 animate-collapsible-down">
          {todos.map((todo, index) => (
            <TodoItemRow 
              key={todo.id} 
              todo={todo} 
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TodoItemRowProps {
  todo: TodoItem;
  index: number;
}

function TodoItemRow({ todo, index }: TodoItemRowProps) {
  const isCompleted = todo.status === 'completed';
  const isInProgress = todo.status === 'in_progress';
  
  return (
    <div 
      className={cn(
        "flex items-start gap-2 py-1.5 px-2 rounded-md transition-all",
        "log-entry-enter",
        isInProgress && "bg-primary/5"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Status Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {isCompleted ? (
          <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center todo-check-animate">
            <Check className="w-3 h-3 text-primary" />
          </div>
        ) : isInProgress ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground/50" />
        )}
      </div>
      
      {/* Todo Text */}
      <span className={cn(
        "text-sm leading-relaxed",
        isCompleted && "text-muted-foreground line-through",
        isInProgress && "text-foreground font-medium",
        !isCompleted && !isInProgress && "text-muted-foreground"
      )}>
        {todo.text}
      </span>
    </div>
  );
}

export default TodoProgress;






