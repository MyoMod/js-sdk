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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { BaseNode, NodePort } from "./nodeTypes/BaseNode";
import nodeDefinitions from "../configurationManager/node_definitions.json";
import { Example } from "@react-three/drei";
import { EmbeddedDeviceNode } from "./nodeTypes/EmbeddedDeviceNode";
import { DeviceNode } from "./nodeTypes/DeviceNode";
import { AlgorithmicNode } from "./nodeTypes/AlgorithmicNode";
import DevTools from "../configurationManager/Devtools";

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
}

// Define base node types
const baseNodeTypes = {
  deviceNode: DeviceNode,
  algorithmicNode: AlgorithmicNode,
  embeddedDeviceNode: EmbeddedDeviceNode,
};

export const ConfigurationViewer: React.FC<ConfigurationViewerProps> = ({
  configData,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [nodeTypes, setNodeTypes] = useState(baseNodeTypes);

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
    const newNodeTypes = { ...baseNodeTypes };

    // Process device nodes
    nodeDefinitions.deviceNodes.forEach((node, index) => {
      const { inputPorts, outputPorts, inputGroups, outputGroups } =
        createPorts(node);

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

    return newNodeTypes;
  }, []);

  // Function to generate placeholder nodes for the initial view
  const generatePlaceholderNodes = useCallback(() => {
    const placeholderNodes: Node[] = [];
    let yPos = 50;

    // Device nodes placeholders
    nodeDefinitions.deviceNodes.forEach((node, index) => {
      placeholderNodes.push({
        id: `d${index}`,
        type: node.type,
        position: { x: 100, y: yPos },
        data: { label: node.name || `Device ${index}` },
      });
      yPos += 200;
    });

    // Embedded device nodes placeholders
    yPos = 50;
    nodeDefinitions.embeddedDeviceNodes.forEach((node, index) => {
      placeholderNodes.push({
        id: `e${index}`,
        type: node.type,
        position: { x: 400, y: yPos },
        data: { label: node.name || `Embedded ${index}` },
      });
      yPos += 200;
    });

    // Algorithmic nodes placeholders
    yPos = 50;
    nodeDefinitions.algorithmicNodes.forEach((node, index) => {
      placeholderNodes.push({
        id: `a${index}`,
        type: node.type,
        position: { x: 700, y: yPos },
        data: { label: node.name || `Algorithm ${index}` },
      });
      yPos += 200;
    });

    return placeholderNodes;
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

  // Initialize node types once
  useEffect(() => {
    const customNodeTypes = generateNodeTypes();
    setNodeTypes(customNodeTypes);
  }, [generateNodeTypes]);

  // Process config data when it changes
  useEffect(() => {
    setIsLoading(true);

    // Initialize with placeholder nodes
    const placeholderNodes = generatePlaceholderNodes();
    setNodes(placeholderNodes);

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
            data: { ...node.nodeData, nodeIndex: index, id: nodeId },
          };
        });
        setNodes(newNodes);

        const newEdges = generateEdges(configData);
        setEdges(newEdges);
      } catch (error) {
        console.error("Error handling configuration data:", error);
      }
    } else {
      setEdges([]);
    }

    setIsLoading(false);
  }, [configData, generatePlaceholderNodes, generateEdges, setNodes, setEdges]);

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
          Loading configuration...
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
          connectionLineType={ConnectionLineType.SmoothStep}
        >
          <Controls />
          <MiniMap />
          <Background color="#aaa" gap={16} />
          <Panel position="top-left">
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
