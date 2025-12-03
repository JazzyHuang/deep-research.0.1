import { NextRequest } from 'next/server';
import { sessionManager } from '@/lib/session-manager';

/**
 * POST: Resolve a checkpoint with user action
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await req.json();
    const { checkpointId, action, data } = body;
    
    if (!action || typeof action !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
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
    
    // Check if there's a pending checkpoint
    if (!session?.pendingCheckpoint) {
      return new Response(
        JSON.stringify({ 
          error: 'No pending checkpoint',
          sessionId,
          sessionStatus: session?.status,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Optionally verify checkpoint ID matches
    if (checkpointId && session.pendingCheckpoint.id !== checkpointId) {
      return new Response(
        JSON.stringify({ 
          error: 'Checkpoint ID mismatch',
          expected: session.pendingCheckpoint.id,
          received: checkpointId,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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
          message: 'Checkpoint resolved',
          sessionId,
          checkpointId: session.pendingCheckpoint.id,
          action,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Failed to resolve checkpoint',
          sessionId,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
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
