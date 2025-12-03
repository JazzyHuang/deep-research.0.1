/**
 * Centralized AI Model Configuration
 * 
 * Model Strategy:
 * - Grok 4.1 Fast: Search + tool scheduling brain (2M context, fast reasoning)
 * - Gemini 2.5 Flash: Final writing & serious reasoning (with thinking mode)
 * - Gemini 2.5 Flash-Lite: Bulk/repetitive medium-light tasks (high throughput)
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// Initialize OpenRouter provider
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Model identifiers for OpenRouter
 */
export const MODELS = {
  // Grok 4.1 Fast - Search + Tool Scheduling Brain
  // Primary is free tier, fallback to paid when rate limited
  ORCHESTRATOR: {
    primary: 'x-ai/grok-4.1-fast:free',
    fallback: 'x-ai/grok-4.1-fast',
  },
  
  // Gemini 2.5 Flash - Final Writing & Serious Reasoning
  // Used for report generation and critical analysis with deep thinking
  WRITER: 'google/gemini-2.5-flash',
  
  // Gemini 2.5 Flash-Lite - Bulk/Repetitive Tasks
  // Fastest and most cost-efficient for high-throughput operations
  LIGHTWEIGHT: 'google/gemini-2.5-flash-lite',
} as const;

/**
 * Model type aliases for clearer code
 */
export type OrchestratorModel = typeof MODELS.ORCHESTRATOR.primary | typeof MODELS.ORCHESTRATOR.fallback;
export type WriterModel = typeof MODELS.WRITER;
export type LightweightModel = typeof MODELS.LIGHTWEIGHT;

/**
 * Thinking mode configuration for Gemini models
 * Higher budget = deeper reasoning but slower response
 */
export interface ThinkingConfig {
  thinkingBudget: number; // Token budget for thinking (0 to disable, max ~24576)
}

/**
 * Default thinking budgets for different task types
 */
export const THINKING_BUDGETS = {
  // Deep analysis tasks (report writing, critical analysis)
  DEEP: 8192,
  // Standard reasoning tasks
  STANDARD: 4096,
  // Light reasoning (not typically used with thinking mode)
  LIGHT: 2048,
} as const;

/**
 * Get model configuration with optional thinking mode
 * 
 * @param modelId - The OpenRouter model identifier
 * @param enableThinking - Whether to enable thinking mode (Gemini 2.5 Flash only)
 * @param thinkingBudget - Token budget for thinking (default: THINKING_BUDGETS.DEEP)
 * @returns Model configuration object for Vercel AI SDK
 */
export function getModelConfig(
  modelId: string,
  enableThinking = false,
  thinkingBudget = THINKING_BUDGETS.DEEP
) {
  // Only Gemini 2.5 Flash supports thinking mode (not Flash-Lite)
  const supportsThinking = modelId === MODELS.WRITER;
  
  if (enableThinking && supportsThinking) {
    return {
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget,
          },
        },
      },
    };
  }
  
  return {};
}

/**
 * Get the appropriate model for a given task type
 */
export function getModelForTask(task: 'orchestration' | 'writing' | 'analysis' | 'lightweight'): string {
  switch (task) {
    case 'orchestration':
      return MODELS.ORCHESTRATOR.primary;
    case 'writing':
    case 'analysis':
      return MODELS.WRITER;
    case 'lightweight':
      return MODELS.LIGHTWEIGHT;
    default:
      return MODELS.LIGHTWEIGHT;
  }
}

/**
 * Check if a model supports thinking mode
 */
export function supportsThinkingMode(modelId: string): boolean {
  return modelId === MODELS.WRITER;
}

/**
 * Log model usage for debugging/monitoring
 */
export function logModelUsage(
  agent: string,
  task: string,
  model: string,
  thinkingEnabled = false
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[Model] ${agent}.${task} → ${model}${thinkingEnabled ? ' (thinking)' : ''}`
    );
  }
}

