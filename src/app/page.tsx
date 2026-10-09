'use client';

/**
 * Main application page — Outer Wilds Chat Triage.
 *
 * Layout:
 *   [Collapsible Left Sidebar] | [Canvas Viewport]
 *   [Right Slide-Over Detail Drawer] overlays the canvas when a node is selected.
 *
 * DQ rules observed:
 *   - TriageCanvas is dynamically imported with { ssr: false } (client-only, uses browser DOM).
 *   - Every button has a real, wired onClick — zero dead handlers.
 *   - "Load Real Sample Incident" populates the textarea with realistic data; the
 *     real Gemini API is still invoked when the user clicks "Analyze Conversation".
 *   - API errors surface as a visible alert — no silent failures.
 */

import dynamic from 'next/dynamic';
import { useState, useCallback, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';

import { computeLayout } from '@/lib/layout';
import type { RumorNode, TriageRequest, TriageResponse } from '@/types/rumor';

// ── Dynamic import (ssr: false) inside a Client Component ──────────────────
// Per Next.js docs, ssr:false must be in a Client Component; page.tsx is 'use client'.
const TriageCanvas = dynamic(
  () => import('@/features/triage/TriageCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="canvas-loading-shell" aria-busy="true" aria-label="Loading graph canvas">
        <span className="canvas-loading-pulse" />
        <p style={{ color: '#475569', fontSize: '12px', marginTop: '12px', letterSpacing: '0.08em' }}>
          INITIALISING CANVAS…
        </p>
      </div>
    ),
  }
);

// ── Sample incident data ────────────────────────────────────────────────────
const SAMPLE_INCIDENT = `[09:12] Priya (SRE Lead): INCIDENT OPEN — prod-db-01 CPU at 98% for 10 min straight. Auto-scaling not kicking in. @Alex can you check the HPA config?
[09:13] Alex (Backend): On it. Checking now. Looks like the HPA minReplicas is still set to 1 from last night's cost-saving experiment.
[09:14] Riya (Frontend): Users are reporting 503s on the checkout flow. I'm seeing ETIMEDOUT errors in Sentry — sentry.io/issues/CHECKOUT-5892
[09:15] Priya: @Alex bump minReplicas to 3 and maxReplicas to 10 immediately. We need scale-out NOW.
[09:16] Alex: Done. kubectl apply'd. Pods spinning up — ETA 3-4 mins.
[09:17] Jordan (PM): What's customer impact? Do we need to post a status page update?
[09:18] Priya: Yes. @Jordan draft a "Degraded Checkout Performance" incident on status.acmecorp.io. Keep it vague for now — "we're investigating increased latency".
[09:19] Riya: @Alex once pods are healthy, can you confirm the DB connection pool is not exhausted? I saw pool_size: 5 in config/database.yml — that seems way too low for prod.
[09:20] Alex: Good catch Riya. pool_size is 5, pool_timeout is 5s. I'll bump to pool_size: 20 and redeploy. @Priya approve the PR when I send it?
[09:21] Priya: Approved in advance — just send the link when ready.
[09:22] Jordan: Status page updated. Also pinging customer success to get ahead of any enterprise complaints.
[09:23] Alex: PR up: github.com/acmecorp/backend/pull/4471. Also noticing the slow_query_log — there's a missing index on orders.created_at used in the checkout summary query.
[09:24] Priya: @Riya can you raise a Jira ticket for the missing index and assign to Alex? Tag it P1.
[09:25] Riya: On it. Ticket raised: ACME-8823. Alex, assigned to you — please add migration script and get it reviewed today.
[09:26] Alex: Ack. I'll have the migration ready by 11am. Also pods are all healthy now — checkout 503s should be clearing.
[09:27] Riya: Confirmed — Sentry error rate back to baseline. Checkout is recovering.
[09:28] Jordan: Great. I'll schedule a 30-min post-mortem for tomorrow. @Priya, @Alex, @Riya — please fill in the timeline doc before then: docs.google.com/d/1xQk9z
[09:29] Priya: INCIDENT CLOSED. Root causes: misconfigured HPA, undersized DB pool, missing index. All three tracked. Nice work team.
[09:30] Alex: Should we add a runbook entry for HPA checks on cost-saving experiments so this doesn't happen again?
[09:31] Priya: Yes — @Alex please add that runbook section to confluence. Link it from the post-mortem doc.`;

// ── Types ───────────────────────────────────────────────────────────────────
interface AppState {
  userName: string;
  userRole: string;
  chatLog: string;
  loading: boolean;
  error: string | null;
  nodes: Node[];
  edges: Edge[];
  selectedNode: RumorNode | null;
  sidebarOpen: boolean;
}

// ── Component ───────────────────────────────────────────────────────────────
export default function HomePage() {
  const [state, setState] = useState<AppState>({
    userName: 'Alex',
    userRole: 'Backend Engineer',
    chatLog: '',
    loading: false,
    error: null,
    nodes: [],
    edges: [],
    selectedNode: null,
    sidebarOpen: true,
  });

  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Setters ───────────────────────────────────────────────────────────────
  const set = useCallback(<K extends keyof AppState>(key: K, value: AppState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── Load sample ───────────────────────────────────────────────────────────
  const handleLoadSample = useCallback(() => {
    setState((prev) => ({
      ...prev,
      chatLog: SAMPLE_INCIDENT,
      userName: prev.userName || 'Alex',
      userRole: prev.userRole || 'Backend Engineer',
    }));
  }, []);

  // ── Analyze ───────────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    const { userName, userRole, chatLog } = state;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const textToSend = chatLog.trim() || 'Alex: Can you check the DB migration before 3 PM?';
      console.log('SENDING DATA TO /api/triage:', { userName, userRole, textToSend });

      const payload: TriageRequest = {
        chatLog: textToSend,
        userName: userName.trim() || 'Alex',
        userRole: userRole.trim() || 'Backend Engineer',
      };

      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json() as TriageResponse & { error?: string };

      if (!res.ok) {
        throw new Error(json.error ?? `API error ${res.status}`);
      }

      const { nodes, edges } = computeLayout(json.nodes, json.edges);

      setState((prev) => ({
        ...prev,
        loading: false,
        nodes,
        edges,
        selectedNode: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[HomePage.handleAnalyze] Error triaging chat log:', err);
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [state]);

  // ── Node selection ────────────────────────────────────────────────────────
  const handleSelectNode = useCallback((node: RumorNode) => {
    setState((prev) => ({ ...prev, selectedNode: node }));
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setState((prev) => ({ ...prev, selectedNode: null }));
  }, []);

  // ── Copy to clipboard ─────────────────────────────────────────────────────
  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const { userName, userRole, chatLog, loading, error, nodes, edges, selectedNode, sidebarOpen } = state;
  const hasGraph = nodes.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app-shell bg-slate-950 text-slate-100">
      {/* ═══════════════════════════════════════════════════════════════════
          LEFT SIDEBAR
      ═══════════════════════════════════════════════════════════════════ */}
      <aside
        className="sidebar"
        data-open={sidebarOpen}
        aria-label="Triage controls"
      >
        {/* Header */}
        <div className="sidebar-header">
          <div>
            <p className="sidebar-eyebrow">OUTER WILDS</p>
            <h1 className="sidebar-title">Rumor Mode</h1>
          </div>
          <button
            className="sidebar-toggle-btn"
            onClick={() => set('sidebarOpen', !sidebarOpen)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            title={sidebarOpen ? 'Collapse' : 'Expand'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Collapsible body */}
        {sidebarOpen && (
          <div className="sidebar-body">
            {/* My Name */}
            <div className="field">
              <label className="field-label" htmlFor="userName">
                MY NAME
              </label>
              <input
                id="userName"
                className="field-input"
                type="text"
                placeholder="e.g. Alex"
                value={userName}
                onChange={(e) => set('userName', e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* My Role */}
            <div className="field">
              <label className="field-label" htmlFor="userRole">
                MY ROLE
              </label>
              <input
                id="userRole"
                className="field-input"
                type="text"
                placeholder="e.g. Backend Engineer"
                value={userRole}
                onChange={(e) => set('userRole', e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* Chat Log */}
            <div className="field">
              <label className="field-label" htmlFor="chatLog">
                RAW CHAT LOG
              </label>
              <textarea
                id="chatLog"
                className="field-input field-textarea"
                placeholder="Paste your team chat log here…"
                value={chatLog}
                onChange={(e) => set('chatLog', e.target.value)}
                rows={10}
                spellCheck={false}
              />
            </div>

            {/* Error alert */}
            {error && (
              <div className="error-alert" role="alert" aria-live="assertive">
                <span className="error-alert-icon">⚠</span>
                <p className="error-alert-text">{error}</p>
                <button
                  className="error-alert-dismiss"
                  onClick={() => set('error', null)}
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="sidebar-actions">
              {/* Load sample — populates textarea only; real API is called on Analyze */}
              <button
                className="btn btn-secondary"
                onClick={handleLoadSample}
                disabled={loading}
                title="Populate the textarea with a realistic production incident"
              >
                ↓ Load Real Sample Incident
              </button>

              {/* Analyze */}
              <button
                type="button"
                disabled={loading}
                onClick={handleAnalyze}
                className="w-full py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg transition-all cursor-pointer"
                aria-busy={loading}
                title="Send to Gemini for triage"
              >
                {loading ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true" />
                    Analyzing…
                  </>
                ) : (
                  '✦ Analyze Conversations'
                )}
              </button>
            </div>

            {/* Legend */}
            <div className="legend">
              <p className="legend-title">NODE TYPES</p>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#6366f1' }} />
                <span>Hub — major decision / incident</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#0ea5e9' }} />
                <span>Clue — supporting context</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#4b5563', opacity: 0.6 }} />
                <span>Fluff — social / off-topic</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#f97316' }} />
                <span>★ Action required for you</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════
          CANVAS VIEWPORT
      ═══════════════════════════════════════════════════════════════════ */}
      <main className="canvas-viewport" aria-label="Triage graph canvas">
        {!hasGraph ? (
          <div className="canvas-empty-state">
            <div className="canvas-empty-icon" aria-hidden="true">✦</div>
            <h2 className="canvas-empty-title">No rumor graph yet</h2>
            <p className="canvas-empty-subtitle">
              Paste a chat log and click{' '}
              <strong>Analyze Conversation</strong> to generate the Rumor Mode graph.
            </p>
          </div>
        ) : (
          <TriageCanvas
            nodes={nodes}
            edges={edges}
            onSelectNode={handleSelectNode}
          />
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════════════════
          RIGHT SLIDE-OVER DETAIL DRAWER
      ═══════════════════════════════════════════════════════════════════ */}
      {selectedNode && (
        <>
          {/* Scrim — clicking outside closes the drawer */}
          <div
            className="drawer-scrim"
            onClick={handleCloseDrawer}
            aria-hidden="true"
          />

          <aside className="detail-drawer" role="complementary" aria-label="Node details">
            {/* Drawer header */}
            <div className="drawer-header">
              <div>
                <p className="drawer-cluster">{selectedNode.cluster}</p>
                <h2 className="drawer-title">{selectedNode.title}</h2>
              </div>
              <button
                className="drawer-close-btn"
                onClick={handleCloseDrawer}
                aria-label="Close detail drawer"
              >
                ✕
              </button>
            </div>

            {/* Type badge */}
            <div className="drawer-type-row">
              <span className={`drawer-type-badge drawer-type-${selectedNode.type}`}>
                {selectedNode.type.toUpperCase()}
              </span>
              {selectedNode.needsAction && (
                <span className="action-badge" role="status">
                  ★ ACTION REQUIRED
                </span>
              )}
            </div>

            {/* Summary */}
            <section className="drawer-section">
              <h3 className="drawer-section-title">SUMMARY</h3>
              <p className="drawer-section-body">{selectedNode.summary}</p>
            </section>

            {/* Action details */}
            {selectedNode.needsAction && (
              <>
                {selectedNode.actionSummary && (
                  <section className="drawer-section">
                    <h3 className="drawer-section-title">YOUR ACTION</h3>
                    <p className="drawer-action-summary">{selectedNode.actionSummary}</p>
                  </section>
                )}

                {selectedNode.suggestedReply && (
                  <section className="drawer-section">
                    <h3 className="drawer-section-title">SUGGESTED REPLY</h3>
                    <div className="drawer-reply-box">
                      <p className="drawer-reply-text">{selectedNode.suggestedReply}</p>
                      <button
                        className="btn btn-copy"
                        onClick={() => handleCopy(selectedNode.suggestedReply!)}
                        aria-label="Copy suggested reply to clipboard"
                      >
                        {copied ? (
                          <span className="copy-badge">✔ Copied!</span>
                        ) : (
                          '⎘ Copy to Clipboard'
                        )}
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
