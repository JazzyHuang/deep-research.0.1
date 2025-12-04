/**
 * Fallback and retry wrappers for AI model calls
 * 
 * Handles:
 * - Automatic fallback from free tier to paid tier
 * - Retry logic for transient failures
 * - Stream-specific retry for long-running generations
 * - Model degradation for reliability
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

/**
 * Error patterns that indicate the stream should be retried
 */
const STREAM_RETRY_ERROR_PATTERNS = [
  'network',
  'connection',
  'timeout',
  'timed out',
  'aborted',
  'terminated',
  'fetch failed',
  'socket hang up',
  'econnreset',
  'stream',
  '502',
  '503',
  '504',
];

/**
 * Check if an error is retryable for streaming
 */
function isStreamRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return STREAM_RETRY_ERROR_PATTERNS.some(pattern => message.includes(pattern));
  }
  return false;
}

/**
 * Configuration for stream retry behavior
 */
export interface StreamRetryConfig {
  /** Maximum number of retry attempts (default: 2) */
  maxRetries: number;
  /** Initial delay between retries in ms (default: 1000) */
  initialDelayMs: number;
  /** Whether to try fallback model on failure (default: true) */
  useFallbackModel: boolean;
  /** Fallback model ID (default: MODELS.LIGHTWEIGHT) */
  fallbackModelId: string;
  /** Agent name for logging */
  agent: string;
  /** Task name for logging */
  task: string;
}

const DEFAULT_STREAM_RETRY_CONFIG: StreamRetryConfig = {
  maxRetries: 2,
  initialDelayMs: 1000,
  useFallbackModel: true,
  fallbackModelId: MODELS.LIGHTWEIGHT,
  agent: 'Unknown',
  task: 'unknown',
};

/**
 * Result of a stream retry operation
 */
export interface StreamRetryResult<T> {
  /** The successful stream result */
  result: T;
  /** Whether a fallback model was used */
  usedFallback: boolean;
  /** Number of attempts made */
  attempts: number;
  /** Model ID that succeeded */
  modelUsed: string;
}

/**
 * Wrapper for streaming operations with retry and fallback support
 * 
 * This is specifically designed for streamText calls which need special handling:
 * 1. The initial call may fail and need retry
 * 2. If primary model fails after retries, try fallback model
 * 3. Provides detailed information about what happened
 * 
 * @param createStream - Function that creates the stream given a model ID
 * @param primaryModelId - Primary model to use
 * @param config - Retry configuration
 * @returns Stream result with metadata
 * 
 * @example
 * ```typescript
 * const { result, usedFallback } = await withStreamRetry(
 *   (modelId) => streamText({
 *     model: openrouter(modelId),
 *     prompt: '...',
 *     maxTokens: 8192,
 *   }),
 *   MODELS.WRITER,
 *   { agent: 'Writer', task: 'generateReport' }
 * );
 * ```
 */
/**
 * Type for the result of streamText - using a minimal interface that all stream results satisfy
 */
interface StreamResult {
  textStream: AsyncIterable<string>;
}

export async function withStreamRetry<T extends StreamResult>(
  createStream: (modelId: string) => T,
  primaryModelId: string,
  config: Partial<StreamRetryConfig> = {}
): Promise<StreamRetryResult<T>> {
  const settings = { ...DEFAULT_STREAM_RETRY_CONFIG, ...config };
  let attempts = 0;
  let delayMs = settings.initialDelayMs;
  let lastError: unknown;

  // Try primary model with retries
  for (let attempt = 0; attempt <= settings.maxRetries; attempt++) {
    attempts++;
    try {
      logModelUsage(settings.agent, settings.task, primaryModelId);
      const result = createStream(primaryModelId);
      
      // For streaming, we need to verify the stream is working
      // by checking if it can be iterated (the result object exists)
      if (result && typeof result === 'object') {
        return {
          result,
          usedFallback: false,
          attempts,
          modelUsed: primaryModelId,
        };
      }
      
      throw new Error('Stream creation returned invalid result');
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.warn(
        `[Stream] ${settings.agent}.${settings.task}: Attempt ${attempt + 1} failed with ${primaryModelId}:`,
        errorMessage
      );

      // Only retry if it's a retryable error
      if (!isStreamRetryableError(error) && attempt < settings.maxRetries) {
        // Non-retryable error, skip to fallback
        console.log(`[Stream] Error is not retryable, skipping to fallback`);
        break;
      }

      if (attempt < settings.maxRetries) {
        console.log(`[Stream] Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 1.5; // Exponential backoff
      }
    }
  }

  // Try fallback model if enabled
  if (settings.useFallbackModel && settings.fallbackModelId !== primaryModelId) {
    console.log(
      `[Stream] ${settings.agent}.${settings.task}: Trying fallback model ${settings.fallbackModelId}`
    );
    
    try {
      logModelUsage(settings.agent, settings.task, settings.fallbackModelId);
      const result = createStream(settings.fallbackModelId);
      
      if (result && typeof result === 'object') {
        return {
          result,
          usedFallback: true,
          attempts: attempts + 1,
          modelUsed: settings.fallbackModelId,
        };
      }
      
      throw new Error('Fallback stream creation returned invalid result');
    } catch (fallbackError) {
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      console.error(
        `[Stream] ${settings.agent}.${settings.task}: Fallback model also failed:`,
        fallbackMessage
      );
      
      // Include both errors in the final message
      const primaryMessage = lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(
        `Stream generation failed. Primary (${primaryModelId}): ${primaryMessage}. Fallback (${settings.fallbackModelId}): ${fallbackMessage}`
      );
    }
  }

  // No fallback or fallback disabled, throw the last error
  throw lastError;
}

/**
 * Async generator wrapper that adds retry capability to stream iteration
 * 
 * This wraps an async iterable and catches errors during iteration,
 * allowing the caller to handle stream interruptions gracefully.
 * 
 * @param stream - The async iterable to wrap
 * @param onError - Callback when an error occurs during iteration
 * @yields Values from the stream
 */
export async function* wrapStreamWithErrorHandling<T>(
  stream: AsyncIterable<T>,
  onError?: (error: unknown) => void
): AsyncGenerator<T, void, unknown> {
  try {
    for await (const chunk of stream) {
      yield chunk;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Stream] Error during stream iteration:', errorMessage);
    onError?.(error);
    throw error;
  }
}

/**
 * Check if we should use a lighter model based on error patterns
 * Returns the recommended model ID or null if no change recommended
 */
export function recommendModelDowngrade(
  currentModel: string,
  error: unknown
): string | null {
  if (!(error instanceof Error)) return null;
  
  const message = error.message.toLowerCase();
  
  // If using WRITER and getting timeout/length issues, suggest LIGHTWEIGHT
  if (currentModel === MODELS.WRITER) {
    if (
      message.includes('timeout') ||
      message.includes('too long') ||
      message.includes('context length') ||
      message.includes('max tokens')
    ) {
      console.log('[Model] Recommending downgrade to LIGHTWEIGHT model due to:', message);
      return MODELS.LIGHTWEIGHT;
    }
  }
  
  return null;
}

