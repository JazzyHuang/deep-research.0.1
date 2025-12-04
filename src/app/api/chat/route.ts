/**
 * AI SDK v5 Chat API Route
 * 
 * This route uses createUIMessageStream to provide a standardized
 * streaming interface compatible with the useChat hook.
 * 
 * Key features:
 * - Uses originalMessages for message persistence/reconciliation
 * - Supports transient data parts (notifications)
 * - Sends data parts with IDs for client-side reconciliation
 * - Uses generateId for consistent ID generation
 * - Emits unified agent events for SOTA timeline visualization
 */

import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from 'ai';
import { coordinateResearch } from '@/lib/agents';
import { sessionManager } from '@/lib/session-manager';
import type { ResearchUIMessage, ResearchDataParts } from '@/types/ui-message';
import type { Paper } from '@/types/paper';
import type { AgentEventStreamEvent } from '@/types/agent-event';

export const maxDuration = 600; // 10 minutes max for deep research (SOTA requirement)

// Checkpoint timeout: 5 minutes (auto-approve if no response)
const CHECKPOINT_TIMEOUT = 5 * 60 * 1000;

export async function POST(req: Request) {
  // Check required environment variables
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('[Chat API] OPENROUTER_API_KEY is not configured');
    return new Response(
      JSON.stringify({ 
        error: 'OPENROUTER_API_KEY 未配置。请在 .env.local 文件中设置 OPENROUTER_API_KEY 环境变量。' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { messages, id: chatId } = body;

    // Extract query from the last user message
    const lastUserMessage = [...messages].reverse().find(
      (m: ResearchUIMessage) => m.role === 'user'
    );
    
    if (!lastUserMessage) {
      return new Response(
        JSON.stringify({ error: 'No user message found' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get query from text parts or content
    const query = lastUserMessage.parts
      ?.filter((p: { type: string }) => p.type === 'text')
      .map((p: { text: string }) => p.text)
      .join(' ') || lastUserMessage.content || '';

    if (!query.trim()) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const sessionId = chatId || `session-${Date.now()}`;
    
    // Create session using global session manager
    sessionManager.create(sessionId, query);
    sessionManager.start(sessionId);

    // Create the UI message stream with originalMessages for reconciliation
    const stream = createUIMessageStream<ResearchUIMessage>({
      // Pass original messages for proper message history management
      originalMessages: messages,
      // Use AI SDK's generateId for consistent ID generation
      generateId,
      execute: async ({ writer }) => {
        let stepCounter = 0;
        const searchStepIds = new Map<number, string>();
        let currentPapers: Paper[] = [];
        
        // Heartbeat mechanism to keep connection alive during long operations
        // Sends a transient notification every 15 seconds to prevent proxy/load balancer timeouts
        // SOTA: Reduced from 30s to 15s to prevent ERR_INCOMPLETE_CHUNKED_ENCODING
        let lastActivity = Date.now();
        const HEARTBEAT_INTERVAL = 15 * 1000; // 15 seconds (reduced for better connection stability)
        
        const heartbeatInterval = setInterval(() => {
          const timeSinceActivity = Date.now() - lastActivity;
          if (timeSinceActivity > HEARTBEAT_INTERVAL) {
            try {
              writer.write({
                type: 'data-notification',
                data: { message: '研究进行中...', level: 'info' },
                transient: true,
              });
              lastActivity = Date.now();
            } catch {
              // Writer might be closed, ignore
            }
          }
        }, HEARTBEAT_INTERVAL);
        
        // Helper to update activity timestamp
        const updateActivity = () => { lastActivity = Date.now(); };

        // Helper to create unique IDs
        const createStepId = (prefix: string) => `${prefix}-${Date.now()}-${stepCounter++}`;

        // Helper to wait for checkpoint
        const waitForCheckpoint = async (checkpointId: string): Promise<{ action: string; data?: Record<string, unknown> }> => {
          try {
            const resolution = await sessionManager.waitForCheckpoint(sessionId, CHECKPOINT_TIMEOUT);
            sessionManager.clearCheckpoint(sessionId);
            return { action: resolution.action, data: resolution.data };
          } catch (error) {
            sessionManager.clearCheckpoint(sessionId);
            throw error;
          }
        };

        try {
          // Send initial notification (transient)
          writer.write({
            type: 'data-notification',
            data: { message: '正在分析您的研究问题...', level: 'info' },
            transient: true,
          });

          // Start the research coordinator
          const research = coordinateResearch(query, {
            maxSearchRounds: 5,
            maxIterations: 3,
            minPapersRequired: 8,
            enableMultiSource: true,
            enableCitationValidation: true,
            enableContextCompression: true,
            citationStyle: 'ieee',
            qualityGate: {
              minOverallScore: 70,
              maxIterations: 3,
            },
          });

          let planCardId: string | null = null;
          let qualityCardId: string | null = null;
          let documentCardId: string | null = null;
          let documentContent = '';

          for await (const event of research) {
            // Check for abort
            if (sessionManager.isAborted(sessionId)) {
              writer.write({
                type: 'data-agent-paused',
                data: { reason: 'User stopped' },
              });
              break;
            }

            switch (event.type) {
              // ================== UNIFIED AGENT EVENTS (SOTA) ==================
              case 'agent_event_start':
                updateActivity();
                writer.write({
                  type: 'data-agent-event',
                  id: event.event.id,
                  data: event.event,
                });
                break;
                
              case 'agent_event_update':
                updateActivity();
                writer.write({
                  type: 'data-agent-event-update',
                  id: event.update.id,
                  data: event.update,
                });
                break;
                
              case 'agent_event_complete':
                updateActivity();
                writer.write({
                  type: 'data-agent-event-complete',
                  id: event.id,
                  data: {
                    id: event.id,
                    status: event.status,
                    duration: event.duration,
                    meta: event.meta,
                  },
                });
                break;
              
              // ================== LEGACY EVENTS (for backward compatibility) ==================
              case 'status':
                // SOTA: Send status events as transient notifications to keep connection alive
                // This is critical for preventing ERR_INCOMPLETE_CHUNKED_ENCODING during long operations
                updateActivity();
                if (event.message) {
                  writer.write({
                    type: 'data-notification',
                    data: { message: event.message, level: 'info' },
                    transient: true,
                  });
                }
                break;

              case 'plan':
                // Create plan card
                planCardId = createStepId('plan');
                const checkpointId = `checkpoint-${planCardId}`;
                
                writer.write({
                  type: 'data-plan',
                  id: planCardId,
                  data: {
                    plan: event.plan,
                    summary: {
                      subQuestionsCount: event.plan.subQuestions.length,
                      searchStrategiesCount: event.plan.searchStrategies.length,
                      expectedSectionsCount: event.plan.expectedSections.length,
                    },
                  },
                });

                // Send checkpoint
                writer.write({
                  type: 'data-checkpoint',
                  id: checkpointId,
                  data: {
                    id: checkpointId,
                    type: 'plan_approval',
                    title: '确认研究计划',
                    description: '请确认研究计划后继续，或点击标题进行调整',
                    cardId: planCardId,
                    options: [
                      { id: 'continue', label: '继续研究', variant: 'primary', action: 'approve' },
                      { id: 'edit', label: '我有调整...', variant: 'outline', action: 'edit' },
                    ],
                    requiredAction: true,
                    createdAt: Date.now(),
                  },
                });

                // Register and wait for checkpoint
                sessionManager.setCheckpoint(sessionId, {
                  id: checkpointId,
                  type: 'plan_approval',
                  title: '确认研究计划',
                  description: '请确认研究计划后继续',
                  cardId: planCardId,
                  options: [
                    { id: 'continue', label: '继续研究', variant: 'primary', action: 'approve' },
                    { id: 'edit', label: '我有调整...', variant: 'outline', action: 'edit' },
                  ],
                  requiredAction: true,
                  createdAt: Date.now(),
                });

                try {
                  const resolution = await waitForCheckpoint(checkpointId);
                  
                  if (resolution.action === 'edit' && resolution.data?.feedback) {
                    writer.write({
                      type: 'data-log-line',
                      data: { text: `用户反馈: ${resolution.data.feedback}`, icon: 'info' },
                    });
                  }
                } catch (error) {
                  if (sessionManager.isAborted(sessionId)) {
                    writer.write({
                      type: 'data-agent-paused',
                      data: { reason: 'User stopped during plan review' },
                    });
                    break;
                  }
                  throw error;
                }
                break;

              case 'search_start':
                const searchStepId = createStepId('search');
                searchStepIds.set(event.round, searchStepId);
                
                writer.write({
                  type: 'data-agent-step',
                  id: searchStepId,
                  data: {
                    id: searchStepId,
                    name: 'search',
                    title: `搜索 Round ${event.round}`,
                    status: 'running',
                    summary: event.query,
                  },
                });
                break;

              case 'papers_found':
                currentPapers = [...currentPapers, ...event.papers];
                
                const paperCardId = createStepId('papers');
                writer.write({
                  type: 'data-paper-list',
                  id: paperCardId,
                  data: {
                    papers: event.papers,
                    totalFound: event.papers.length,
                    displayCount: Math.min(event.papers.length, 10),
                    roundNumber: event.round,
                  },
                });

                // Complete the search step
                const completedStepId = searchStepIds.get(event.round);
                if (completedStepId) {
                  writer.write({
                    type: 'data-step-complete',
                    id: completedStepId,
                    data: {
                      stepId: completedStepId,
                      status: 'success',
                      duration: 2000,
                    },
                  });
                }
                break;

              case 'quality_gate_result':
                qualityCardId = createStepId('quality');
                const qualityCheckpointId = `checkpoint-${qualityCardId}`;
                
                writer.write({
                  type: 'data-quality',
                  id: qualityCardId,
                  data: {
                    metrics: event.result.metrics,
                    analysis: event.result.analysis,
                    iteration: event.result.iteration,
                    recommendation: event.result.decision,
                    improvements: event.result.analysis.gapsIdentified,
                  },
                });

                if (event.result.decision !== 'pass') {
                  writer.write({
                    type: 'data-checkpoint',
                    id: qualityCheckpointId,
                    data: {
                      id: qualityCheckpointId,
                      type: 'quality_decision',
                      title: '质量评审',
                      description: `当前评分 ${event.result.analysis.overallScore}/100，${event.result.reason}`,
                      cardId: qualityCardId,
                      options: [
                        { id: 'iterate', label: '接受建议，继续', variant: 'primary', action: 'iterate' },
                        { id: 'enough', label: '已经足够', variant: 'secondary', action: 'approve' },
                        { id: 'specify', label: '指定方向...', variant: 'outline', action: 'edit' },
                      ],
                      requiredAction: true,
                      createdAt: Date.now(),
                    },
                  });

                  sessionManager.setCheckpoint(sessionId, {
                    id: qualityCheckpointId,
                    type: 'quality_decision',
                    title: '质量评审',
                    description: `当前评分 ${event.result.analysis.overallScore}/100`,
                    cardId: qualityCardId,
                    options: [
                      { id: 'iterate', label: '接受建议，继续', variant: 'primary', action: 'iterate' },
                      { id: 'enough', label: '已经足够', variant: 'secondary', action: 'approve' },
                      { id: 'specify', label: '指定方向...', variant: 'outline', action: 'edit' },
                    ],
                    requiredAction: true,
                    createdAt: Date.now(),
                  });

                  try {
                    const qualityResolution = await waitForCheckpoint(qualityCheckpointId);
                    
                    if (qualityResolution.action === 'edit' && qualityResolution.data?.feedback) {
                      writer.write({
                        type: 'data-log-line',
                        data: { text: `用户指导: ${qualityResolution.data.feedback}`, icon: 'info' },
                      });
                    }
                  } catch (error) {
                    if (sessionManager.isAborted(sessionId)) {
                      writer.write({
                        type: 'data-agent-paused',
                        data: { reason: 'User stopped during quality review' },
                      });
                      break;
                    }
                    throw error;
                  }
                }
                break;

              case 'content':
                // Streaming document content
                if (!documentCardId) {
                  documentCardId = createStepId('document');
                  
                  // SOTA: Send notification before report generation to keep connection alive
                  // This prevents timeout during the LLM initialization phase
                  updateActivity();
                  writer.write({
                    type: 'data-notification',
                    data: { message: '开始生成研究报告...', level: 'info' },
                    transient: true,
                  });
                  
                  writer.write({
                    type: 'data-document',
                    id: documentCardId,
                    data: {
                      title: '研究报告',
                      content: '',
                      version: 1,
                      wordCount: 0,
                      citationCount: 0,
                    },
                  });
                }

                documentContent += event.content;
                
                // SOTA: Update activity on every content chunk to prevent timeout
                updateActivity();
                
                // Stream the text content using text-delta
                writer.write({
                  type: 'text-delta',
                  delta: event.content,
                  id: generateId(),
                });

                // Update document card
                writer.write({
                  type: 'data-document',
                  id: documentCardId,
                  data: {
                    title: '研究报告',
                    content: documentContent,
                    version: 1,
                    wordCount: documentContent.split(/\s+/).filter(Boolean).length,
                    citationCount: 0,
                  },
                });
                break;

              case 'complete':
                if (documentCardId) {
                  const reportCheckpointId = `checkpoint-report-${Date.now()}`;
                  
                  // Update document with final data
                  writer.write({
                    type: 'data-document',
                    id: documentCardId,
                    data: {
                      title: '研究报告',
                      content: documentContent,
                      version: 1,
                      wordCount: documentContent.split(/\s+/).filter(Boolean).length,
                      citationCount: event.report.citations?.length || 0,
                      qualityScore: event.report.qualityMetrics?.coverageScore,
                    },
                  });

                  // Final checkpoint
                  writer.write({
                    type: 'data-checkpoint',
                    id: reportCheckpointId,
                    data: {
                      id: reportCheckpointId,
                      type: 'report_review',
                      title: '报告审阅',
                      description: '研究报告已生成，请审阅',
                      cardId: documentCardId,
                      options: [
                        { id: 'satisfied', label: '满意，完成', variant: 'primary', action: 'approve' },
                        { id: 'optimize', label: '继续优化', variant: 'secondary', action: 'iterate' },
                        { id: 'modify', label: '我有修改...', variant: 'outline', action: 'edit' },
                      ],
                      requiredAction: true,
                      createdAt: Date.now(),
                    },
                  });

                  sessionManager.setCheckpoint(sessionId, {
                    id: reportCheckpointId,
                    type: 'report_review',
                    title: '报告审阅',
                    description: '研究报告已生成，请审阅',
                    cardId: documentCardId,
                    options: [
                      { id: 'satisfied', label: '满意，完成', variant: 'primary', action: 'approve' },
                      { id: 'optimize', label: '继续优化', variant: 'secondary', action: 'iterate' },
                      { id: 'modify', label: '我有修改...', variant: 'outline', action: 'edit' },
                    ],
                    requiredAction: true,
                    createdAt: Date.now(),
                  });

                  try {
                    const reportResolution = await waitForCheckpoint(reportCheckpointId);
                    
                    if (reportResolution.action === 'iterate') {
                      writer.write({
                        type: 'data-log-line',
                        data: { text: '用户请求继续优化报告...', icon: 'info' },
                      });
                    } else if (reportResolution.action === 'edit' && reportResolution.data?.feedback) {
                      writer.write({
                        type: 'data-log-line',
                        data: { text: `用户修改建议: ${reportResolution.data.feedback}`, icon: 'info' },
                      });
                    }
                  } catch (error) {
                    if (sessionManager.isAborted(sessionId)) {
                      writer.write({
                        type: 'data-agent-paused',
                        data: { reason: 'User stopped during report review' },
                      });
                      break;
                    }
                    throw error;
                  }
                }

                sessionManager.complete(sessionId);
                writer.write({
                  type: 'data-session-complete',
                  data: { timestamp: Date.now() },
                });
                break;

              case 'error':
                sessionManager.setError(sessionId, event.error);
                writer.write({
                  type: 'data-session-error',
                  data: { error: event.error },
                });
                break;

              case 'agent_step_start':
                writer.write({
                  type: 'data-agent-step',
                  id: event.step.id,
                  data: {
                    id: event.step.id,
                    name: event.step.name,
                    title: event.step.title,
                    status: event.step.status === 'running' ? 'running' : 'pending',
                    summary: event.step.description,
                  },
                });
                break;

              case 'agent_step_complete':
                writer.write({
                  type: 'data-step-complete',
                  id: event.stepId,
                  data: {
                    stepId: event.stepId,
                    status: event.status === 'success' ? 'success' : event.status === 'error' ? 'error' : 'success',
                    duration: event.duration || 0,
                  },
                });
                break;
              
              case 'writing_start':
                // SOTA: Send notification when a new section starts being written
                // This keeps the connection alive during long report generation
                updateActivity();
                writer.write({
                  type: 'data-notification',
                  data: { message: `撰写中: ${event.section}`, level: 'info' },
                  transient: true,
                });
                break;
            }
          }
        } catch (error) {
          let errorMessage: string;
          let isRecoverable = false;
          
          if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            
            // Detailed error classification for better user feedback
            if (msg.includes('terminated') || msg.includes('aborted') || msg.includes('the operation was aborted')) {
              // Stream was aborted - likely timeout
              errorMessage = '研究过程被中断（可能是超时），请刷新页面重新开始';
              console.error('[Chat API] Stream aborted:', error.message);
            } else if (msg.includes('timeout') || msg.includes('timed out')) {
              errorMessage = '请求超时，请稍后重试或简化研究问题';
            } else if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('401')) {
              errorMessage = 'API 配置错误，请检查 OPENROUTER_API_KEY';
            } else if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many')) {
              errorMessage = '请求过于频繁，请稍后重试';
              isRecoverable = true;
            } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection') || msg.includes('socket')) {
              errorMessage = '网络连接失败，请检查网络后重试';
              isRecoverable = true;
            } else if (msg.includes('incomplete') || msg.includes('chunked')) {
              errorMessage = '数据传输中断，请重试';
              isRecoverable = true;
            } else {
              errorMessage = error.message;
            }
            console.error('[Chat API] Error:', error.message, error.stack);
          } else {
            errorMessage = 'Unknown error occurred';
            console.error('[Chat API] Unknown error:', error);
          }
          
          sessionManager.setError(sessionId, errorMessage);
          
          try {
            writer.write({
              type: 'data-session-error',
              data: { error: errorMessage, recoverable: isRecoverable },
            });
          } catch {
            // Writer might already be closed
            console.error('[Chat API] Failed to write error to stream');
          }
        } finally {
          // Clear heartbeat interval
          clearInterval(heartbeatInterval);
          
          // Clean up session after a delay
          setTimeout(() => {
            sessionManager.remove(sessionId);
          }, 60000);
        }
      },
      // Callback when stream finishes - useful for persistence
      onFinish: ({ messages: finalMessages }) => {
        // Log completion for debugging
        console.log(`[Chat API] Session ${sessionId} completed with ${finalMessages.length} messages`);
        
        // Here you could persist the final messages to a database
        // await saveChat({ chatId: sessionId, messages: finalMessages });
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function getStatusTitle(status: string): string {
  switch (status) {
    case 'planning': return '创建研究计划';
    case 'searching': return '文献检索';
    case 'analyzing': return '分析论文';
    case 'writing': return '撰写报告';
    case 'reviewing': return '质量评审';
    case 'iterating': return '优化报告';
    case 'complete': return '研究完成';
    default: return status;
  }
}

