import { coordinateResearch } from '@/lib/agents';
import { sessionManager } from '@/lib/session-manager';
import { createCard, createCheckpointActions } from '@/types/cards';
import type { ConversationEvent, CheckpointData } from '@/types/conversation';
import type { InteractiveCard, PlanCardData, QualityCardData, DocumentCardData, PaperListCardData } from '@/types/cards';

export const maxDuration = 300; // 5 minutes max

// Checkpoint timeout: 5 minutes (auto-approve if no response)
const CHECKPOINT_TIMEOUT = 5 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, sessionId } = body;

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const finalSessionId = sessionId || `session-${Date.now()}`;
    
    // Create session using global session manager
    sessionManager.create(finalSessionId, query);
    sessionManager.start(finalSessionId);

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Counter to ensure unique IDs
        let stepCounter = 0;
        // Map to track step IDs by round
        const searchStepIds = new Map<number, string>();
        
        const sendEvent = (event: ConversationEvent) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // Stream may be closed
          }
        };

        // Helper to wait for checkpoint with proper user interaction
        const waitForCheckpoint = async (checkpoint: CheckpointData): Promise<{ action: string; data?: Record<string, unknown> }> => {
          // Register checkpoint in session manager
          sessionManager.setCheckpoint(finalSessionId, checkpoint);
          
          try {
            // Wait for user response or timeout
            const resolution = await sessionManager.waitForCheckpoint(finalSessionId, CHECKPOINT_TIMEOUT);
            
            // Clear the checkpoint
            sessionManager.clearCheckpoint(finalSessionId);
            
            // Send resolution event
            sendEvent({ 
              type: 'checkpoint_resolved', 
              checkpointId: checkpoint.id, 
              resolution: resolution.action 
            });
            
            return { action: resolution.action, data: resolution.data };
          } catch (error) {
            // Aborted or error - clear checkpoint
            sessionManager.clearCheckpoint(finalSessionId);
            throw error;
          }
        };

        try {
          // Start assistant message
          const assistantMsgId = `assistant-${Date.now()}`;
          sendEvent({ type: 'message_start', messageId: assistantMsgId, messageType: 'assistant', role: 'assistant' });
          sendEvent({ type: 'message_content', messageId: assistantMsgId, content: '正在分析您的研究问题...\n\n' });
          sendEvent({ type: 'message_complete', messageId: assistantMsgId });

          // Use the coordinator with event mapping
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

          let planCard: InteractiveCard | null = null;
          let qualityCard: InteractiveCard | null = null;
          let documentCard: InteractiveCard | null = null;
          let currentPapers: import('@/types/paper').Paper[] = [];

          for await (const event of research) {
            // Check for abort using session manager
            if (sessionManager.isAborted(finalSessionId)) {
              sendEvent({ type: 'agent_paused', reason: 'User stopped' });
              break;
            }

            // Map internal events to conversation events
            switch (event.type) {
              case 'status':
                // Send as agent step
                sendEvent({
                  type: 'step_start',
                  step: {
                    id: `step-${Date.now()}-${stepCounter++}`,
                    name: event.status,
                    title: getStatusTitle(event.status),
                    status: 'running',
                  },
                });
                break;

              case 'plan':
                // Create plan card with checkpoint
                const planData: PlanCardData = {
                  type: 'plan',
                  plan: event.plan,
                  summary: {
                    subQuestionsCount: event.plan.subQuestions.length,
                    searchStrategiesCount: event.plan.searchStrategies.length,
                    expectedSectionsCount: event.plan.expectedSections.length,
                  },
                };
                
                planCard = createCard('plan', '研究计划', planData, {
                  isCheckpoint: true,
                  checkpointId: `checkpoint-plan-${Date.now()}`,
                  actions: createCheckpointActions('plan'),
                });
                
                sendEvent({ type: 'card_created', card: planCard });
                
                // Send checkpoint event
                const planCheckpoint: CheckpointData = {
                  id: planCard.checkpointId!,
                  type: 'plan_approval',
                  title: '确认研究计划',
                  description: '请确认研究计划后继续，或点击标题进行调整',
                  cardId: planCard.id,
                  options: [
                    { id: 'continue', label: '继续研究', variant: 'primary', action: 'approve' },
                    { id: 'edit', label: '我有调整...', variant: 'outline', action: 'edit' },
                  ],
                  requiredAction: true,
                  createdAt: Date.now(),
                };
                sendEvent({ type: 'checkpoint_reached', checkpoint: planCheckpoint });
                
                // Wait for user to approve the plan
                try {
                  const planResolution = await waitForCheckpoint(planCheckpoint);
                  
                  // Handle edit action - user may have provided feedback
                  if (planResolution.action === 'edit' && planResolution.data?.feedback) {
                    // Send the feedback as a message
                    sendEvent({ 
                      type: 'message_content', 
                      messageId: assistantMsgId, 
                      content: `\n用户反馈: ${planResolution.data.feedback}\n` 
                    });
                  }
                } catch (error) {
                  // Session aborted during checkpoint
                  if (sessionManager.isAborted(finalSessionId)) {
                    sendEvent({ type: 'agent_paused', reason: 'User stopped during plan review' });
                    break;
                  }
                  throw error;
                }
                break;

              case 'search_start':
                const searchStepId = `search-${event.round}-${stepCounter++}`;
                searchStepIds.set(event.round, searchStepId);
                sendEvent({
                  type: 'step_start',
                  step: {
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
                
                // Create paper list card
                const paperData: PaperListCardData = {
                  type: 'paper_list',
                  papers: event.papers,
                  totalFound: event.papers.length,
                  displayCount: Math.min(event.papers.length, 10),
                  roundNumber: event.round,
                };
                
                const paperCard = createCard(
                  'paper_list', 
                  `检索结果 · Round ${event.round}`, 
                  paperData
                );
                sendEvent({ type: 'card_created', card: paperCard });
                
                const completedStepId = searchStepIds.get(event.round);
                if (completedStepId) {
                  sendEvent({
                    type: 'step_complete',
                    stepId: completedStepId,
                    duration: 2000,
                    status: 'success',
                  });
                }
                break;

              case 'quality_metrics':
              case 'critic_analysis':
                // These build up to quality card
                break;

              case 'quality_gate_result':
                // Create quality card with checkpoint
                const qualityData: QualityCardData = {
                  type: 'quality',
                  metrics: event.result.metrics,
                  analysis: event.result.analysis,
                  iteration: event.result.iteration,
                  recommendation: event.result.decision,
                  improvements: event.result.analysis.gapsIdentified,
                };
                
                qualityCard = createCard('quality', '质量评估报告', qualityData, {
                  isCheckpoint: event.result.decision !== 'pass',
                  checkpointId: event.result.decision !== 'pass' ? `checkpoint-quality-${Date.now()}` : undefined,
                  actions: event.result.decision !== 'pass' ? createCheckpointActions('quality') : undefined,
                });
                
                sendEvent({ type: 'card_created', card: qualityCard });
                
                if (event.result.decision !== 'pass' && qualityCard.checkpointId) {
                  const qualityCheckpoint: CheckpointData = {
                    id: qualityCard.checkpointId,
                    type: 'quality_decision',
                    title: '质量评审',
                    description: `当前评分 ${event.result.analysis.overallScore}/100，${event.result.reason}`,
                    cardId: qualityCard.id,
                    options: [
                      { id: 'iterate', label: '接受建议，继续', variant: 'primary', action: 'iterate' },
                      { id: 'enough', label: '已经足够', variant: 'secondary', action: 'approve' },
                      { id: 'specify', label: '指定方向...', variant: 'outline', action: 'edit' },
                    ],
                    requiredAction: true,
                    createdAt: Date.now(),
                  };
                  sendEvent({ type: 'checkpoint_reached', checkpoint: qualityCheckpoint });
                  
                  // Wait for user decision
                  try {
                    const qualityResolution = await waitForCheckpoint(qualityCheckpoint);
                    
                    // Handle user decision
                    if (qualityResolution.action === 'approve') {
                      // User is satisfied, can break out of iteration loop
                      // (The coordinator handles this based on its own logic)
                    } else if (qualityResolution.action === 'edit' && qualityResolution.data?.feedback) {
                      // User provided specific feedback
                      sendEvent({ 
                        type: 'message_content', 
                        messageId: assistantMsgId, 
                        content: `\n用户指导: ${qualityResolution.data.feedback}\n` 
                      });
                    }
                  } catch (error) {
                    if (sessionManager.isAborted(finalSessionId)) {
                      sendEvent({ type: 'agent_paused', reason: 'User stopped during quality review' });
                      break;
                    }
                    throw error;
                  }
                }
                break;

              case 'content':
                // Streaming content for document
                if (!documentCard) {
                  const docData: DocumentCardData = {
                    type: 'document',
                    title: '研究报告',
                    content: '',
                    version: 1,
                    wordCount: 0,
                    citationCount: 0,
                  };
                  documentCard = createCard('document', '研究报告 v1', docData);
                  sendEvent({ type: 'card_created', card: documentCard });
                }
                
                // Update document content
                const existingDocData = documentCard.data as DocumentCardData;
                const currentContent = existingDocData.content + event.content;
                const updatedDocData: DocumentCardData = {
                  ...existingDocData,
                  content: currentContent,
                  wordCount: currentContent.split(/\s+/).filter(Boolean).length,
                };
                documentCard = { ...documentCard, data: updatedDocData };
                sendEvent({
                  type: 'card_updated',
                  cardId: documentCard.id,
                  updates: { data: updatedDocData },
                });
                break;

              case 'complete':
                // Final document card with checkpoint
                if (documentCard) {
                  const reportCheckpointId = `checkpoint-report-${Date.now()}`;
                  const finalDocData = documentCard.data as DocumentCardData;
                  const completedDocData: DocumentCardData = {
                    ...finalDocData,
                    citationCount: event.report.citations.length,
                    qualityScore: event.report.qualityMetrics?.coverageScore,
                  };
                  sendEvent({
                    type: 'card_updated',
                    cardId: documentCard.id,
                    updates: {
                      isCheckpoint: true,
                      checkpointId: reportCheckpointId,
                      actions: createCheckpointActions('document'),
                      data: completedDocData,
                    },
                  });
                  
                  const reportCheckpoint: CheckpointData = {
                    id: reportCheckpointId,
                    type: 'report_review',
                    title: '报告审阅',
                    description: '研究报告已生成，请审阅',
                    cardId: documentCard.id,
                    options: [
                      { id: 'satisfied', label: '满意，完成', variant: 'primary', action: 'approve' },
                      { id: 'optimize', label: '继续优化', variant: 'secondary', action: 'iterate' },
                      { id: 'modify', label: '我有修改...', variant: 'outline', action: 'edit' },
                    ],
                    requiredAction: true,
                    createdAt: Date.now(),
                  };
                  sendEvent({ type: 'checkpoint_reached', checkpoint: reportCheckpoint });
                  
                  // Wait for user to review final report
                  try {
                    const reportResolution = await waitForCheckpoint(reportCheckpoint);
                    
                    // Handle final decision
                    if (reportResolution.action === 'iterate') {
                      // In a more advanced implementation, we could trigger another iteration
                      sendEvent({ 
                        type: 'message_content', 
                        messageId: assistantMsgId, 
                        content: '\n用户请求继续优化报告...\n' 
                      });
                    } else if (reportResolution.action === 'edit' && reportResolution.data?.feedback) {
                      sendEvent({ 
                        type: 'message_content', 
                        messageId: assistantMsgId, 
                        content: `\n用户修改建议: ${reportResolution.data.feedback}\n` 
                      });
                    }
                  } catch (error) {
                    if (sessionManager.isAborted(finalSessionId)) {
                      sendEvent({ type: 'agent_paused', reason: 'User stopped during report review' });
                      break;
                    }
                    throw error;
                  }
                }
                
                // Mark session as complete
                sessionManager.complete(finalSessionId);
                sendEvent({ type: 'session_complete' });
                break;

              case 'error':
                sessionManager.setError(finalSessionId, event.error);
                sendEvent({ type: 'session_error', error: event.error });
                break;
                
              // Handle agent step events from coordinator
              case 'agent_step_start':
                sendEvent({
                  type: 'step_start',
                  step: {
                    id: event.step.id,
                    name: event.step.name,
                    title: event.step.title,
                    status: event.step.status === 'running' ? 'running' : 'pending',
                    summary: event.step.description,
                  },
                });
                break;
                
              case 'agent_step_complete':
                sendEvent({
                  type: 'step_complete',
                  stepId: event.stepId,
                  duration: event.duration || 0,
                  status: event.status === 'success' ? 'success' : event.status === 'error' ? 'error' : 'success',
                });
                break;
                
              case 'agent_step_update':
                sendEvent({
                  type: 'step_update',
                  stepId: event.stepId,
                  updates: {
                    summary: event.updates.description,
                    status: event.updates.status as 'pending' | 'running' | 'success' | 'error',
                  },
                });
                break;
            }
          }
        } catch (error) {
          // Provide user-friendly error messages
          let errorMessage: string;
          if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            if (msg.includes('terminated') || msg.includes('aborted')) {
              errorMessage = '研究过程被中断，请刷新页面重新开始';
            } else if (msg.includes('timeout')) {
              errorMessage = '请求超时，请稍后重试';
            } else if (msg.includes('api key') || msg.includes('unauthorized')) {
              errorMessage = 'API 配置错误，请联系管理员';
            } else {
              errorMessage = error.message;
            }
            console.error('[Sessions API] Error:', error.message, error.stack);
          } else {
            errorMessage = 'Unknown error occurred';
            console.error('[Sessions API] Unknown error:', error);
          }
          
          sessionManager.setError(finalSessionId, errorMessage);
          sendEvent({ type: 'session_error', error: errorMessage });
        } finally {
          // Clean up session after a delay (to allow final events to be sent)
          setTimeout(() => {
            sessionManager.remove(finalSessionId);
          }, 60000); // Keep session for 1 minute after completion
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
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
