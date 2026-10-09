/**
 * Dagre-based graph layout utility.
 *
 * Computes (x, y) positions for a set of React Flow nodes + edges so that
 * clusters arrange legibly and nodes never overlap.
 *
 * This is a pure utility — no React, no side-effects.
 */

import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import type { RumorNode } from '@/types/rumor';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default node dimensions used for dagre's layout pass. */
export const NODE_WIDTH = 260;
export const NODE_HEIGHT = 140;

/**
 * hub nodes get extra vertical space so their larger cards don't collide.
 */
const HUB_NODE_HEIGHT = 180;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns whether a RumorNode should use the larger hub height.
 */
function nodeHeight(rumor: RumorNode): number {
  return rumor.type === 'hub' ? HUB_NODE_HEIGHT : NODE_HEIGHT;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Given a list of RumorNodes and RumorEdges, returns React Flow `Node[]` and
 * `Edge[]` with dagre-computed positions.
 *
 * Dagre ranks nodes top-to-bottom ('TB') within each cluster so related nodes
 * naturally align. Node separation constants prevent visual overlap.
 */
export function computeLayout(
  rumorNodes: RumorNode[],
  rumorEdges: Array<{ id: string; source: string; target: string; label?: string }>
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();

  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',    // top-to-bottom hierarchy
    nodesep: 60,      // horizontal gap between sibling nodes
    ranksep: 80,      // vertical gap between ranks
    marginx: 40,
    marginy: 40,
  });

  // Register every node with its dimensions
  for (const node of rumorNodes) {
    g.setNode(node.id, {
      width: NODE_WIDTH,
      height: nodeHeight(node),
    });
  }

  // Register every edge (dagre needs them to rank nodes)
  for (const edge of rumorEdges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  // Map back to React Flow nodes — dagre centres coordinates, RF uses top-left
  const nodes: Node[] = rumorNodes.map((rumor) => {
    const { x, y, width, height } = g.node(rumor.id) as dagre.Node & {
      width: number;
      height: number;
    };

    return {
      id: rumor.id,
      type: 'rumorNode',          // custom node type registered in TriageCanvas
      position: {
        x: x - width / 2,
        y: y - height / 2,
      },
      // Cast via unknown to satisfy Node<Record<string,unknown>> constraint;
      // component-level typing is handled through RumorFlowNode.
      data: rumor as unknown as Record<string, unknown>,
      draggable: true,
      selectable: true,
    };
  });

  const edges: Edge[] = rumorEdges.map((re) => ({
    id: re.id,
    source: re.source,
    target: re.target,
    label: re.label,
    type: 'smoothstep',
    animated: false,
    style: { stroke: '#4a5568', strokeWidth: 1.5 },
    labelStyle: { fill: '#a0aec0', fontSize: 11 },
    labelBgStyle: { fill: '#0f1117', fillOpacity: 0.8 },
    labelBgPadding: [4, 3] as [number, number],
    labelBgBorderRadius: 3,
  }));

  return { nodes, edges };
}
