import { NextRequest } from 'next/server';
import { sessionManager } from '@/lib/session-manager';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await req.json();
    const { content } = body;
    
    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message content is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if session exists
    if (!sessionManager.has(sessionId)) {
      return new Response(
        JSON.stringify({ error: 'Session not found', sessionId }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get session state
    const session = sessionManager.get(sessionId);
    
    // Add message to session queue using session manager
    const message = sessionManager.addUserMessage(sessionId, content);
    
    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Failed to add message to session' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Determine response based on session state
    let responseMessage = 'Message received';
    let actionTaken = 'queued';
    
    if (session?.status === 'awaiting_checkpoint') {
      // If there's a pending checkpoint, the message was used as feedback
      // and the checkpoint has been automatically resolved
      responseMessage = 'Message received and checkpoint resolved with your feedback';
      actionTaken = 'checkpoint_resolved';
    } else if (session?.status === 'running') {
      // Message queued for processing
      responseMessage = 'Message queued for agent processing';
      actionTaken = 'queued';
    } else if (session?.status === 'paused') {
      // Session is paused, message saved but won't be processed until resumed
      responseMessage = 'Message saved. Agent is currently paused.';
      actionTaken = 'saved';
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: responseMessage,
        sessionId,
        messageId: message.id,
        actionTaken,
        sessionStatus: session?.status,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET: Retrieve message history for a session
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    
    // Check if session exists
    if (!sessionManager.has(sessionId)) {
      return new Response(
        JSON.stringify({ error: 'Session not found', sessionId }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const session = sessionManager.get(sessionId);
    
    return new Response(
      JSON.stringify({
        sessionId,
        messages: session?.userMessages || [],
        unprocessedCount: session?.unprocessedMessages.length || 0,
        sessionStatus: session?.status,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
