'use client';

import { useMemo, useState } from 'react';
import { 
  ChevronsDownUp, 
  ChevronsUpDown, 
  Activity,
  CheckCircle,
  XCircle,
  Loader2,
  Brain,
  Search,
  PenLine,
  Shield,
  CheckCircle2,
  ListTree,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ExecutionStep } from './execution-step';
import type { AgentStep } from '@/types/research';

/**
 * Agent roles for grouping steps
 */
type AgentRole = 'all' | 'planner' | 'researcher' | 'writer' | 'critic' | 'validator';

const ROLE_CONFIG: Record<AgentRole, { 
  label: string; 
  icon: React.ReactNode; 
  patterns: string[];
  color: string;
}> = {
  all: { 
    label: 'All', 
    icon: <Activity className="w-3.5 h-3.5" />,
    patterns: [],
    color: 'text-foreground',
  },
  planner: { 
    label: 'Planner', 
    icon: <Brain className="w-3.5 h-3.5" />,
    patterns: ['plan', 'thinking', 'decision', 'strategy'],
    color: 'text-purple-500',
  },
  researcher: { 
    label: 'Researcher', 
    icon: <Search className="w-3.5 h-3.5" />,
    patterns: ['search', 'literature', 'paper', 'source'],
    color: 'text-blue-500',
  },
  writer: { 
    label: 'Writer', 
    icon: <PenLine className="w-3.5 h-3.5" />,
    patterns: ['writ', 'generat', 'report', 'draft', 'final'],
    color: 'text-emerald-500',
  },
  critic: { 
    label: 'Critic', 
    icon: <Shield className="w-3.5 h-3.5" />,
    patterns: ['quality', 'review', 'critic', 'analysis', 'analyz'],
    color: 'text-amber-500',
  },
  validator: { 
    label: 'Validator', 
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    patterns: ['valid', 'citation', 'verify', 'check'],
    color: 'text-cyan-500',
  },
};

/**
 * Classify a step into an agent role
 */
function classifyStep(step: AgentStep): AgentRole {
  const searchText = `${step.name} ${step.title}`.toLowerCase();
  
  for (const [role, config] of Object.entries(ROLE_CONFIG) as [AgentRole, typeof ROLE_CONFIG[AgentRole]][]) {
    if (role === 'all') continue;
    for (const pattern of config.patterns) {
      if (searchText.includes(pattern)) {
        return role;
      }
    }
  }
  
  return 'planner'; // Default to planner for unclassified steps
}

interface ExecutionTimelineProps {
  steps: Map<string, AgentStep>;
  rootStepIds: string[];
  onToggle?: (stepId: string) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  className?: string;
  maxHeight?: string;
}

export function ExecutionTimeline({
  steps,
  rootStepIds,
  onToggle,
  onExpandAll,
  onCollapseAll,
  className,
  maxHeight = 'calc(100vh - 400px)',
}: ExecutionTimelineProps) {
  const [activeRole, setActiveRole] = useState<AgentRole>('all');
  // Calculate stats and group by role
  const { stats, roleStats, roleSteps } = useMemo(() => {
    let total = 0;
    let running = 0;
    let success = 0;
    let error = 0;
    let totalDuration = 0;
    
    const roleSteps: Record<AgentRole, string[]> = {
      all: [],
      planner: [],
      researcher: [],
      writer: [],
      critic: [],
      validator: [],
    };
    
    const roleStats: Record<AgentRole, { running: number; success: number; error: number }> = {
      all: { running: 0, success: 0, error: 0 },
      planner: { running: 0, success: 0, error: 0 },
      researcher: { running: 0, success: 0, error: 0 },
      writer: { running: 0, success: 0, error: 0 },
      critic: { running: 0, success: 0, error: 0 },
      validator: { running: 0, success: 0, error: 0 },
    };

    steps.forEach((step, stepId) => {
      total++;
      const role = classifyStep(step);
      
      roleSteps[role].push(stepId);
      roleSteps.all.push(stepId);
      
      if (step.status === 'running') {
        running++;
        roleStats[role].running++;
        roleStats.all.running++;
      }
      if (step.status === 'success') {
        success++;
        roleStats[role].success++;
        roleStats.all.success++;
      }
      if (step.status === 'error') {
        error++;
        roleStats[role].error++;
        roleStats.all.error++;
      }
      if (step.duration) totalDuration += step.duration;
    });

    return { 
      stats: { total, running, success, error, totalDuration },
      roleStats,
      roleSteps,
    };
  }, [steps]);
  
  // Get filtered root step IDs based on active role
  const filteredRootStepIds = useMemo(() => {
    if (activeRole === 'all') return rootStepIds;
    
    return rootStepIds.filter(id => {
      const step = steps.get(id);
      if (!step) return false;
      return classifyStep(step) === activeRole;
    });
  }, [rootStepIds, steps, activeRole]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Render step recursively
  const renderStep = (stepId: string, depth: number, index: number, total: number) => {
    const step = steps.get(stepId);
    if (!step) return null;

    const childSteps = step.children
      .map(childId => steps.get(childId))
      .filter((s): s is AgentStep => s !== undefined);

    return (
      <ExecutionStep
        key={step.id}
        step={step}
        depth={depth}
        isLast={index === total - 1}
        onToggle={onToggle}
      >
        {childSteps.length > 0 && (
          <div className="space-y-2">
            {childSteps.map((childStep, childIndex) =>
              renderStep(childStep.id, depth + 1, childIndex, childSteps.length)
            )}
          </div>
        )}
      </ExecutionStep>
    );
  };

  if (steps.size === 0) {
    return (
      <Card className={cn('bg-card/50 backdrop-blur', className)}>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <Activity className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">Waiting for agent execution...</p>
            <p className="text-xs mt-1 opacity-70">Steps will appear here as the agent works</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get role counts for tab badges
  const getRoleBadge = (role: AgentRole) => {
    const rs = roleStats[role];
    if (rs.running > 0) return <Badge variant="default" className="ml-1 px-1.5 h-4 text-[10px] bg-primary animate-pulse">{rs.running}</Badge>;
    if (rs.error > 0) return <Badge variant="destructive" className="ml-1 px-1.5 h-4 text-[10px]">{rs.error}</Badge>;
    if (rs.success > 0) return <Badge variant="secondary" className="ml-1 px-1.5 h-4 text-[10px]">{rs.success}</Badge>;
    return null;
  };

  return (
    <Card className={cn('bg-card/50 backdrop-blur', className)}>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-serif">
            <Activity className="w-5 h-5 text-primary" />
            Execution Timeline
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Stats */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground mr-2">
              {stats.running > 0 && (
                <span className="flex items-center gap-1 text-primary">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {stats.running}
                </span>
              )}
              {stats.success > 0 && (
                <span className="flex items-center gap-1 text-emerald-500">
                  <CheckCircle className="w-3 h-3" />
                  {stats.success}
                </span>
              )}
              {stats.error > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="w-3 h-3" />
                  {stats.error}
                </span>
              )}
              {stats.totalDuration > 0 && (
                <span className="text-muted-foreground">
                  {formatDuration(stats.totalDuration)}
                </span>
              )}
            </div>
            
            {/* Expand/Collapse buttons */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onExpandAll}
              className="h-7 px-2"
              title="Expand all"
            >
              <ChevronsUpDown className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCollapseAll}
              className="h-7 px-2"
              title="Collapse all"
            >
              <ChevronsDownUp className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Agent Role Tabs - Cursor 2.0 Style */}
        <Tabs value={activeRole} onValueChange={(v) => setActiveRole(v as AgentRole)} className="w-full">
          <div className="border-b border-border/50 px-4 pt-3">
            <TabsList className="h-8 bg-transparent p-0 gap-1">
              {(Object.entries(ROLE_CONFIG) as [AgentRole, typeof ROLE_CONFIG[AgentRole]][]).map(([role, config]) => (
                <TabsTrigger 
                  key={role}
                  value={role}
                  className={cn(
                    "h-7 px-3 text-xs gap-1.5 rounded-full data-[state=active]:shadow-sm",
                    "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
                    role !== 'all' && `data-[state=active]:${config.color}`
                  )}
                >
                  {config.icon}
                  <span className="hidden sm:inline">{config.label}</span>
                  {getRoleBadge(role)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          
          <TabsContent value={activeRole} className="m-0">
            <ScrollArea style={{ maxHeight }} className="min-h-[200px]">
              <div className="p-4 space-y-2">
                {filteredRootStepIds.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className={cn("mb-2", ROLE_CONFIG[activeRole].color)}>
                      {ROLE_CONFIG[activeRole].icon}
                    </div>
                    <p className="text-sm">No {ROLE_CONFIG[activeRole].label.toLowerCase()} steps yet</p>
                  </div>
                ) : (
                  filteredRootStepIds.map((stepId, index) =>
                    renderStep(stepId, 0, index, filteredRootStepIds.length)
                  )
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Lightweight timeline for sidebar/compact view
interface CompactTimelineProps {
  steps: Map<string, AgentStep>;
  rootStepIds: string[];
  className?: string;
}

export function CompactTimeline({ steps, rootStepIds, className }: CompactTimelineProps) {
  const activeSteps = useMemo(() => {
    const active: AgentStep[] = [];
    steps.forEach(step => {
      if (step.status === 'running') {
        active.push(step);
      }
    });
    return active;
  }, [steps]);

  const recentSteps = useMemo(() => {
    const all = Array.from(steps.values());
    return all
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 5);
  }, [steps]);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Currently running */}
      {activeSteps.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-primary uppercase tracking-wider flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Running
          </span>
          {activeSteps.map(step => (
            <div
              key={step.id}
              className="text-xs bg-primary/10 border border-primary/20 rounded px-2 py-1 animate-pulse"
            >
              {step.title}
            </div>
          ))}
        </div>
      )}

      {/* Recent steps */}
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Recent ({steps.size} total)
        </span>
        {recentSteps.map(step => (
          <div
            key={step.id}
            className={cn(
              'text-xs rounded px-2 py-1 flex items-center gap-2',
              step.status === 'success' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
              step.status === 'error' && 'bg-destructive/10 text-destructive',
              step.status === 'running' && 'bg-primary/10 text-primary',
              step.status === 'waiting' && 'bg-muted text-muted-foreground'
            )}
          >
            <span className="truncate flex-1">{step.title}</span>
            {step.duration && (
              <span className="text-[10px] opacity-70">
                {step.duration < 1000 ? `${step.duration}ms` : `${(step.duration / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}



