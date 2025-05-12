import React, { memo } from "react";
import { BaseNode, BaseNodeData, NodeStyleOptions } from "./BaseNode";

interface AlgorithmicNodeProps {
  data: BaseNodeData;
}

// Algorithm node style
const algorithmicNodeStyle: NodeStyleOptions = {
  backgroundColor: "#fff8e1",
  borderColor: "#ffc107",
  labelBackgroundColor: "#ffc107",
  labelTextColor: "white",
};

export const AlgorithmicNode = memo(({ data }: AlgorithmicNodeProps) => {
  return (
    <BaseNode data={data} labelText="Algorithm" style={algorithmicNodeStyle} />
  );
});
