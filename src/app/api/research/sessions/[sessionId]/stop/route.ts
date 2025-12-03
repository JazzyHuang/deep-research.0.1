import { NextRequest } from 'next/server';
import { sessionManager } from '@/lib/session-manager';

export async function POST(
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
    
    // Abort the session using the global session manager
    const aborted = sessionManager.abort(sessionId);
    
    if (aborted) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Agent stopped successfully',
          sessionId,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Failed to stop agent',
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
