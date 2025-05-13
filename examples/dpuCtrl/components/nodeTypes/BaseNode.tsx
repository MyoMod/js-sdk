import React, { useState } from "react";
import { Handle, Position } from "@xyflow/react";

export interface NodePort {
  name: string;
  type: string;
  index: number;
  groupKey?: string; // Added groupKey to identify the group this port belongs to
}

export interface NodeOption {
  default?: any;
  [key: string]: any;
}

export interface NodeStyleOptions {
  backgroundColor: string;
  borderColor: string;
  labelBackgroundColor?: string;
  labelTextColor?: string;
}

export interface BaseNodeData {
  name: string;
  type: string;
  id: string; // Unique identifier for the node (e.g., "a0", "b1")
  nodeID?: string; // MyoMod device ID (e.g., "Embed' EMG"), only for devices and embeddeddevices
  description: string;
  shortDescription?: string;
  inputs?: NodePort[];
  outputs?: NodePort[];
  inputGroups?: {
    [key: string]: { name: string; description: string; type: string };
  };
  outputGroups?: {
    [key: string]: { name: string; description: string; type: string };
  };
  options?: Record<string, any | NodeOption>;
  nodeType: string;
}

interface BaseNodeProps {
  data: BaseNodeData;
  children?: React.ReactNode;
  labelText?: string;
  style: NodeStyleOptions;
}

export const BaseNode: React.FC<BaseNodeProps> = ({
  data,
  children,
  labelText,
  style,
}) => {
  const {
    name,
    description,
    shortDescription,
    inputs,
    outputs,
    inputGroups,
    outputGroups,
    options,
    id,
    nodeID,
    nodeType,
  } = data;

  // State to track which group's description is being shown
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  // State to track if full description should be shown
  const [showFullDescription, setShowFullDescription] = useState(false);

  // Group ports by their groupKey
  const groupedInputs =
    inputs?.reduce<Record<string, NodePort[]>>((acc, port) => {
      if (port.groupKey) {
        if (!acc[port.groupKey]) {
          acc[port.groupKey] = [];
        }
        acc[port.groupKey].push(port);
      } else {
        // For backward compatibility, use a default group
        if (!acc["default"]) {
          acc["default"] = [];
        }
        acc["default"].push(port);
      }
      return acc;
    }, {}) || {};

  const groupedOutputs =
    outputs?.reduce<Record<string, NodePort[]>>((acc, port) => {
      if (port.groupKey) {
        if (!acc[port.groupKey]) {
          acc[port.groupKey] = [];
        }
        acc[port.groupKey].push(port);
      } else {
        // For backward compatibility, use a default group
        if (!acc["default"]) {
          acc["default"] = [];
        }
        acc["default"].push(port);
      }
      return acc;
    }, {}) || {};

  return (
    <div
      style={{
        padding: "10px",
        borderRadius: "5px",
        backgroundColor: style.backgroundColor,
        border: `1px solid ${style.borderColor}`,
        minWidth: "200px",
        maxWidth: "250px",
      }}
    >
      <div
        style={{
          fontWeight: "bold",
          fontSize: "14px",
          marginBottom: "5px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {name} {nodeID && <span>[{nodeID}]</span>}
        {labelText && (
          <span
            style={{
              fontSize: "10px",
              backgroundColor: style.labelBackgroundColor || style.borderColor,
              color: style.labelTextColor || "white",
              padding: "2px 6px",
              borderRadius: "10px",
            }}
          >
            {labelText}
          </span>
        )}
      </div>

      {/* Display shortDescription by default, or full description if requested */}
      <div
        style={{
          fontSize: "12px",
          color: "#555",
          marginBottom: "10px",
          cursor: description ? "pointer" : "default",
        }}
        onClick={() =>
          description && setShowFullDescription(!showFullDescription)
        }
        title={
          description
            ? showFullDescription
              ? "Click to show less"
              : "Click to show full description"
            : ""
        }
      >
        {showFullDescription ? description : shortDescription || description}
        {description &&
          shortDescription &&
          description !== shortDescription && (
            <span
              style={{
                color: style.borderColor,
                fontSize: "10px",
                marginLeft: "5px",
                fontStyle: "italic",
              }}
            >
              {showFullDescription ? " (less)" : " (more...)"}
            </span>
          )}
      </div>

      {children}

      {/* Render ports section with grouped inputs and outputs */}
      {(Object.keys(groupedInputs).length > 0 ||
        Object.keys(groupedOutputs).length > 0) && (
        <div style={{ position: "relative" }}>
          {/* Side-by-side layout for inputs and outputs */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {/* Input ports section */}
            {Object.keys(groupedInputs).length > 0 && (
              <div style={{ flex: 1, marginRight: "8px" }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "bold",
                    marginBottom: "5px",
                  }}
                >
                  Inputs:
                </div>

                {Object.entries(groupedInputs).map(([groupKey, ports]) => {
                  const group = inputGroups?.[groupKey];
                  return (
                    <div
                      key={groupKey}
                      style={{
                        marginBottom: "12px",
                        position: "relative",
                        backgroundColor:
                          groupKey === hoveredGroup
                            ? "rgba(0,0,0,0.05)"
                            : "transparent",
                        padding: "4px",
                        borderRadius: "4px",
                      }}
                      onMouseEnter={() => setHoveredGroup(groupKey)}
                      onMouseLeave={() => setHoveredGroup(null)}
                    >
                      {/* Group header with name and type */}
                      {group && (
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: "bold",
                            marginBottom: "3px",
                          }}
                        >
                          {group.name}{" "}
                          <span style={{ color: "#666" }}>({group.type})</span>
                        </div>
                      )}

                      {/* Description tooltip */}
                      {groupKey === hoveredGroup && group?.description && (
                        <div
                          style={{
                            position: "absolute",
                            left: "-5px",
                            top: "-30px",
                            backgroundColor: "rgba(0,0,0,0.8)",
                            color: "white",
                            padding: "2px 5px",
                            borderRadius: "3px",
                            fontSize: "10px",
                            maxWidth: "150px",
                            zIndex: 10,
                          }}
                        >
                          {group.description}
                        </div>
                      )}

                      {/* Individual ports in this group */}
                      {ports.map((port, portIndex) => (
                        <div
                          key={`input-${portIndex}`}
                          style={{
                            position: "relative",
                            padding: "0px 0 0px 15px",
                          }}
                        >
                          <Handle
                            type="target"
                            position={Position.Left}
                            id={`${id}-input-${port.index}`}
                            style={{ background: style.borderColor, left: 0 }}
                          />
                          <div style={{ fontSize: "11px" }}>{port.name}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Output ports section */}
            {Object.keys(groupedOutputs).length > 0 && (
              <div style={{ flex: 1, marginLeft: "8px" }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "bold",
                    marginBottom: "5px",
                    textAlign: "right",
                  }}
                >
                  Outputs:
                </div>

                {Object.entries(groupedOutputs).map(([groupKey, ports]) => {
                  const group = outputGroups?.[groupKey];
                  return (
                    <div
                      key={groupKey}
                      style={{
                        marginBottom: "12px",
                        position: "relative",
                        backgroundColor:
                          groupKey === hoveredGroup
                            ? "rgba(0,0,0,0.05)"
                            : "transparent",
                        padding: "4px",
                        borderRadius: "4px",
                        textAlign: "right",
                      }}
                      onMouseEnter={() => setHoveredGroup(groupKey)}
                      onMouseLeave={() => setHoveredGroup(null)}
                    >
                      {/* Group header with name and type */}
                      {group && (
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: "bold",
                            marginBottom: "3px",
                            textAlign: "right",
                          }}
                        >
                          {group.name}{" "}
                          <span style={{ color: "#666" }}>({group.type})</span>
                        </div>
                      )}

                      {/* Description tooltip */}
                      {groupKey === hoveredGroup && group?.description && (
                        <div
                          style={{
                            position: "absolute",
                            right: "-5px",
                            top: "-30px",
                            backgroundColor: "rgba(0,0,0,0.8)",
                            color: "white",
                            padding: "2px 5px",
                            borderRadius: "3px",
                            fontSize: "10px",
                            maxWidth: "150px",
                            zIndex: 10,
                          }}
                        >
                          {group.description}
                        </div>
                      )}

                      {/* Individual ports in this group */}
                      {ports.map((port, portIndex) => (
                        <div
                          key={`output-${portIndex}`}
                          style={{
                            position: "relative",
                            padding: "0px 20px 0px 0",
                            textAlign: "right",
                          }}
                        >
                          <Handle
                            type="source"
                            position={Position.Right}
                            id={`${id}-output-${port.index}`}
                            style={{ background: style.borderColor, right: 0 }}
                          />
                          <div style={{ fontSize: "11px" }}>{port.name}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Render options if any */}
      {options && Object.keys(options).length > 0 && (
        <div
          style={{
            marginTop: "10px",
            borderTop: "1px dashed #ccc",
            paddingTop: "5px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: "bold",
              marginBottom: "5px",
            }}
          >
            Options:
          </div>
          {Object.entries(options).map(([key, value]) => (
            <div
              key={key}
              style={{
                fontSize: "11px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{key}:</span>
              <span style={{ color: "#666" }}>
                {typeof value === "object"
                  ? (value as NodeOption).default || "-"
                  : value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
