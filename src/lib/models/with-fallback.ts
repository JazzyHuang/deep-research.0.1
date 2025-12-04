/**
 * Fallback wrapper for Grok models
 * 
 * Handles automatic fallback from free tier to paid tier when:
 * - Rate limits are exceeded
 * - Free tier is unavailable
 * - Any other transient errors occur
 */

import { MODELS, logModelUsage } from './config';

/**
 * Error types that should trigger a fallback
 */
const FALLBACK_ERROR_PATTERNS = [
  'rate limit',
  'rate_limit',
  'quota exceeded',
  'too many requests',
  '429',
  'capacity',
  'unavailable',
  'temporarily',
  'timeout',
  'terminated',
  'aborted',
  'network',
  'connection',
  'econnreset',
  'socket hang up',
  'fetch failed',
  '500',
  '502',
  '503',
  '504',
];

/**
 * Check if an error should trigger a fallback
 */
function shouldFallback(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return FALLBACK_ERROR_PATTERNS.some(pattern => message.includes(pattern));
  }
  return false;
}

/**
 * Execute an operation with Grok model, automatically falling back to paid tier if needed
 * 
 * @param operation - Async function that takes a model ID and returns a result
 * @param agent - Name of the agent using this (for logging)
 * @param task - Name of the task (for logging)
 * @returns The result from the operation
 * 
 * @example
 * ```typescript
 * const result = await withGrokFallback(
 *   async (modelId) => {
 *     const { object } = await generateObject({
 *       model: openrouter(modelId),
 *       schema: mySchema,
 *       prompt: myPrompt,
 *     });
 *     return object;
 *   },
 *   'Coordinator',
 *   'decideNextStep'
 * );
 * ```
 */
export async function withGrokFallback<T>(
  operation: (modelId: string) => Promise<T>,
  agent = 'Unknown',
  task = 'unknown'
): Promise<T> {
  const primaryModel = MODELS.ORCHESTRATOR.primary;
  const fallbackModel = MODELS.ORCHESTRATOR.fallback;
  
  let lastError: unknown;
  
  // Try primary model
  try {
    logModelUsage(agent, task, primaryModel);
    return await operation(primaryModel);
  } catch (error) {
    lastError = error;
    console.warn(
      `[Model] ${agent}.${task}: Primary model (${primaryModel}) failed:`,
      error instanceof Error ? error.message : error
    );
  }
  
  // Try fallback model
  try {
    console.log(`[Model] ${agent}.${task}: Trying fallback model (${fallbackModel})`);
    logModelUsage(agent, task, fallbackModel);
    return await operation(fallbackModel);
  } catch (error) {
    console.error(
      `[Model] ${agent}.${task}: Fallback model also failed:`,
      error instanceof Error ? error.message : error
    );
    
    // Throw the original error with more context
    const originalMessage = lastError instanceof Error ? lastError.message : String(lastError);
    const fallbackMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `AI model call failed. Primary: ${originalMessage}. Fallback: ${fallbackMessage}`
    );
  }
}

/**
 * Execute an operation with retry logic (useful for transient failures)
 * 
 * @param operation - Async function to execute
 * @param maxRetries - Maximum number of retries (default: 2)
 * @param delayMs - Delay between retries in ms (default: 1000)
 * @returns The result from the operation
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2,
  delayMs = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        console.warn(
          `[Model] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`,
          error instanceof Error ? error.message : error
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 1.5; // Exponential backoff
      }
    }
  }
  
  throw lastError;
}

/**
 * Combine fallback and retry logic for maximum resilience
 */
export async function withGrokFallbackAndRetry<T>(
  operation: (modelId: string) => Promise<T>,
  agent = 'Unknown',
  task = 'unknown',
  maxRetries = 1
): Promise<T> {
  return withRetry(
    () => withGrokFallback(operation, agent, task),
    maxRetries
  );
}

