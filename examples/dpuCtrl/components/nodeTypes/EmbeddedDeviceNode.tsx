import React, { memo } from "react";
import { BaseNode, BaseNodeData, NodeStyleOptions } from "./BaseNode";

interface EmbeddedDeviceNodeData extends BaseNodeData {
  // No need for isEmbedded flag anymore as this component is explicitly for embedded devices
}

interface EmbeddedDeviceNodeProps {
  data: EmbeddedDeviceNodeData;
}

// Embedded device node style
const embeddedStyle: NodeStyleOptions = {
  backgroundColor: "#e8f5e9",
  borderColor: "#4caf50",
  labelBackgroundColor: "#4caf50",
  labelTextColor: "white",
};

export const EmbeddedDeviceNode = memo(({ data }: EmbeddedDeviceNodeProps) => {
  return <BaseNode data={data} labelText="Embedded" style={embeddedStyle} />;
});
