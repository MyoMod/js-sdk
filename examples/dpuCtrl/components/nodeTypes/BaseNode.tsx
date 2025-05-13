import React, { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import UnaryHandle from "./UnaryHandle";
import "./BaseNode.css";
import { bool } from "three/webgpu";

export interface NodePort {
  name: string;
  type: string;
  index: number;
  groupKey?: string;
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
  onOptionsChange?: (updatedOptions: Record<string, any>) => void;
  configData: any; // data loaded from the config file
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
    configData,
  } = data;

  // State to track which group's description is being shown
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  // State to track if full description should be shown
  const [showFullDescription, setShowFullDescription] = useState(false);
  // State to track which option is being edited
  const [editingOption, setEditingOption] = useState<string | null>(null);
  // State to store temporary option values while editing
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  // State to track the current value of the options
  const [currentValues, setCurrentValues] = useState<Record<string, any>>({});
  // Initialize current values with configData
  React.useEffect(() => {
    if (configData) {
      const initialValues: Record<string, any> = {};
      Object.entries(configData).forEach(([key, value]) => {
        if (options && options[key]) {
          initialValues[key] = value;
        }
      });
      setCurrentValues(initialValues);
    }
  }, [configData, options]);

  // Function to handle option editing
  const handleEditOption = (key: string) => {
    // Get the current value from currentValues or fallback to default
    const value =
      currentValues[key] !== undefined
        ? currentValues[key]
        : options && options[key] && typeof options[key] === "object"
        ? options[key].default
        : options?.[key];

    setEditingOption(key);
    setEditedValues({
      ...editedValues,
      [key]: value,
    });
  };

  // Function to save edited option
  const saveOption = (key: string) => {
    if (data.options) {
      // Create a copy of the options object
      const newOptions = { ...data.options };
      const newValue = editedValues[key];

      // Update the value
      if (typeof newOptions[key] === "object" && newOptions[key] !== null) {
        newOptions[key] = {
          ...newOptions[key],
          default: newValue,
        };
      } else {
        newOptions[key] = newValue;
      }

      // Update current values
      setCurrentValues({
        ...currentValues,
        [key]: newValue,
      });

      // If we were provided with an onOptionsChange callback, call it
      if (data.onOptionsChange) {
        data.onOptionsChange(newOptions);
      }
    }

    // Exit edit mode
    setEditingOption(null);
  };

  // Function to cancel editing
  const cancelEdit = () => {
    setEditingOption(null);
  };

  // Option Input Components
  const OptionEnumInput: React.FC<{
    optionKey: string;
    values: any[];
    currentValue: any;
    borderColor: string;
    onChange: (key: string, value: any) => void;
  }> = ({ optionKey, values, currentValue, borderColor, onChange }) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      let newValue: any = e.target.value;

      // Handle boolean conversion
      if (newValue === "true" || newValue === "false") {
        newValue = newValue === "true";
      }

      onChange(optionKey, newValue);
    };

    return (
      <select
        value={currentValue.toString()}
        onChange={handleChange}
        className="option-input nodrag"
        style={{ border: `1px solid ${borderColor}` }}
      >
        {values.map((val) => (
          <option key={val} value={val.toString()}>
            {val.toString()}
          </option>
        ))}
      </select>
    );
  };

  const OptionNumberInput: React.FC<{
    optionKey: string;
    valueInfo: {
      isInterger: boolean;
      min?: number;
      max?: number;
    };
    currentValue: number;
    borderColor: string;
    onChange: (key: string, value: number) => void;
  }> = ({ optionKey, valueInfo, currentValue, borderColor, onChange }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue: number = parseFloat(e.target.value);
      if (isNaN(newValue)) newValue = 0;

      // Apply constraints if defined
      if (valueInfo.min !== undefined && newValue < valueInfo.min)
        newValue = valueInfo.min;
      if (valueInfo.max !== undefined && newValue > valueInfo.max)
        newValue = valueInfo.max;

      // For integers, round the value
      if (valueInfo.isInterger) {
        newValue = Math.round(newValue);
      }

      onChange(optionKey, newValue);
    };

    // Prevent wheel events from changing the value and losing focus
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();

      // Manually handle the wheel event to change the value
      const delta = e.deltaY < 0 ? 1 : -1;
      let step = valueInfo.isInterger ? 1 : 0.01;

      let newValue = currentValue + delta * step;

      // Apply constraints
      if (valueInfo.min !== undefined && newValue < valueInfo.min)
        newValue = valueInfo.min;
      if (valueInfo.max !== undefined && newValue > valueInfo.max)
        newValue = valueInfo.max;

      // For integers, ensure the value is an integer
      if (valueInfo.isInterger) {
        newValue = Math.round(newValue);
      }

      onChange(optionKey, newValue);
    };

    return (
      <input
        type="number"
        value={currentValue.toFixed(2)}
        onChange={handleChange}
        onWheel={handleWheel}
        className="option-input nowheel nodrag"
        style={{ border: `1px solid ${borderColor}` }}
        min={valueInfo.min}
        max={valueInfo.max}
        step={valueInfo.isInterger ? 1 : 0.01}
      />
    );
  };

  const OptionTextInput: React.FC<{
    optionKey: string;
    currentValue: string;
    borderColor: string;
    onChange: (key: string, value: string) => void;
  }> = ({ optionKey, currentValue, borderColor, onChange }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(optionKey, e.target.value);
    };

    return (
      <input
        type="text"
        value={currentValue}
        onChange={handleChange}
        className="option-input"
        style={{ border: `1px solid ${borderColor}` }}
      />
    );
  };

  // Main option entry component
  const OptionEntry: React.FC<{
    optionKey: string;
    param: any;
    isEditing: boolean;
    onEdit: () => void;
    onSave: () => void;
    onCancel: () => void;
    borderColor: string;
  }> = ({
    optionKey,
    param,
    isEditing,
    onEdit,
    onSave,
    onCancel,
    borderColor,
  }) => {
    // Get current value from currentValues, fallback to default from param
    const currentValue =
      currentValues[optionKey] !== undefined
        ? currentValues[optionKey]
        : param.default;

    const valueType = param.type;
    const displayValue =
      typeof currentValue === "boolean"
        ? currentValue.toString()
        : currentValue ?? "-";

    // Handle option value changes
    const handleValueChange = (key: string, value: any) => {
      setEditedValues({
        ...editedValues,
        [key]: value,
      });
    };

    // Render the appropriate input component based on the value type
    const renderInputComponent = () => {
      // Make sure we have a valid edited value, or initialize it
      if (editedValues[optionKey] === undefined) {
        setEditedValues({
          ...editedValues,
          [optionKey]: currentValue,
        });
      }

      // Handle enum type (including boolean)
      if (valueType === "enum" || valueType === "boolean" || param.values) {
        const values = valueType === "boolean" ? [true, false] : param.values;
        return (
          <OptionEnumInput
            optionKey={optionKey}
            values={values}
            currentValue={editedValues[optionKey]}
            borderColor={borderColor}
            onChange={handleValueChange}
          />
        );
      }

      // Handle number types
      if (["float32", "uint8", "int8", "int32", "uint32"].includes(valueType)) {
        const valueInfo = {
          isInterger: valueType !== "float32",
          min: param.min,
          max: param.max,
        };
        return (
          <OptionNumberInput
            optionKey={optionKey}
            valueInfo={valueInfo}
            currentValue={editedValues[optionKey]}
            borderColor={borderColor}
            onChange={handleValueChange}
          />
        );
      }

      // Default: text input
      return (
        <OptionTextInput
          optionKey={optionKey}
          currentValue={editedValues[optionKey]}
          borderColor={borderColor}
          onChange={handleValueChange}
        />
      );
    };

    return (
      <div className={`option-row ${isEditing ? "option-row-editing" : ""}`}>
        <span>{optionKey}:</span>

        {isEditing ? (
          <div className="option-controls">
            {renderInputComponent()}

            <button
              onClick={onSave}
              className="save-button"
              style={{ backgroundColor: borderColor }}
              title="Save changes"
            >
              ✓
            </button>

            <button
              onClick={onCancel}
              className="cancel-button"
              title="Cancel editing"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="option-controls">
            <span className="option-value" title={displayValue}>
              {displayValue}
            </span>

            <button
              onClick={onEdit}
              className="edit-button"
              style={{ color: borderColor }}
              title="Edit option"
            >
              ✏️
            </button>
          </div>
        )}
      </div>
    );
  };

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
      className="base-node"
      style={{
        backgroundColor: style.backgroundColor,
        border: `1px solid ${style.borderColor}`,
      }}
    >
      <div className="node-header">
        {name} {nodeID && <span>[{nodeID}]</span>}
        {labelText && (
          <span
            className="node-label"
            style={{
              backgroundColor: style.labelBackgroundColor || style.borderColor,
              color: style.labelTextColor || "white",
            }}
          >
            {labelText}
          </span>
        )}
      </div>

      <div
        className={`node-description ${
          description ? "description-clickable" : ""
        }`}
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
              className="description-more"
              style={{ color: style.borderColor }}
            >
              {showFullDescription ? " (less)" : " (more...)"}
            </span>
          )}
      </div>

      {children}

      {/* Render ports section with grouped inputs and outputs */}
      {(Object.keys(groupedInputs).length > 0 ||
        Object.keys(groupedOutputs).length > 0) && (
        <div className="ports-container">
          <div className="ports-layout">
            {/* Input ports section */}
            {Object.keys(groupedInputs).length > 0 && (
              <div className="ports-section ports-section-left">
                <div className="ports-title">Inputs:</div>

                {Object.entries(groupedInputs).map(([groupKey, ports]) => {
                  const group = inputGroups?.[groupKey];
                  return (
                    <div
                      key={groupKey}
                      className={`port-group ${
                        groupKey === hoveredGroup ? "port-group-hovered" : ""
                      }`}
                      onMouseEnter={() => setHoveredGroup(groupKey)}
                      onMouseLeave={() => setHoveredGroup(null)}
                    >
                      {/* Group header with name and type */}
                      {group && (
                        <div className="group-header">
                          {group.name}{" "}
                          <span className="group-type">({group.type})</span>
                        </div>
                      )}

                      {/* Description tooltip */}
                      {groupKey === hoveredGroup && group?.description && (
                        <div className="group-tooltip input-tooltip">
                          {group.description}
                        </div>
                      )}

                      {/* Individual ports in this group */}
                      {ports.map((port, portIndex) => (
                        <div
                          key={`input-${portIndex}`}
                          className="port-container port-container-input"
                        >
                          <UnaryHandle
                            type="target"
                            position={Position.Left}
                            id={`${id}-input-${port.index}`}
                            style={{ background: style.borderColor, left: 0 }}
                          />
                          <div className="port-name">{port.name}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Output ports section */}
            {Object.keys(groupedOutputs).length > 0 && (
              <div className="ports-section ports-section-right">
                <div className="ports-title ports-title-right">Outputs:</div>

                {Object.entries(groupedOutputs).map(([groupKey, ports]) => {
                  const group = outputGroups?.[groupKey];
                  return (
                    <div
                      key={groupKey}
                      className={`port-group port-group-right ${
                        groupKey === hoveredGroup ? "port-group-hovered" : ""
                      }`}
                      onMouseEnter={() => setHoveredGroup(groupKey)}
                      onMouseLeave={() => setHoveredGroup(null)}
                    >
                      {/* Group header with name and type */}
                      {group && (
                        <div className="group-header group-header-right">
                          {group.name}{" "}
                          <span className="group-type">({group.type})</span>
                        </div>
                      )}

                      {/* Description tooltip */}
                      {groupKey === hoveredGroup && group?.description && (
                        <div className="group-tooltip output-tooltip">
                          {group.description}
                        </div>
                      )}

                      {/* Individual ports in this group */}
                      {ports.map((port, portIndex) => (
                        <div
                          key={`output-${portIndex}`}
                          className="port-container port-container-output"
                        >
                          <Handle
                            type="source"
                            position={Position.Right}
                            id={`${id}-output-${port.index}`}
                            style={{ background: style.borderColor, right: 0 }}
                          />
                          <div className="port-name">{port.name}</div>
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
        <div className="options-section">
          <div className="options-header">Options:</div>

          {Object.entries(options).map(([key, params]) => (
            <OptionEntry
              key={key}
              optionKey={key}
              param={params}
              isEditing={editingOption === key}
              onEdit={() => handleEditOption(key)}
              onSave={() => saveOption(key)}
              onCancel={cancelEdit}
              borderColor={style.borderColor}
            />
          ))}
        </div>
      )}
    </div>
  );
};
