import { coreApi } from '@/lib/core-api';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case 'search': {
        const result = await coreApi.search({
          query: params.query,
          limit: params.limit || 10,
          offset: params.offset || 0,
          yearFrom: params.yearFrom,
          yearTo: params.yearTo,
          openAccess: params.openAccess,
        });
        return Response.json(result);
      }

      case 'getPaper': {
        const paper = await coreApi.getPaper(params.id);
        if (!paper) {
          return Response.json({ error: 'Paper not found' }, { status: 404 });
        }
        return Response.json(paper);
      }

      case 'getRelated': {
        const papers = await coreApi.getRelatedPapers(params.id, params.limit);
        return Response.json({ papers });
      }

      case 'advancedSearch': {
        const result = await coreApi.advancedSearch(params);
        return Response.json(result);
      }

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}









