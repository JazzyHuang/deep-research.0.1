/**
 * Centralized AI Model Configuration
 * 
 * Model Strategy:
 * - Grok 4.1 Fast: Search + tool scheduling brain (2M context, fast reasoning)
 * - Gemini 2.5 Flash: Final writing & serious reasoning
 * - Gemini 2.5 Flash-Lite: Bulk/repetitive medium-light tasks (high throughput)
 * 
 * Note: Gemini 2.5 Flash has thinking mode enabled by default.
 * We explicitly disable it via extraBody to prevent stream interruptions
 * and ensure compatibility with OpenRouter.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';

/**
 * Timeout configurations for different operation types
 * 
 * Note: LONG_GENERATION should match Next.js maxDuration (600s = 10 minutes)
 * to prevent premature stream termination during report generation.
 */
export const TIMEOUTS = {
  /** Standard API calls (30 seconds) */
  STANDARD: 30 * 1000,
  /** Long generation tasks like report writing (10 minutes) 
   * Must match Next.js maxDuration to prevent ERR_INCOMPLETE_CHUNKED_ENCODING */
  LONG_GENERATION: 10 * 60 * 1000,
  /** Maximum allowed timeout (10 minutes) */
  MAX: 10 * 60 * 1000,
} as const;

/**
 * Maximum output token configurations for different tasks
 * Note: AI SDK v5 uses maxOutputTokens instead of maxTokens
 */
export const MAX_OUTPUT_TOKENS = {
  /** Report generation - needs large output */
  REPORT: 8192,
  /** Standard analysis tasks */
  ANALYSIS: 4096,
  /** Summary and lightweight tasks */
  SUMMARY: 2048,
} as const;

/**
 * Custom fetch with timeout and keep-alive support for OpenRouter calls
 * 
 * SOTA: Added keepalive: true to prevent connection drops during long streaming operations
 * This helps prevent ERR_INCOMPLETE_CHUNKED_ENCODING errors during report generation
 */
function createFetchWithTimeout(timeoutMs: number = TIMEOUTS.LONG_GENERATION) {
  return async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        // SOTA: Enable keep-alive to maintain persistent connection during long streams
        // This reduces the chance of ERR_INCOMPLETE_CHUNKED_ENCODING
        keepalive: true,
        // SOTA: Add Connection header to ensure the server maintains the connection
        headers: {
          ...((init?.headers as Record<string, string>) || {}),
          'Connection': 'keep-alive',
        },
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

/**
 * Extra body configuration to disable Gemini thinking mode
 * Gemini 2.5 Flash has thinking enabled by default which can cause:
 * - Stream interruptions during long generations
 * - Compatibility issues with OpenRouter
 * Setting thinking_budget to 0 disables thinking mode
 */
const GEMINI_NO_THINKING_CONFIG = {
  generation_config: {
    thinking_config: {
      thinking_budget: 0,
    },
  },
};

// Initialize OpenRouter provider with extended timeout for long generations
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  // Use custom fetch with extended timeout for long-running generations
  fetch: createFetchWithTimeout(TIMEOUTS.LONG_GENERATION),
  // Disable Gemini thinking mode to prevent stream interruptions
  extraBody: GEMINI_NO_THINKING_CONFIG,
});

/**
 * Create an OpenRouter instance with a specific timeout
 * Useful for operations that need different timeout values
 * Includes Gemini thinking mode disabled by default
 */
export function createOpenRouterWithTimeout(timeoutMs: number) {
  return createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    fetch: createFetchWithTimeout(timeoutMs),
    // Disable Gemini thinking mode to prevent stream interruptions
    extraBody: GEMINI_NO_THINKING_CONFIG,
  });
}

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
  // Used for report generation and critical analysis (thinking mode disabled)
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
 * Thinking mode configuration interface
 * Used to configure Gemini's thinking budget via extraBody
 */
export interface ThinkingConfig {
  thinkingBudget: number;
}

/**
 * Thinking budgets for Gemini models
 * Note: We use 0 (disabled) by default via GEMINI_NO_THINKING_CONFIG
 * to prevent stream interruptions with OpenRouter
 */
export const THINKING_BUDGETS = {
  DISABLED: 0,
  LIGHT: 2048,
  STANDARD: 4096,
  DEEP: 8192,
};

export type ThinkingBudget = (typeof THINKING_BUDGETS)[keyof typeof THINKING_BUDGETS];

/**
 * Get model configuration
 * 
 * Note: Thinking mode is now disabled globally via extraBody in the OpenRouter config.
 * This function is kept for API compatibility but returns empty config.
 * 
 * @param _modelId - The OpenRouter model identifier (unused)
 * @param _enableThinking - Whether thinking was requested (unused, thinking is disabled globally)
 * @param _thinkingBudget - Token budget (unused)
 * @returns Empty configuration object
 */
export function getModelConfig(
  _modelId: string,
  _enableThinking = false,
  _thinkingBudget: number = THINKING_BUDGETS.DISABLED
): Record<string, unknown> {
  // Thinking mode is disabled globally via GEMINI_NO_THINKING_CONFIG
  // Return empty config as thinking settings are handled at provider level
  if (_enableThinking && process.env.NODE_ENV === 'development') {
    console.log('[Model] Note: Thinking mode is disabled globally to prevent stream interruptions');
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
 * Note: Returns false since thinking mode is disabled globally to prevent stream interruptions
 */
export function supportsThinkingMode(_modelId: string): boolean {
  // Thinking mode is disabled globally via GEMINI_NO_THINKING_CONFIG
  return false;
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

