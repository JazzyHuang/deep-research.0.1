/**
 * Hooks Index
 * 
 * Exports all custom hooks for the Deep Research application.
 */

// AI SDK v5 hook (uses useChat from @ai-sdk/react)
export { useResearchChat } from './useResearchChat';
export type { 
  UseResearchChatOptions, 
  UseResearchChatReturn,
  ResearchStatus,
} from './useResearchChat';
