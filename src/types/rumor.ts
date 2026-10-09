/**
 * Core domain types for the Outer Wilds Chat Triage system.
 * All types represent real data structures exchanged with the Gemini API.
 */

/** A node in the triage graph. */
export interface RumorNode {
  /** Stable unique identifier for this node (e.g. "node-1"). */
  id: string;
  /** Semantic classification of the node. */
  type: 'hub' | 'clue' | 'fluff';
  /** Short human-readable title. */
  title: string;
  /** 1–2 sentence plain-language summary of this node's content. */
  summary: string;
  /** Cluster/theme label grouping related nodes (e.g. "Deployment", "Auth"). */
  cluster: string;
  /**
   * True when the current user (identified by TriageRequest.userName)
   * has an outstanding action item or blocker in this node.
   */
  needsAction: boolean;
  /** A concise description of what the user must do, present only when needsAction is true. */
  actionSummary?: string;
  /**
   * A ready-to-send reply the user can copy into the chat thread,
   * present only when needsAction is true.
   */
  suggestedReply?: string;
}

/** A directed edge in the triage graph connecting two RumorNodes. */
export interface RumorEdge {
  /** Stable unique identifier for this edge (e.g. "edge-1"). */
  id: string;
  /** ID of the source RumorNode. */
  source: string;
  /** ID of the target RumorNode. */
  target: string;
  /** Optional human-readable label describing the relationship. */
  label?: string;
}

/** The full structured response returned by the Gemini triage analysis. */
export interface TriageResponse {
  nodes: RumorNode[];
  edges: RumorEdge[];
}

/** The request payload sent to the triage API route and Gemini. */
export interface TriageRequest {
  /** The raw text content of the chat log to analyse. */
  chatLog: string;
  /** The username of the person requesting the triage (used to detect action items). */
  userName: string;
  /** The role/title of that person (e.g. "Frontend Engineer"). */
  userRole: string;
}
