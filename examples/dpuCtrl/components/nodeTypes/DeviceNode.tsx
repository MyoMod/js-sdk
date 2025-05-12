import React, { memo } from "react";
import { BaseNode, BaseNodeData, NodeStyleOptions } from "./BaseNode";

interface DeviceNodeData extends BaseNodeData {
  // isEmbedded removed from interface
}

interface DeviceNodeProps {
  data: DeviceNodeData;
}

// Device node style
const deviceNodeStyle: NodeStyleOptions = {
  backgroundColor: "#e3f2fd",
  borderColor: "#2196f3",
  labelBackgroundColor: "#2196f3",
  labelTextColor: "white",
};

export const DeviceNode = memo(({ data }: DeviceNodeProps) => {
  return <BaseNode data={data} labelText="Device" style={deviceNodeStyle} />;
});
