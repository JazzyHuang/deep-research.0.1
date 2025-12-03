/**
 * Model Configuration Module
 * 
 * Provides centralized AI model management for the deep research system.
 * 
 * Model Strategy:
 * - Grok 4.1 Fast: Orchestration, planning, search coordination (2M context)
 * - Gemini 2.5 Flash: Report writing, critical analysis (with thinking mode)
 * - Gemini 2.5 Flash-Lite: Bulk extraction, validation, simple tasks
 */

// Core configuration
export {
  openrouter,
  MODELS,
  THINKING_BUDGETS,
  getModelConfig,
  getModelForTask,
  supportsThinkingMode,
  logModelUsage,
  type ThinkingConfig,
  type OrchestratorModel,
  type WriterModel,
  type LightweightModel,
} from './config';

// Fallback utilities
export {
  withGrokFallback,
  withRetry,
  withGrokFallbackAndRetry,
} from './with-fallback';

