import React from 'react';
import { Handle, useNodeConnections } from '@xyflow/react';
 
/**
 * Custom handle component that allows only one connection.
 *
 * @param {object} props - The props for the handle.
 * @returns {JSX.Element} The custom handle component.
 */
const UnaryHandle = (props: any) => {
  const connections = useNodeConnections({
    handleType: props.type,
    handleId: props.id,
  });
 
  return (
    <Handle
      {...props}
      isConnectable={connections.length < 1 ? true : false} 
    />
  );
};
 
export default UnaryHandle;