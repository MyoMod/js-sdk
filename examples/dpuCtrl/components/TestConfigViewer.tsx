import React, { useState, useEffect } from "react";
import { ConfigurationViewer } from "./ConfigurationViewer";
import exampleConfig from "../configurationManager/exampleConfig.json";

export const TestConfigViewer: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [newConfigData, setConfigData] = useState(exampleConfig[0]);
  const [originalConfig] = useState(
    JSON.parse(JSON.stringify(exampleConfig[0]))
  ); // Deep copy for reference

  // Handle configuration changes
  const handleConfigChange = (updatedConfig: any) => {
    console.log("Configuration changed:", updatedConfig);
    setConfigData(updatedConfig);
  };

  // Memoize the ConfigurationViewer to prevent unnecessary re-renders
  const memoizedConfigViewer = React.useMemo(() => {
    return (
      <ConfigurationViewer
        configData={originalConfig}
        onConfigChange={handleConfigChange}
      />
    );
  }, [originalConfig]);

  return (
    <div className="test-config-viewer">
      <h1>Configuration Viewer Test Environment</h1>

      {error ? (
        <div
          className="error-message"
          style={{ color: "red", padding: "20px" }}
        >
          {error}
        </div>
      ) : (
        <div className="viewer-container" style={{ margin: "20px 0" }}>
          {memoizedConfigViewer}
        </div>
      )}

      <div
        className="config-data"
        style={{ marginTop: "30px", display: "flex", gap: "20px" }}
      >
        <div style={{ flex: 1 }}>
          <h3>Original Configuration:</h3>
          <pre
            style={{
              backgroundColor: "#f5f5f5",
              padding: "15px",
              borderRadius: "5px",
              overflowX: "auto",
              maxHeight: "300px",
              overflowY: "auto",
            }}
          >
            {JSON.stringify(originalConfig, null, 2)}
          </pre>
        </div>

        <div style={{ flex: 1 }}>
          <h3>Current Configuration:</h3>
          <pre
            style={{
              backgroundColor: "#f5f5f5",
              padding: "15px",
              borderRadius: "5px",
              overflowX: "auto",
              maxHeight: "300px",
              overflowY: "auto",
              boxShadow:
                newConfigData !== originalConfig ? "0 0 0 2px #4caf50" : "none",
            }}
          >
            {JSON.stringify(newConfigData, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
