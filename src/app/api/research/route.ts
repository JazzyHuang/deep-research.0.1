import { coordinateResearch, serializeStreamEvent } from '@/lib/agents';

export const maxDuration = 300; // 5 minutes max for deep research

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, config } = body;

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create a readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Use new SOTA coordinator with optional config overrides
          const research = coordinateResearch(query, {
            maxSearchRounds: config?.maxSearchRounds || 5,
            maxIterations: config?.maxIterations || 3,
            minPapersRequired: config?.minPapersRequired || 8,
            enableMultiSource: config?.enableMultiSource ?? true,
            enableCitationValidation: config?.enableCitationValidation ?? true,
            enableContextCompression: config?.enableContextCompression ?? true,
            citationStyle: config?.citationStyle || 'ieee',
            qualityGate: {
              minOverallScore: config?.minQualityScore || 70,
              maxIterations: config?.maxIterations || 3,
            },
          });

          for await (const event of research) {
            const data = serializeStreamEvent(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));

            // If error or complete, end the stream
            if (event.type === 'error' || event.type === 'complete') {
              break;
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`)
          );
        } finally {
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

