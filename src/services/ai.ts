/**
 * AI service layer — real Gemini API integration via @google/genai.
 *
 * DQ rule compliance:
 *   - Uses live GEMINI_API_KEY from the environment; no fallbacks, no mocks.
 *   - responseMimeType: 'application/json' forces Gemini to emit valid JSON only.
 *   - On error, throws a descriptive Error so the API route can return a real
 *     error payload and the UI can display a real alert.
 */

import { GoogleGenAI } from '@google/genai';
import type { TriageRequest, TriageResponse } from '@/types/rumor';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[ai.ts] GEMINI_API_KEY environment variable is not set. ' +
        'Add it to your .env.local file before starting the dev server.'
    );
  }
  return new GoogleGenAI({ apiKey });
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert chat-triage assistant. Your task is to
analyse a team chat log and produce a structured knowledge graph that helps the
specified user quickly understand what matters and what they need to act on.

## Output rules
Return ONLY valid JSON that matches this TypeScript shape — no prose, no markdown fences:

{
  "nodes": [
    {
      "id": "node-<number>",
      "type": "<hub|clue|fluff>",
      "title": "<short title>",
      "summary": "<1-2 sentence summary>",
      "cluster": "<theme label>",
      "needsAction": <true|false>,
      "actionSummary": "<present only when needsAction is true>",
      "suggestedReply": "<present only when needsAction is true>"
    }
  ],
  "edges": [
    {
      "id": "edge-<number>",
      "source": "<node id>",
      "target": "<node id>",
      "label": "<optional short relationship label>"
    }
  ]
}

## Node classification rules
- **hub**: Identify 2–4 major decisions, incidents, or recurring topics. These
  form the backbone of the graph.
- **clue**: Supporting context that connects to a hub — e.g. error logs, PRs
  referenced, follow-up questions. Connect each clue to its hub via an edge.
- **fluff**: Trivial banter, off-topic messages, or social pleasantries. Mark
  these as fluff nodes; they need no edges.

## Action detection rules
- Examine every message attributed to the specified userName carefully.
- If that person was asked a question, assigned a task, or is blocked, set
  needsAction: true on the most relevant hub/clue node.
- Write actionSummary as a concise one-line TODO.
- Write suggestedReply as a friendly, professional message the user can paste
  directly into the chat (include actual technical context from the log).`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends the provided chat log to Gemini for triage analysis and returns a
 * fully typed TriageResponse.
 *
 * Throws a descriptive Error on failure — callers must NOT swallow errors
 * or fall back to mock data.
 */
export async function analyzeChatLog(
  payload: TriageRequest
): Promise<TriageResponse> {
  const { chatLog, userName, userRole } = payload;

  if (!chatLog.trim()) {
    throw new Error('[analyzeChatLog] chatLog must not be empty.');
  }
  if (!userName.trim()) {
    throw new Error('[analyzeChatLog] userName must not be empty.');
  }

  const userPrompt = `## User context
Name: ${userName}
Role: ${userRole}

## Chat log to triage
\`\`\`
${chatLog}
\`\`\`

Analyse the log and return the JSON graph.`;

  let rawText: string | undefined;

  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        temperature: 0.2, // Low temperature → more deterministic, valid JSON
      },
    });

    rawText = response.text;
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      `[analyzeChatLog] Gemini API call failed: ${message}`
    );
  }

  if (!rawText) {
    throw new Error(
      '[analyzeChatLog] Gemini returned an empty response. ' +
        'The model may have refused to generate content.'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(
      `[analyzeChatLog] Failed to parse Gemini response as JSON.\n` +
        `Raw response (first 500 chars): ${rawText.slice(0, 500)}`
    );
  }

  // Runtime shape validation — surfaces malformed Gemini output as real errors.
  const result = parsed as TriageResponse;
  if (!Array.isArray(result.nodes) || !Array.isArray(result.edges)) {
    throw new Error(
      '[analyzeChatLog] Gemini response is missing "nodes" or "edges" arrays. ' +
        `Received keys: ${Object.keys(parsed as object).join(', ')}`
    );
  }

  return result;
}
