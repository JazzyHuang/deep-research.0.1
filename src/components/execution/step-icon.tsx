'use client';

import { 
  Brain, 
  Wrench, 
  Sparkles, 
  Shield, 
  GitBranch, 
  Search, 
  BarChart3,
  type LucideIcon 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentStepType } from '@/types/research';

interface StepIconProps {
  type: AgentStepType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const iconMap: Record<AgentStepType, { icon: LucideIcon; color: string }> = {
  thinking: { icon: Brain, color: 'text-blue-500 dark:text-blue-400' },
  tool_call: { icon: Wrench, color: 'text-amber-500 dark:text-amber-400' },
  llm_generation: { icon: Sparkles, color: 'text-purple-500 dark:text-purple-400' },
  validation: { icon: Shield, color: 'text-emerald-500 dark:text-emerald-400' },
  decision: { icon: GitBranch, color: 'text-cyan-500 dark:text-cyan-400' },
  search: { icon: Search, color: 'text-orange-500 dark:text-orange-400' },
  analysis: { icon: BarChart3, color: 'text-pink-500 dark:text-pink-400' },
};

const sizeMap = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export function StepIcon({ type, className, size = 'md' }: StepIconProps) {
  const { icon: Icon, color } = iconMap[type] || iconMap.thinking;
  
  return (
    <Icon className={cn(sizeMap[size], color, className)} />
  );
}

export function getStepIconConfig(type: AgentStepType) {
  return iconMap[type] || iconMap.thinking;
}









