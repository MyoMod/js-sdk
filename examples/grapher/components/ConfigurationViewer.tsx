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
  useReactFlow,
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
import { temp } from "three/webgpu";

// Define configuration data type
export interface ConfigurationData {
  name: string;
  color: number;
  deviceNodes: any[];
  embeddedDeviceNodes: any[];
  algorithmicNodes: any[];
  links: {
    [key: string]: string;
  };
  positions: {
    [key: string]: {
      x: number;
      y: number;
    };
  };
}

interface ConfigurationViewerProps {
  configData: ConfigurationData | null;
  onConfigChange?: (config: Partial<ConfigurationData>) => void;
}

// Define base node types
const baseNodeTypes: {
  [key: string]: React.FC<any>;
} = {
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
  const [showNodeMenu, setShowNodeMenu] = useState(false);

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

  // Handle node option changes
  const handleNodeOptionChange = useCallback(
    (nodeId: string, optionName: string, newValue: any) => {
      if (!configData || !onConfigChange) return;

      // Find which array the node belongs to based on its ID prefix
      let nodeArray: string;
      let nodeIndex: number;

      if (nodeId.startsWith("e")) {
        nodeArray = "embeddedDeviceNodes";
        nodeIndex = parseInt(nodeId.substring(1));
      } else if (nodeId.startsWith("d")) {
        nodeArray = "deviceNodes";
        nodeIndex = parseInt(nodeId.substring(1));
      } else if (nodeId.startsWith("a")) {
        nodeArray = "algorithmicNodes";
        nodeIndex = parseInt(nodeId.substring(1));
      } else {
        console.error(`Unknown node ID format: ${nodeId}`);
        return;
      }

      // Create a deep clone of the config data to avoid direct mutation
      const updatedConfig = JSON.parse(JSON.stringify(configData));

      // Update the option in the node
      if (updatedConfig[nodeArray] && updatedConfig[nodeArray][nodeIndex]) {
        updatedConfig[nodeArray][nodeIndex][optionName] = newValue;

        // Notify parent of the configuration change
        onConfigChange(updatedConfig);
      }
    },
    [configData, onConfigChange]
  );

  // Function to generate node types from node definitions
  const generateNodeTypes = useCallback(() => {
    const newNodeTypes: { [key: string]: any } = { ...baseNodeTypes };
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
            ...node,
            inputs: inputPorts,
            outputs: outputPorts,
            inputGroups,
            outputGroups,
            nodeIndex: index,
            nodeType: "deviceNode",
            shortDescription: node?.short,
            onOptionsChange: props.data.onOptionChange,
            ...props.data,
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
            ...node,
            inputs: inputPorts,
            outputs: outputPorts,
            inputGroups,
            outputGroups,
            nodeIndex: index,
            nodeType: "embeddedDeviceNode",
            onOptionsChange: props.data.onOptionChange,
            ...props.data,
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
            ...node,
            inputs: inputPorts,
            outputs: outputPorts,
            inputGroups,
            outputGroups,
            nodeIndex: index,
            nodeType: "algorithmicNode",
            onOptionsChange: props.data.onOptionChange,
            ...props.data,
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

  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      // Check if the connection is valid based on the node types and ports
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);

      // Check if both nodes exist and have valid types
      if (
        !sourceNode?.type ||
        !targetNode?.type ||
        !nodePortTypes[sourceNode.type] ||
        !nodePortTypes[targetNode.type]
      ) {
        return false;
      }

      const sourcePortTypes = nodePortTypes[sourceNode.type].outputs;
      const targetPortTypes = nodePortTypes[targetNode.type].inputs;

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
    },
    [nodes, nodePortTypes]
  );

  // Handle new connections
  const onConnect = useCallback(
    (params: Edge | Connection) => {
      if (!configData || !onConfigChange) return;

      const sourceNode = params.source;
      const sourcePortIndex = Number(params.sourceHandle?.split("-").pop());
      const targetNode = params.target;
      const targetPortIndex = Number(params.targetHandle?.split("-").pop());
      const sourcePort = `${sourceNode}:${sourcePortIndex}`;
      const targetPort = `${targetNode}:${targetPortIndex}`;

      const newLinks = {
        ...configData.links,
        [targetPort]: sourcePort,
      };

      // Send updated links to parent component
      onConfigChange({
        ...configData,
        links: newLinks,
      });
    },
    [configData, onConfigChange]
  );

  // Handle edge deletions
  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      if (!configData || !onConfigChange) return;

      const linksToRemove: { [key: string]: string } = {};

      edgesToDelete.forEach((edge) => {
        const [sourceNode, sourcePortIndex, targetNode, targetPortIndex] =
          edge.id.split("-");
        const sourcePort = `${sourceNode}:${sourcePortIndex}`;
        const targetPort = `${targetNode}:${targetPortIndex}`;
        linksToRemove[targetPort] = sourcePort;
      });

      // Create a new links object without the deleted edges
      const newLinks = { ...configData.links };
      Object.keys(linksToRemove).forEach((key) => {
        delete newLinks[key];
      });

      // Send updated links to parent component
      onConfigChange({
        ...configData,
        links: newLinks,
      });
    },
    [configData, onConfigChange]
  );

  const onNodeMoved = useCallback(
    (event: any, node: Node) => {
      if (!configData || !onConfigChange) return;

      // Create a deep clone of the config data to avoid direct mutation
      const updatedConfig = JSON.parse(JSON.stringify(configData));

      // Update the position in the config data
      if (updatedConfig.positions) {
        updatedConfig.positions[node.id] = {
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
        };
      }

      // Notify parent of the configuration change
      onConfigChange(updatedConfig);
    },
    [configData, onConfigChange]
  );

  // Function to apply automatic layout using ELK
  const applyLayout = useCallback(async () => {
    if (!configData || !onConfigChange) return;
    if (nodes.length === 0) return;
    if (nodes[0].measured === undefined) return;

    // Prevent multiple layout operations at the same time
    if (isLayouting) return;

    setIsLayouting(true);

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
        ports: [...inputPorts, ...outputPorts],
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

      // apply the layout to configData
      if (newGraph.children) {
        const layoutedNodes: {
          id: string;
          position: { x: number | undefined; y: number | undefined };
        }[] = newGraph.children.map((node) => {
          const nodeId: string = node.id;
          const position = {
            x: node.x,
            y: node.y,
          };
          return {
            id: nodeId,
            position,
          };
        });

        // Update the positions in the configData
        const updatedPositions = layoutedNodes.reduce((acc, node) => {
          if (node.position.x !== undefined && node.position.y !== undefined) {
            acc[node.id] = {
              x: Math.round(node.position.x),
              y: Math.round(node.position.y),
            };
          }
          return acc;
        }, {} as { [key: string]: { x: number; y: number } });

        onConfigChange({
          ...configData,
          positions: updatedPositions,
        });
      }
    } catch (error) {
      console.error("Error applying layout:", error);
    } finally {
      setIsLayouting(false);
    }
  }, [nodes, edges, isLayouting, configData, onConfigChange]);

  // Group node definitions by type
  const nodesByCategory = useMemo(() => {
    return {
      deviceNodes: nodeDefinitions.deviceNodes,
      embeddedDeviceNodes: nodeDefinitions.embeddedDeviceNodes,
      algorithmicNodes: nodeDefinitions.algorithmicNodes,
    };
  }, []);

  // Add a new node to the flow
  const handleAddNode = useCallback(
    (nodeType: string, category: string) => {
      if (!configData || !onConfigChange) return;

      // Get the array name based on category
      const arrayName = category as keyof Pick<
        ConfigurationData,
        "deviceNodes" | "embeddedDeviceNodes" | "algorithmicNodes"
      >;

      // Find the node definition
      const nodeDef = nodeDefinitions[arrayName].find(
        (n: any) => n.type === nodeType
      );
      if (!nodeDef) return;

      // Get default node data
      const defaultNodeData: any = nodeDef.example;

      // If the node has a ID prompt the user for a name
      if (defaultNodeData.ID) {
        const nodeName = prompt("Enter a name for the new node:", "New Node");
        if (nodeName) {
          defaultNodeData.ID = nodeName;
        }
      }

      // Add the node to the appropriate array
      const newConfigData = {
        ...configData,
        [arrayName]: [
          ...configData[arrayName],
          {
            ...defaultNodeData,
          },
        ],
      };

      // Close the menu
      setShowNodeMenu(false);

      // Update the configuration data
      onConfigChange(newConfigData);
    },
    [configData, onConfigChange]
  );

  // Initialize node types once
  useEffect(() => {
    const [customNodeTypes, customNodePortTypes] = generateNodeTypes();
    setNodeTypes(customNodeTypes);
    setNodePortTypes(customNodePortTypes);
  }, [generateNodeTypes]);

  // Process config data when it changes
  useEffect(() => {
    // If configData is null, reset nodes and edges
    if (!configData) {
      setNodes([]);
      setEdges([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // If we have config data, parse it and create edges
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

        const position = (configData.positions &&
          configData.positions[nodeId]) || {
          x: 200 + (index % 3) * 300,
          y: 100 + Math.floor(index / 3) * 200,
        };

        return {
          id: nodeId,
          type: nodeType,
          position: position,
          data: {
            type: nodeType,
            configData: node.nodeData,
            id: nodeId,
            nodeID: node.nodeData.ID,
            onOptionChange: handleNodeOptionChange,
          },
        };
      });
      setNodes(newNodes);

      const newEdges: Edge[] = [];

      // Iterate through each link in the configuration
      // and create edges based on the source and target nodes
      // and their respective ports
      Object.entries(configData.links).forEach(([target, source], index) => {
        // Parse target and source strings (format: "nodeType+index:port")
        const [targetNodeId, targetPort] = target.split(":");
        const [sourceNodeId, sourcePort] = source.split(":");

        newEdges.push({
          id: `${sourceNodeId}-${sourcePort}-${targetNodeId}-${targetPort}`,
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle: `${sourceNodeId}-output-${sourcePort}`,
          targetHandle: `${targetNodeId}-input-${targetPort}`,
          type: "default",
          animated: false,
        });
      });
      setEdges(newEdges);

      setIsLoading(false);

    } catch (error) {
      console.error("Error handling configuration data:", error);
      setIsLoading(false); // Make sure to set loading to false even if there's an error
    }
  }, [configData, setNodes, setEdges]);


  // Apply layout when nodes and edges are ready and have no positions set
  useEffect(() => {
    if(!configData || configData.positions) return;
    if(nodes.length === 0) return;
    if(edges.length === 0) return;

    applyLayout();

    // Set initial positions for nodes via configData
  }, [nodes, edges, configData, applyLayout]);



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
      case "e":
        // Embedded Device Node
        return "#e8f5e9";
      case "a":
        // Algorithmic Node
        return "#fff8e1";
      case "d":
        // Device Node
        return "#e3f2fd";
      default:
        return "#000000";
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
          onNodeDragStop={onNodeMoved}
          onNodesDelete={() => {}}
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
          <MiniMap pannable draggable nodeColor={nodeColor} />
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

              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowNodeMenu(!showNodeMenu)}
                  style={{
                    background: "#673ab7",
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
                  <AddNodeIcon />
                  Add Node
                </button>

                {showNodeMenu && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      zIndex: 10,
                      backgroundColor: "white",
                      borderRadius: "4px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      marginTop: "4px",
                      width: "280px",
                      maxHeight: "400px",
                      overflowY: "auto",
                      padding: "8px 0",
                    }}
                  >
                    <div
                      style={{
                        padding: "0 12px 8px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      <h4
                        style={{
                          margin: "0 0 8px",
                          color: "#444",
                        }}
                      >
                        Add New Node
                      </h4>
                    </div>

                    {/* Device Nodes */}
                    <NodeCategorySection
                      title="Device Nodes"
                      nodes={nodesByCategory.deviceNodes}
                      category="deviceNodes"
                      color="#2196f3"
                      onSelect={handleAddNode}
                    />

                    {/* Embedded Device Nodes */}
                    <NodeCategorySection
                      title="Embedded Devices"
                      nodes={nodesByCategory.embeddedDeviceNodes}
                      category="embeddedDeviceNodes"
                      color="#4caf50"
                      onSelect={handleAddNode}
                    />

                    {/* Algorithmic Nodes */}
                    <NodeCategorySection
                      title="Algorithmic Nodes"
                      nodes={nodesByCategory.algorithmicNodes}
                      category="algorithmicNodes"
                      color="#ffc107"
                      onSelect={handleAddNode}
                    />
                  </div>
                )}
              </div>
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

// Node category section component
const NodeCategorySection = ({
  title,
  nodes,
  category,
  color,
  onSelect,
}: {
  title: string;
  nodes: any[];
  category: string;
  color: string;
  onSelect: (type: string, category: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ margin: "4px 0" }}>
      <div
        style={{
          padding: "8px 12px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderLeft: `4px solid ${color}`,
          backgroundColor: expanded ? "#f5f5f5" : "transparent",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ fontWeight: 500 }}>{title}</div>
        <div>{expanded ? "▼" : "►"}</div>
      </div>

      {expanded && (
        <div style={{ padding: "4px 0" }}>
          {nodes.map((node) => (
            <div
              key={node.type}
              style={{
                padding: "6px 12px 6px 24px",
                cursor: "pointer",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#333",
                "&:hover": {
                  backgroundColor: "#f0f0f0",
                },
              }}
              onClick={() => onSelect(node.type, category)}
              onMouseOver={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "#f0f0f0";
              }}
              onMouseOut={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  backgroundColor: color,
                  borderRadius: "2px",
                }}
              />
              <div>{node.name || node.type}</div>
            </div>
          ))}
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

// Add node icon component
const AddNodeIcon = () => (
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
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="12" y1="8" x2="12" y2="16"></line>
    <line x1="8" y1="12" x2="16" y2="12"></line>
  </svg>
);
