import { NextRequest } from 'next/server';
import { sessionManager } from '@/lib/session-manager';

/**
 * POST: Resolve a checkpoint with user action
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  // Ensure consistent JSON response headers
  const jsonHeaders = { 'Content-Type': 'application/json' };
  
  try {
    const { sessionId } = await params;
    
    // Validate sessionId
    if (!sessionId || sessionId.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Session ID is required', code: 'INVALID_SESSION_ID' }),
        { status: 400, headers: jsonHeaders }
      );
    }
    
    // Parse request body with error handling
    let body: { checkpointId?: string; action?: string; data?: unknown };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body', code: 'INVALID_JSON' }),
        { status: 400, headers: jsonHeaders }
      );
    }
    
    const { checkpointId, action, data } = body;
    
    if (!action || typeof action !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Action is required and must be a string', code: 'INVALID_ACTION' }),
        { status: 400, headers: jsonHeaders }
      );
    }
    
    // Check if session exists
    if (!sessionManager.has(sessionId)) {
      console.warn(`[Checkpoint API] Session not found: ${sessionId}`);
      return new Response(
        JSON.stringify({ 
          error: 'Session not found or has expired. Please refresh the page and try again.',
          code: 'SESSION_NOT_FOUND',
          sessionId,
        }),
        { status: 404, headers: jsonHeaders }
      );
    }
    
    // Get session state
    const session = sessionManager.get(sessionId);
    
    // Check if there's a pending checkpoint
    if (!session?.pendingCheckpoint) {
      console.warn(`[Checkpoint API] No pending checkpoint for session: ${sessionId}, status: ${session?.status}`);
      return new Response(
        JSON.stringify({ 
          error: 'No pending checkpoint. The checkpoint may have already been resolved or timed out.',
          code: 'NO_PENDING_CHECKPOINT',
          sessionId,
          sessionStatus: session?.status,
        }),
        { status: 400, headers: jsonHeaders }
      );
    }
    
    // Optionally verify checkpoint ID matches
    if (checkpointId && session.pendingCheckpoint.id !== checkpointId) {
      console.warn(`[Checkpoint API] Checkpoint ID mismatch for session: ${sessionId}`);
      return new Response(
        JSON.stringify({ 
          error: 'Checkpoint ID mismatch. The checkpoint may have been updated.',
          code: 'CHECKPOINT_MISMATCH',
          expected: session.pendingCheckpoint.id,
          received: checkpointId,
        }),
        { status: 400, headers: jsonHeaders }
      );
    }
    
    // Resolve the checkpoint
    const resolved = sessionManager.resolveCheckpoint(
      sessionId, 
      action, 
      data as Record<string, unknown> | undefined
    );
    
    if (resolved) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Checkpoint resolved successfully',
          sessionId,
          checkpointId: session.pendingCheckpoint.id,
          action,
        }),
        { status: 200, headers: jsonHeaders }
      );
    } else {
      console.error(`[Checkpoint API] Failed to resolve checkpoint for session: ${sessionId}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to resolve checkpoint. Please try again.',
          code: 'RESOLUTION_FAILED',
          sessionId,
        }),
        { status: 500, headers: jsonHeaders }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('[Checkpoint API] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: 'INTERNAL_ERROR',
      }),
      { status: 500, headers: jsonHeaders }
    );
  }
}

/**
 * GET: Get current checkpoint status
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
        sessionStatus: session?.status,
        pendingCheckpoint: session?.pendingCheckpoint || null,
        checkpointHistory: session?.checkpointHistory || [],
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
