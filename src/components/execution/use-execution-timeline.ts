'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { 
  AgentStep, 
  AgentStepLog, 
  ExtendedStreamEvent, 
  AgentStreamEvent,
  isAgentStepEvent 
} from '@/types/research';

export interface ExecutionTimelineState {
  steps: Map<string, AgentStep>;
  rootStepIds: string[];
  isComplete: boolean;
  error?: string;
}

export interface UseExecutionTimelineReturn {
  state: ExecutionTimelineState;
  handleEvent: (event: ExtendedStreamEvent) => void;
  toggleCollapse: (stepId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  getStep: (stepId: string) => AgentStep | undefined;
  getChildSteps: (stepId: string) => AgentStep[];
  reset: () => void;
}

const initialState: ExecutionTimelineState = {
  steps: new Map(),
  rootStepIds: [],
  isComplete: false,
};

export function useExecutionTimeline(): UseExecutionTimelineReturn {
  const [state, setState] = useState<ExecutionTimelineState>(initialState);
  
  // Use refs for performance during rapid updates
  const stepsRef = useRef<Map<string, AgentStep>>(new Map());
  const rootStepIdsRef = useRef<string[]>([]);
  const pendingUpdates = useRef<boolean>(false);

  // Batch DOM updates using requestAnimationFrame
  const scheduleUpdate = useCallback(() => {
    if (pendingUpdates.current) return;
    
    pendingUpdates.current = true;
    requestAnimationFrame(() => {
      setState({
        steps: new Map(stepsRef.current),
        rootStepIds: [...rootStepIdsRef.current],
        isComplete: state.isComplete,
        error: state.error,
      });
      pendingUpdates.current = false;
    });
  }, [state.isComplete, state.error]);

  const handleStepStart = useCallback((step: AgentStep) => {
    stepsRef.current.set(step.id, step);
    
    if (!step.parentId) {
      rootStepIdsRef.current.push(step.id);
    } else {
      // Add as child to parent
      const parent = stepsRef.current.get(step.parentId);
      if (parent && !parent.children.includes(step.id)) {
        parent.children = [...parent.children, step.id];
        stepsRef.current.set(step.parentId, parent);
      }
    }
    
    scheduleUpdate();
  }, [scheduleUpdate]);

  const handleStepUpdate = useCallback((
    stepId: string, 
    updates: Partial<Omit<AgentStep, 'id'>>
  ) => {
    const step = stepsRef.current.get(stepId);
    if (step) {
      stepsRef.current.set(stepId, { ...step, ...updates });
      scheduleUpdate();
    }
  }, [scheduleUpdate]);

  const handleStepLog = useCallback((stepId: string, log: AgentStepLog) => {
    const step = stepsRef.current.get(stepId);
    if (step) {
      stepsRef.current.set(stepId, {
        ...step,
        logs: [...step.logs, log],
      });
      scheduleUpdate();
    }
  }, [scheduleUpdate]);

  const handleStepComplete = useCallback((
    stepId: string,
    output?: AgentStep['output'],
    status?: AgentStep['status'],
    duration?: number
  ) => {
    const step = stepsRef.current.get(stepId);
    if (step) {
      stepsRef.current.set(stepId, {
        ...step,
        status: status || 'success',
        output: output || step.output,
        endTime: Date.now(),
        duration: duration || (Date.now() - step.startTime),
      });
      scheduleUpdate();
    }
  }, [scheduleUpdate]);

  const handleStepError = useCallback((
    stepId: string,
    error: AgentStep['error']
  ) => {
    const step = stepsRef.current.get(stepId);
    if (step) {
      stepsRef.current.set(stepId, {
        ...step,
        status: 'error',
        error,
        endTime: Date.now(),
        duration: Date.now() - step.startTime,
      });
      scheduleUpdate();
    }
  }, [scheduleUpdate]);

  const handleEvent = useCallback((event: ExtendedStreamEvent) => {
    // Check if it's an agent step event
    if (!event.type.startsWith('agent_step_')) return;
    
    const agentEvent = event as AgentStreamEvent;
    
    switch (agentEvent.type) {
      case 'agent_step_start':
        handleStepStart(agentEvent.step);
        break;
      case 'agent_step_update':
        handleStepUpdate(agentEvent.stepId, agentEvent.updates);
        break;
      case 'agent_step_log':
        handleStepLog(agentEvent.stepId, agentEvent.log);
        break;
      case 'agent_step_complete':
        handleStepComplete(
          agentEvent.stepId,
          agentEvent.output,
          agentEvent.status,
          agentEvent.duration
        );
        break;
      case 'agent_step_error':
        handleStepError(agentEvent.stepId, agentEvent.error);
        break;
    }
  }, [handleStepStart, handleStepUpdate, handleStepLog, handleStepComplete, handleStepError]);

  const toggleCollapse = useCallback((stepId: string) => {
    const step = stepsRef.current.get(stepId);
    if (step) {
      stepsRef.current.set(stepId, {
        ...step,
        collapsed: !step.collapsed,
      });
      setState(prev => ({
        ...prev,
        steps: new Map(stepsRef.current),
      }));
    }
  }, []);

  const expandAll = useCallback(() => {
    stepsRef.current.forEach((step, id) => {
      stepsRef.current.set(id, { ...step, collapsed: false });
    });
    setState(prev => ({
      ...prev,
      steps: new Map(stepsRef.current),
    }));
  }, []);

  const collapseAll = useCallback(() => {
    stepsRef.current.forEach((step, id) => {
      stepsRef.current.set(id, { ...step, collapsed: true });
    });
    setState(prev => ({
      ...prev,
      steps: new Map(stepsRef.current),
    }));
  }, []);

  const getStep = useCallback((stepId: string) => {
    return state.steps.get(stepId);
  }, [state.steps]);

  const getChildSteps = useCallback((stepId: string) => {
    const step = state.steps.get(stepId);
    if (!step) return [];
    
    return step.children
      .map(childId => state.steps.get(childId))
      .filter((s): s is AgentStep => s !== undefined);
  }, [state.steps]);

  const reset = useCallback(() => {
    stepsRef.current = new Map();
    rootStepIdsRef.current = [];
    setState(initialState);
  }, []);

  return {
    state,
    handleEvent,
    toggleCollapse,
    expandAll,
    collapseAll,
    getStep,
    getChildSteps,
    reset,
  };
}









