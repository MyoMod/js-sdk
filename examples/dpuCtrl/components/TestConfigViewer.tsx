import React, { useState, useEffect } from "react";
import { ConfigurationViewer } from "./ConfigurationViewer";
import exampleConfig from "../configurationManager/exampleConfig.json";

export const TestConfigViewer: React.FC = () => {
  const [error, setError] = useState<string | null>(null);

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
          <ConfigurationViewer configData={exampleConfig[0]} />
        </div>
      )}

      <div className="config-data" style={{ marginTop: "30px" }}>
        <h3>Loaded Configuration Data:</h3>
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
          {exampleConfig
            ? JSON.stringify(exampleConfig, null, 2)
            : "Loading..."}
        </pre>
      </div>
    </div>
  );
};
