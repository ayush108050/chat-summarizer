'use client';

/**
 * TriageCanvas — SSR-safe React Flow canvas for the Outer Wilds Rumor Mode.
 *
 * - Uses @xyflow/react ReactFlow, Background (Dots), Controls.
 * - Registers RumorNodeComponent under the key 'rumorNode'.
 * - Receives pre-laid-out nodes + edges from the parent (layout computed by
 *   src/lib/layout.ts) and an onSelectNode callback.
 * - Wrapped in ReactFlowProvider so the hook context is self-contained.
 *
 * 'use client' ensures this never runs during SSR (React Flow uses browser APIs).
 */

import { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react';
import type { Node, Edge, NodeMouseHandler } from '@xyflow/react';

import RumorNodeComponent from '@/components/RumorNodeComponent';
import type { RumorNode } from '@/types/rumor';

// ---------------------------------------------------------------------------
// Node type registry — must be defined outside the component to be stable.
// ---------------------------------------------------------------------------
const NODE_TYPES = {
  rumorNode: RumorNodeComponent,
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface TriageCanvasProps {
  /** Pre-laid-out React Flow nodes (positions set by computeLayout). */
  nodes: Node[];
  /** Typed edges with style presets applied. */
  edges: Edge[];
  /** Called when the user clicks a node; receives the full RumorNode data. */
  onSelectNode: (node: RumorNode) => void;
}

// ---------------------------------------------------------------------------
// Inner canvas (needs ReactFlowProvider ancestor)
// ---------------------------------------------------------------------------
function TriageCanvasInner({
  nodes: initialNodes,
  edges: initialEdges,
  onSelectNode,
}: TriageCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { fitView } = useReactFlow();

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    if (initialNodes.length > 0) {
      window.requestAnimationFrame(() => {
        fitView({ padding: 0.2, duration: 400 });
      });
    }
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);

  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      // data is RumorNode at runtime; cast via unknown to recover the typed shape
      const rumorNode = node.data as unknown as RumorNode;
      onSelectNode(rumorNode);
    },
    [onSelectNode]
  );

  return (
    <div
      className="triage-canvas-wrapper"
      style={{ width: '100%', height: '100%', background: '#080b14' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
        minZoom={0.2}
        maxZoom={2.5}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#334155', strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
        /* Accessibility */
        aria-label="Outer Wilds Rumor Mode Triage Graph"
      >
        {/* Deep space dot grid */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color="#1e293b"
          bgColor="#080b14"
        />

        {/* Zoom / pan controls positioned bottom-left */}
        <Controls
          position="bottom-left"
          showFitView
          showZoom
          showInteractive={false}
          style={{
            background: 'rgba(15,17,30,0.9)',
            border: '1px solid #1e293b',
            borderRadius: '8px',
          }}
        />
      </ReactFlow>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported wrapper — provides the React Flow context + handles SSR boundary
// ---------------------------------------------------------------------------
export default function TriageCanvas(props: TriageCanvasProps) {
  return (
    <ReactFlowProvider>
      <TriageCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
