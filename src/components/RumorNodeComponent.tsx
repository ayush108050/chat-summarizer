'use client';

/**
 * RumorNodeComponent — custom React Flow node styled after the
 * Outer Wilds Ship Log (Rumor Mode).
 *
 * Receives the full RumorNode as `data` from React Flow.
 * Handles: hub / clue / fluff visual variants, cluster-coloured borders,
 * needsAction pulsating badge, hover/selected states, and Handle anchors.
 */

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { RumorNode } from '@/types/rumor';

// ---------------------------------------------------------------------------
// Cluster → colour mapping (deterministic, no random runtime values)
// ---------------------------------------------------------------------------

/** A fixed palette of border/glow colours cycled by cluster name hash. */
const CLUSTER_PALETTE = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f97316', // orange
] as const;

function clusterColor(cluster: string): string {
  let hash = 0;
  for (let i = 0; i < cluster.length; i++) {
    hash = (hash * 31 + cluster.charCodeAt(i)) >>> 0;
  }
  return CLUSTER_PALETTE[hash % CLUSTER_PALETTE.length];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActionBadge() {
  return (
    <span
      className="action-badge"
      aria-label="Action required"
      role="status"
    >
      ★ ACTION REQUIRED
    </span>
  );
}

function TypePill({ type }: { type: RumorNode['type'] }) {
  const labels: Record<RumorNode['type'], string> = {
    hub: 'HUB',
    clue: 'CLUE',
    fluff: 'FLUFF',
  };
  const colors: Record<RumorNode['type'], string> = {
    hub: '#6366f1',
    clue: '#0ea5e9',
    fluff: '#6b7280',
  };
  return (
    <span
      style={{
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.12em',
        color: colors[type],
        border: `1px solid ${colors[type]}`,
        borderRadius: '3px',
        padding: '1px 5px',
        marginLeft: '6px',
        flexShrink: 0,
      }}
    >
      {labels[type]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/** Alias for the shaped Node used by React Flow internally. */
export type RumorFlowNode = Node<Record<string, unknown>, 'rumorNode'>;

function RumorNodeComponent({ data, selected }: NodeProps) {
  // data arrives as Record<string,unknown> from React Flow; recover the typed shape
  const rumor = data as unknown as RumorNode;
  const {
    type,
    title,
    summary,
    cluster,
    needsAction,
    actionSummary,
  } = rumor;

  const borderColor = clusterColor(cluster);
  const isHub = type === 'hub';
  const isFluff = type === 'fluff';

  return (
    <>
      {/* Target handle — top */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: borderColor, width: 8, height: 8, border: 'none' }}
      />

      {/* ----------------------------------------------------------------- */}
      {/* Card shell                                                          */}
      {/* ----------------------------------------------------------------- */}
      <div
        data-selected={selected}
        data-type={type}
        style={{
          /* Sizing */
          width: '260px',
          minHeight: isHub ? '160px' : '120px',
          /* Deep space background */
          background: isFluff
            ? 'rgba(10,12,20,0.6)'
            : 'rgba(10,12,20,0.92)',
          /* Cluster border */
          border: `${isHub ? 2 : 1.5}px solid ${borderColor}`,
          borderRadius: '8px',
          /* Hub glow */
          boxShadow: isHub
            ? `0 0 18px 2px ${borderColor}55, 0 0 4px 1px ${borderColor}33`
            : selected
            ? `0 0 12px 2px ${borderColor}66`
            : '0 2px 8px rgba(0,0,0,0.5)',
          /* Fluff dim */
          opacity: isFluff ? 0.6 : 1,
          /* Typography baseline */
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          color: '#e2e8f0',
          padding: '12px 14px',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s ease, opacity 0.2s ease, border-color 0.2s ease',
          position: 'relative',
          overflow: 'hidden',
        }}
        /* Hover via CSS class in globals — inline style can't target :hover */
        className="rumor-node-card"
      >
        {/* Star-field texture overlay */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
            pointerEvents: 'none',
          }}
        />

        {/* ---- Header row ---- */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
            gap: '4px',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            {/* Hub accent line */}
            {isHub && (
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: '3px',
                  height: '14px',
                  background: borderColor,
                  borderRadius: '2px',
                  marginRight: '8px',
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                fontSize: isHub ? '13px' : '12px',
                fontWeight: isHub ? 700 : 600,
                color: isHub ? '#f8fafc' : '#cbd5e1',
                letterSpacing: isHub ? '0.04em' : '0.02em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={title}
            >
              {title}
            </span>
          </div>
          <TypePill type={type} />
        </div>

        {/* ---- Cluster tag ---- */}
        <div
          style={{
            fontSize: '9px',
            letterSpacing: '0.1em',
            color: borderColor,
            textTransform: 'uppercase',
            marginBottom: '6px',
            position: 'relative',
          }}
        >
          {cluster}
        </div>

        {/* ---- Summary ---- */}
        <p
          style={{
            fontSize: '11px',
            lineHeight: '1.55',
            color: '#94a3b8',
            margin: 0,
            position: 'relative',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {summary}
        </p>

        {/* ---- Action required block ---- */}
        {needsAction && (
          <div
            style={{
              marginTop: '10px',
              borderTop: '1px solid #f97316',
              paddingTop: '8px',
              position: 'relative',
            }}
          >
            <ActionBadge />
            {actionSummary && (
              <p
                style={{
                  margin: '5px 0 0',
                  fontSize: '10px',
                  color: '#fb923c',
                  lineHeight: '1.45',
                }}
              >
                {actionSummary}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Source handle — bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: borderColor, width: 8, height: 8, border: 'none' }}
      />
    </>
  );
}

export default memo(RumorNodeComponent);
