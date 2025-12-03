'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, FileText, AlertCircle, Clock, ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface HistorySession {
  id: string;
  title: string;
  query: string;
  status: 'completed' | 'running' | 'error' | 'pending';
  createdAt: number;
  citationsCount?: number;
}

interface HomeHistorySectionProps {
  sessions: HistorySession[];
  onDelete?: (sessionId: string) => void;
  className?: string;
}

/**
 * HomeHistorySection - Display recent research sessions on the home page
 * Allows users to quickly resume or view their previous research
 */
export function HomeHistorySection({ sessions, onDelete, className }: HomeHistorySectionProps) {
  const router = useRouter();

  if (sessions.length === 0) {
    return null;
  }

  const handleSessionClick = (sessionId: string) => {
    router.push(`/research/${sessionId}`);
  };

  // Take only the most recent 4 sessions
  const recentSessions = sessions.slice(0, 4);

  return (
    <div className={cn("mt-8", className)}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          Recent research
        </p>
        {sessions.length > 4 && (
          <button
            onClick={() => router.push('/history')}
            className="text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
          >
            View all
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {recentSessions.map((session, index) => (
          <HistoryCard
            key={session.id}
            session={session}
            onClick={() => handleSessionClick(session.id)}
            onDelete={onDelete ? () => onDelete(session.id) : undefined}
            style={{ animationDelay: `${index * 50}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

interface HistoryCardProps {
  session: HistorySession;
  onClick: () => void;
  onDelete?: () => void;
  style?: React.CSSProperties;
}

function HistoryCard({ session, onClick, onDelete, style }: HistoryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const timeAgo = getTimeAgo(session.createdAt);

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={onClick}
        style={style}
        className={cn(
          "group w-full text-left p-4 pr-10 rounded-xl border border-border/50 bg-card/30",
          "hover:bg-card/60 hover:border-primary/20 hover:-translate-y-0.5",
          "transition-all duration-200 ease-out",
          "history-card-enter"
        )}
      >
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
            session.status === 'completed' && "bg-status-success/10",
            session.status === 'running' && "bg-status-running/10",
            session.status === 'error' && "bg-status-error/10",
            session.status === 'pending' && "bg-muted"
          )}>
            {session.status === 'completed' ? (
              <Check className="w-4 h-4 text-status-success" />
            ) : session.status === 'running' ? (
              <Loader2 className="w-4 h-4 text-status-running animate-spin" />
            ) : session.status === 'error' ? (
              <AlertCircle className="w-4 h-4 text-status-error" />
            ) : (
              <FileText className="w-4 h-4 text-muted-foreground" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {session.title || session.query}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {session.query}
            </p>
            
            {/* Meta info */}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo}
              </span>
              {session.citationsCount !== undefined && session.citationsCount > 0 && (
                <>
                  <span>·</span>
                  <span>{session.citationsCount} citations</span>
                </>
              )}
            </div>
          </div>

          {/* Arrow indicator */}
          <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
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
            "absolute bottom-2 right-2 h-7 w-7 rounded-md transition-all duration-200",
            "text-accent hover:bg-accent/10 hover:text-accent",
            isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          aria-label="删除"
        >
          <Trash2 className="w-4 h-4" />
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
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Empty state component for when there's no history
export function EmptyHistoryState() {
  return (
    <div className="mt-8 text-center py-8">
      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
        <FileText className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">
        Your research history will appear here
      </p>
    </div>
  );
}

