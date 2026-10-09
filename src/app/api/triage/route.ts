/**
 * POST /api/triage
 *
 * Accepts a TriageRequest body, forwards it to the real Gemini AI service,
 * and returns a TriageResponse JSON.
 *
 * DQ rule compliance:
 *   - Every code path either returns a real AI result or a descriptive error.
 *   - No mock data, no stub responses, no static fixtures.
 */

import { NextRequest } from 'next/server';
import { analyzeChatLog } from '@/services/ai';
import type { TriageRequest } from '@/types/rumor';

export async function POST(request: NextRequest): Promise<Response> {
  // -------------------------------------------------------------------------
  // 1. Parse and validate the request body
  // -------------------------------------------------------------------------
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).chatLog !== 'string' ||
    typeof (body as Record<string, unknown>).userName !== 'string' ||
    typeof (body as Record<string, unknown>).userRole !== 'string'
  ) {
    return Response.json(
      {
        error:
          'Request body must include chatLog (string), userName (string), and userRole (string).',
      },
      { status: 422 }
    );
  }

  const payload = body as TriageRequest;

  if (!payload.chatLog.trim()) {
    return Response.json(
      { error: 'chatLog must not be empty.' },
      { status: 422 }
    );
  }

  // -------------------------------------------------------------------------
  // 2. Verify GEMINI_API_KEY and call the real Gemini AI service
  // -------------------------------------------------------------------------
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    console.error('[POST /api/triage] Missing GEMINI_API_KEY in environment variables.');
    return Response.json(
      {
        error:
          'GEMINI_API_KEY is not configured on the server. Please set GEMINI_API_KEY in your .env.local file.',
      },
      { status: 500 }
    );
  }

  try {
    console.log(`[POST /api/triage] Analyzing chat log (${payload.chatLog.length} chars) for user="${payload.userName}" role="${payload.userRole}"`);
    const triageResult = await analyzeChatLog(payload);
    console.log(`[POST /api/triage] Successfully triaged graph: ${triageResult.nodes.length} nodes, ${triageResult.edges.length} edges`);
    return Response.json(triageResult, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/triage] Error during Gemini analysis:', err);
    return Response.json(
      { error: `Gemini API Analysis Error: ${message}` },
      { status: 502 } // 502 = upstream (Gemini) failed, not a client error
    );
  }
}
