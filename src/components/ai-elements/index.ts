/**
 * AI Elements Components
 * 
 * A collection of AI-focused UI components inspired by Vercel's AI SDK
 * AI Elements pattern. These components provide a consistent, beautiful
 * interface for AI chat applications.
 * 
 * Based on shadcn/ui and Tailwind CSS.
 */

// Conversation
export {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  ConversationEmptyState,
} from './conversation';

// Message
export {
  Message,
  MessageContent,
  MessageAvatar,
} from './message';

// Prompt Input
export {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputButton,
  PromptInputFooter,
} from './prompt-input';

// Reasoning
export {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from './reasoning';

// Sources
export {
  Sources,
  SourcesTrigger,
  SourcesContent,
  Source,
} from './sources';

// Response
export { Response } from './response';

// Loader
export { Loader, SkeletonCard, ResearchLoader, type LoaderContext } from './loader';

// Message wrappers
export { AssistantMessageWrapper, UserMessageWrapper } from './message';



