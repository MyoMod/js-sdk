import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  ConnectionLineType,
  Panel,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Connection,
  addEdge,
  OnConnect,
  OnEdgesDelete,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { BaseNode, NodePort } from "./nodeTypes/BaseNode";
import nodeDefinitions from "../configurationManager/node_definitions.json";
import { Example } from "@react-three/drei";
import { EmbeddedDeviceNode } from "./nodeTypes/EmbeddedDeviceNode";
import { DeviceNode } from "./nodeTypes/DeviceNode";
import { AlgorithmicNode } from "./nodeTypes/AlgorithmicNode";
import DevTools from "../configurationManager/Devtools";
import ELK from "elkjs/lib/elk.bundled.js";

// Define configuration data type
interface ConfigurationData {
  name: string;
  color: number;
  deviceNodes: any[];
  embeddedDeviceNodes: any[];
  algorithmicNodes: any[];
  links: {
    [key: string]: string;
  };
}

interface ConfigurationViewerProps {
  configData: ConfigurationData | null;
  onConfigChange?: (config: Partial<ConfigurationData>) => void; // New callback for config changes
}

// Define base node types
const baseNodeTypes : {
  [key: string]: React.FC<any>;
}= {
  deviceNode: DeviceNode,
  algorithmicNode: AlgorithmicNode,
  embeddedDeviceNode: EmbeddedDeviceNode,
};

interface NodeTypes {
  [key: string]: {
    inputs: string[];
    outputs: string[];
  };
}

// Create an instance of ELK
const elk = new ELK();

export const ConfigurationViewer: React.FC<ConfigurationViewerProps> = ({
  configData,
  onConfigChange,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [nodeTypes, setNodeTypes] = useState(baseNodeTypes);
  const [nodePortTypes, setNodePortTypes] = useState<NodeTypes>({});
  const [isLayouting, setIsLayouting] = useState(false);

  // Helper function to create ports from node definition
  const createPorts = (node: any) => {
    const inputPorts: NodePort[] = [];
    const inputGroups: {
      [key: string]: { name: string; description: string; type: string };
    } = {};

    if (node.inputs) {
      node.inputs.forEach((input: any, i: number) => {
        // Create a unique key for this group
        const groupKey = `input-${i}`;

        // Store group information
        inputGroups[groupKey] = {
          name: input.name,
          description: input.description || "",
          type: input.type,
        };

        // Create ports for this group
        for (let j = 0; j < input.number; j++) {
          inputPorts.push({
            name: input.names?.[j] || `${j + 1}`,
            type: input.type,
            index: inputPorts.length,
            groupKey: groupKey,
          });
        }
      });
    }

    const outputPorts: NodePort[] = [];
    const outputGroups: {
      [key: string]: { name: string; description: string; type: string };
    } = {};

    if (node.outputs) {
      node.outputs.forEach((output: any, i: number) => {
        // Create a unique key for this group
        const groupKey = `output-${i}`;

        // Store group information
        outputGroups[groupKey] = {
          name: output.name,
          description: output.description || "",
          type: output.type,
        };

        // Create ports for this group
        for (let j = 0; j < output.number; j++) {
          outputPorts.push({
            name: output.names?.[j] || `${j + 1}`,
            type: output.type,
            index: outputPorts.length,
            groupKey: groupKey,
          });
        }
      });
    }

    return {
      inputPorts,
      outputPorts,
      inputGroups,
      outputGroups,
    };
  };

  // Function to generate node types from node definitions
  const generateNodeTypes = useCallback(() => {
    const newNodeTypes : { [key: string]: any } = { ...baseNodeTypes };
    const newNodePortTypes: NodeTypes = {};

    // Process device nodes
    nodeDefinitions.deviceNodes.forEach((node, index) => {
      const { inputPorts, outputPorts, inputGroups, outputGroups } =
        createPorts(node);

      newNodePortTypes[node.type] = {
        inputs: inputPorts.map((port) => port.type),
        outputs: outputPorts.map((port) => port.type),
      };

      newNodeTypes[node.type] = (props: any) => (
        <DeviceNode
          {...props}
          data={{
            ...props.data,
            ...node,
            inputs: inputPorts,
            outputs: outputPorts,
            inputGroups,
            outputGroups,
            nodeIndex: index,
            nodeType: "deviceNode",
            nodeID: node.example_id,
            shortDescription: node?.short,
          }}
        />
      );
    });

    // Process embedded device nodes
    nodeDefinitions.embeddedDeviceNodes.forEach((node, index) => {
      const { inputPorts, outputPorts, inputGroups, outputGroups } =
        createPorts(node);

      newNodePortTypes[node.type] = {
        inputs: inputPorts.map((port) => port.type),
        outputs: outputPorts.map((port) => port.type),
      };

      newNodeTypes[node.type] = (props: any) => (
        <EmbeddedDeviceNode
          {...props}
          data={{
            ...props.data,
            ...node,
            inputs: inputPorts,
            outputs: outputPorts,
            inputGroups,
            outputGroups,
            nodeIndex: index,
            nodeType: "embeddedDeviceNode",
            nodeID: node.example_id,
          }}
        />
      );
    });

    // Process algorithmic nodes
    nodeDefinitions.algorithmicNodes.forEach((node, index) => {
      const { inputPorts, outputPorts, inputGroups, outputGroups } =
        createPorts(node);

      newNodePortTypes[node.type] = {
        inputs: inputPorts.map((port) => port.type),
        outputs: outputPorts.map((port) => port.type),
      };

      newNodeTypes[node.type] = (props: any) => (
        <AlgorithmicNode
          {...props}
          data={{
            ...props.data,
            ...node,
            inputs: inputPorts,
            outputs: outputPorts,
            inputGroups,
            outputGroups,
            nodeIndex: index,
            nodeType: "algorithmicNode",
          }}
        />
      );
    });

    return [newNodeTypes, newNodePortTypes];
  }, []);

  // Toggle full screen mode
  const toggleFullScreen = useCallback(() => {
    setIsFullScreen((prev) => !prev);
  }, []);

  // Handle escape key to exit full screen mode
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) {
        setIsFullScreen(false);
      }
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isFullScreen]);

  // Generate edges from configuration data
  const generateEdges = useCallback((config: ConfigurationData) => {
    if (!config || !config.links) return [];

    const newEdges: Edge[] = [];

    // Iterate through each link in the configuration
    // and create edges based on the source and target nodes
    // and their respective ports
    Object.entries(config.links).forEach(([target, source], index) => {
      // Parse target and source strings (format: "nodeType+index:port")
      const [targetNodeId, targetPort] = target.split(":");
      const [sourceNodeId, sourcePort] = source.split(":");

      newEdges.push({
        id: `${sourceNodeId}-${sourcePort}-${targetNodeId}-${targetPort}-${index}`,
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle: `${sourceNodeId}-output-${sourcePort}`,
        targetHandle: `${targetNodeId}-input-${targetPort}`,
        type: "default",
        animated: false,
      });
    });

    return newEdges;
  }, []);

  // Function to update the configuration when edges change
  const updateConfigFromEdges = useCallback(
    (newEdges: Edge[]) => {
      if (!configData || !onConfigChange) return;

      // Create a new links object from the edges
      const newLinks: { [key: string]: string } = {};

      newEdges.forEach((edge) => {
        if (edge.sourceHandle && edge.targetHandle) {
          // Extract port indices from handles
          const sourceNodeId = edge.source;
          const targetNodeId = edge.target;
          const sourcePort = edge.sourceHandle.split("-").pop();
          const targetPort = edge.targetHandle.split("-").pop();

          if (sourcePort && targetPort) {
            // Format: "nodeType+index:port"
            const targetKey = `${targetNodeId}:${targetPort}`;
            const sourceValue = `${sourceNodeId}:${sourcePort}`;
            newLinks[targetKey] = sourceValue;
          }
        }
      });

      // Send updated links to parent component
      onConfigChange({
        ...configData,
        links: newLinks,
      });
    },
    [configData, onConfigChange]
  );

  const isValidConnection = (connection: Edge | Connection) => {
    // Check if the connection is valid based on the node types and ports
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);

    const sourcePortTypes = nodePortTypes[sourceNode?.type].outputs;
    const targetPortTypes = nodePortTypes[targetNode?.type].inputs;

    const sourcePortIndex = Number(connection.sourceHandle?.split("-").pop());
    const targetPortIndex = Number(connection.targetHandle?.split("-").pop());

    // Check if we have valid port indexes
    if (isNaN(sourcePortIndex) || isNaN(targetPortIndex)) return false;

    // Check if one of the port types is dynamic
    if (
      sourcePortTypes[sourcePortIndex] === "dynamic" ||
      targetPortTypes[targetPortIndex] === "dynamic"
    ) {
      return true; // Allow dynamic connections
    }

    // Check if the port types match
    return (
      sourcePortTypes[sourcePortIndex] === targetPortTypes[targetPortIndex]
    );
  };

  // Handle new connections
  const onConnect = useCallback(
    (params: Edge |Connection) => {
      // Create a new edge with the connection params
      const newEdges = addEdge(
        {
          ...params,
          type: "default",
          animated: false,
          id: `${params.source}-${params.sourceHandle}-${params.target}-${params.targetHandle}`,
        },
        edges
      );

      setEdges(newEdges);
      updateConfigFromEdges(newEdges);
    },
    [edges, setEdges, updateConfigFromEdges]
  );

  // Handle edge deletions
  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      // The edges have already been deleted from the state at this point
      // Just need to update the configuration
      updateConfigFromEdges(
        edges.filter((edge) => !edgesToDelete.some((e) => e.id === edge.id))
      );
    },
    [edges, updateConfigFromEdges]
  );

  // Handle edge updates
  useEffect(() => {
    // We don't want to update config during initial loading
    if (!isLoading && edges.length > 0) {
      updateConfigFromEdges(edges);
    }
  }, [edges, isLoading, updateConfigFromEdges]);

  // Function to apply automatic layout using ELK
  const applyLayout = useCallback(async () => {
    if (nodes.length === 0) return;

    // Prevent multiple layout operations at the same time
    if (isLayouting) return;

    setIsLayouting(true);

    // TODO: Properly add handles to elk nodes to improve auto-layout
    // Convert nodes and edges to ELK format
    const elkNodes = nodes.map((node) => {
      const nInputPorts = nodePortTypes[node.type]?.inputs.length || 0;
      const nOutputPorts = nodePortTypes[node.type]?.outputs.length || 0;

      const inputPorts = Array.from({ length: nInputPorts }, (_, i) => ({
        id: `${node.id}-input-${i}`,
        properties: {
          side: "WEST",
        },
      }));
      const outputPorts = Array.from({ length: nOutputPorts }, (_, i) => ({
        id: `${node.id}-output-${i}`,
        properties: {
          side: "EAST",
        },
      }));
      outputPorts.reverse();
      inputPorts.reverse();
      return {
        id: node.id,
        width: node.measured.width,
        height: node.measured.height,
        properties: {
          "org.eclipse.elk.portConstraints": "FIXED_ORDER",
        },
        ports: [
          ...inputPorts,
          ...outputPorts,
        ],
      };

    });

    const elkEdges = edges.map((edge) => ({
      id: edge.id,
      sources: [edge.sourceHandle || edge.source],
      targets: [edge.targetHandle || edge.target],
    }));

    // Create ELK graph structure
    const elkGraph = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "25",
        "elk.layered.spacing.nodeNodeBetweenLayers": "100",
        "elk.aspectRatio": "3",
        //"elk.layered.nodePlacement.strategy": "SIMPLE",
      },
      children: elkNodes,
      edges: elkEdges,
    };

    try {
      // Calculate layout
      const newGraph = await elk.layout(elkGraph);

      // Apply the layout to the nodes
      if (newGraph.children) {
        const layoutedNodes = nodes.map((node) => {
          const elkNode = newGraph.children?.find((n) => n.id === node.id);
          if (elkNode && elkNode.x !== undefined && elkNode.y !== undefined) {
            return {
              ...node,
              position: {
                x: elkNode.x,
                y: elkNode.y,
              },
            };
          }
          return node;
        });

        setNodes(layoutedNodes);
      }
    } catch (error) {
      console.error("Error applying layout:", error);
    } finally {
      setIsLayouting(false);
    }
  }, [nodes, edges, setNodes, isLayouting]);

  // Initialize node types once
  useEffect(() => {
    const [customNodeTypes, customNodePortTypes] = generateNodeTypes();
    setNodeTypes(customNodeTypes);
    setNodePortTypes(customNodePortTypes);
  }, [generateNodeTypes]);

  // Process config data when it changes
  useEffect(() => {
    setIsLoading(true);

    // If we have config data, parse it and create edges
    if (configData) {
      try {
        // Generate nodes based on the configuration
        const configNodes: {
          id: string;
          nodeData: any;
        }[] = [
          ...configData.embeddedDeviceNodes.map((node, index) => ({
            id: `e${index}`,
            nodeData: node,
          })),
          ...configData.deviceNodes.map((node, index) => ({
            id: `d${index}`,
            nodeData: node,
          })),
          ...configData.algorithmicNodes.map((node, index) => ({
            id: `a${index}`,
            nodeData: node,
          })),
        ];

        const newNodes: Node[] = configNodes.map((node, index) => {
          const nodeType = node.nodeData.type;
          const nodeId = node.id;

          return {
            id: nodeId,
            type: nodeType,
            position: {
              x: 200 + (index % 3) * 300,
              y: 100 + Math.floor(index / 3) * 200,
            },
            data: { type: nodeType, configData: node.nodeData, id: nodeId },
          };
        });
        setNodes(newNodes);

        const newEdges = generateEdges(configData);
        setEdges(newEdges);

        // Set loading to false immediately after nodes and edges are set
        setIsLoading(false);
      } catch (error) {
        console.error("Error handling configuration data:", error);
        setIsLoading(false); // Make sure to set loading to false even if there's an error
      }
    } else {
      setEdges([]);
      setIsLoading(false); // Set loading to false if there's no config data
    }
  }, [configData, generateEdges, setNodes, setEdges]);

  // Add a dedicated useEffect to make sure spinner is correctly displayed
  useEffect(() => {
    // Add a safety timeout to ensure loading state doesn't get stuck
    const safetyTimer = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        console.warn("Loading state was forced to complete after timeout");
      }
    }, 3000); // 3 seconds safety timeout

    return () => clearTimeout(safetyTimer);
  }, [isLoading]);

  // Full screen mode styles
  const containerStyles = isFullScreen
    ? {
        position: "fixed" as "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
        backgroundColor: "white",
      }
    : { width: "100%", height: "500px" };

  // Minimap colorization
  function nodeColor(node: any) {
  switch (node.data?.id?.[0]) {
    case 'e':
      // Embedded Device Node
      return '#e8f5e9';
    case 'a':
      // Algorithmic Node
      return '#fff8e1';
    case 'd':
      // Device Node
      return '#e3f2fd';
    default:
      return '#000000';
  }
}

  return (
    <div style={containerStyles}>
      {isLoading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                border: "4px solid rgba(0, 0, 0, 0.1)",
                borderLeft: "4px solid #3498db",
                borderRadius: "50%",
                width: "30px",
                height: "30px",
                animation: "spin 1s linear infinite",
                margin: "0 auto 10px auto",
              }}
            ></div>
            Loading configuration...
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
          deleteKeyCode={["Backspace", "Delete"]}
          edgesFocusable={true}
          edgesReconnectable={true}
          connectOnClick={true}
          isValidConnection={isValidConnection}
        >
          <Controls />
          <MiniMap pannable draggable nodeColor={nodeColor}/>
          <Background color="#aaa" gap={16} />
          <Panel position="top-left">
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={toggleFullScreen}
                style={{
                  background: isFullScreen ? "#ff4757" : "#2196f3",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  padding: "8px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
                }}
              >
                {isFullScreen ? (
                  <>
                    <ExitFullscreenIcon /> Exit Fullscreen
                  </>
                ) : (
                  <>
                    <FullscreenIcon /> Fullscreen
                  </>
                )}
              </button>

              <button
                onClick={applyLayout}
                disabled={isLayouting}
                style={{
                  background: "#4caf50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  padding: "8px 12px",
                  cursor: isLayouting ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
                  opacity: isLayouting ? 0.7 : 1,
                }}
              >
                <LayoutIcon />
                {isLayouting ? "Applying Layout..." : "Auto Layout"}
              </button>
            </div>
          </Panel>
          <Panel position="top-right">
            <div
              style={{
                backgroundColor: "white",
                padding: "8px",
                borderRadius: "4px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
              }}
            >
              <div style={{ marginBottom: "4px", fontWeight: "bold" }}>
                Node Types:
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "5px" }}
                >
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      backgroundColor: "#e3f2fd",
                      border: "1px solid #2196f3",
                    }}
                  ></div>
                  <span>Device</span>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "5px" }}
                >
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      backgroundColor: "#e8f5e9",
                      border: "1px solid #4caf50",
                    }}
                  ></div>
                  <span>Embedded</span>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "5px" }}
                >
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      backgroundColor: "#fff8e1",
                      border: "1px solid #ffc107",
                    }}
                  ></div>
                  <span>Algorithm</span>
                </div>
              </div>
              <div
                style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}
              >
                Tip: Connect nodes by dragging between ports. Delete connections
                with Delete key.
              </div>
            </div>
          </Panel>
        </ReactFlow>
      )}

      {/* Overlay for full screen mode notice */}
      {isFullScreen && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.7)",
            color: "white",
            padding: "8px 16px",
            borderRadius: "20px",
            fontSize: "14px",
            pointerEvents: "none",
            opacity: 0.7,
          }}
        >
          Press ESC to exit fullscreen
        </div>
      )}

      {/* Loading overlay for layout operation */}
      {isLayouting && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(255,255,255,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "16px 24px",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div className="spinner"></div>
            <span>Optimizing layout...</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple icon components for fullscreen buttons
const FullscreenIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
  </svg>
);

const ExitFullscreenIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 14h3v3m6-9h3V5m0 10v3h3m-9-9V5H4"></path>
  </svg>
);

// Layout icon component
const LayoutIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7"></rect>
    <rect x="14" y="3" width="7" height="7"></rect>
    <rect x="14" y="14" width="7" height="7"></rect>
    <rect x="3" y="14" width="7" height="7"></rect>
  </svg>
);
