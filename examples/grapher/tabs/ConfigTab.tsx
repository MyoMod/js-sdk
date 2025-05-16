import React, { useState } from "react";
import { Card } from "../components/Card";
import {
  buttonStyle,
  disabledButtonStyle,
  inputStyle,
} from "../utils/styleUtils";
import { ConfigurationViewer } from "../components/ConfigurationViewer";
import "@xyflow/react/dist/style.css";

interface ConfigTabProps {
  isLoading: boolean;
  configChunk: { chunksCount: number; jsonData: string } | null;
  completeConfig: string | null;
  chunkIndexInput: string;
  setChunkIndexInput: (value: string) => void;
  chunkDataInput: string;
  setChunkDataInput: (value: string) => void;
  handleGetConfigurationsChunk: () => Promise<void>;
  handleSetConfigurationsChunk: () => Promise<void>;
  handleGetAllConfigurationChunks: () => Promise<void>;
}

export function ConfigTab({
  isLoading,
  configChunk,
  completeConfig,
  chunkIndexInput,
  setChunkIndexInput,
  chunkDataInput,
  setChunkDataInput,
  handleGetConfigurationsChunk,
  handleSetConfigurationsChunk,
  handleGetAllConfigurationChunks,
}: ConfigTabProps) {
  const [viewMode, setViewMode] = useState<"json" | "flow">("json");

  return (
    <div>
      <Card title="Configuration Chunks">
        <div
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{ marginBottom: "8px", fontSize: "14px", color: "#555" }}
            >
              Get Configuration Chunk
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="number"
                value={chunkIndexInput}
                onChange={(e) => setChunkIndexInput(e.target.value)}
                style={inputStyle}
                min="0"
                placeholder="Chunk #"
              />
              <button
                onClick={handleGetConfigurationsChunk}
                disabled={isLoading}
                style={isLoading ? disabledButtonStyle : buttonStyle}
              >
                Get Chunk
              </button>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{ marginBottom: "8px", fontSize: "14px", color: "#555" }}
            >
              Set Configuration Chunk
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <textarea
                value={chunkDataInput}
                onChange={(e) => setChunkDataInput(e.target.value)}
                placeholder="Enter chunk JSON data"
                style={{
                  width: "100%",
                  minHeight: "80px",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "14px",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={handleSetConfigurationsChunk}
                  disabled={isLoading || !chunkDataInput.trim()}
                  style={
                    isLoading || !chunkDataInput.trim()
                      ? disabledButtonStyle
                      : buttonStyle
                  }
                >
                  Set Chunk Data
                </button>
              </div>
            </div>
          </div>
        </div>

        {configChunk && (
          <div style={{ marginTop: "16px" }}>
            <div
              style={{ marginBottom: "8px", fontSize: "14px", color: "#555" }}
            >
              Configuration Chunk
            </div>
            <div style={{ marginBottom: "8px", fontSize: "14px" }}>
              Total Chunks: <strong>{configChunk.chunksCount}</strong>
            </div>
            <div
              style={{
                maxHeight: "150px",
                overflow: "auto",
                border: "1px solid #eee",
                padding: "12px",
                backgroundColor: "#f9f9f9",
                borderRadius: "4px",
                fontFamily: "monospace",
                fontSize: "13px",
                whiteSpace: "pre-wrap",
              }}
            >
              {configChunk.jsonData}
            </div>
          </div>
        )}
      </Card>

      <Card title="Complete Configuration">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <div>
            <button
              onClick={handleGetAllConfigurationChunks}
              disabled={isLoading}
              style={isLoading ? disabledButtonStyle : buttonStyle}
            >
              {isLoading ? "Loading..." : "Load Complete Configuration"}
            </button>
          </div>
          {completeConfig && (
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setViewMode("json")}
                style={{
                  ...buttonStyle,
                  backgroundColor: viewMode === "json" ? "#4a90e2" : "#f0f0f0",
                  color: viewMode === "json" ? "white" : "#333",
                }}
              >
                JSON View
              </button>
              <button
                onClick={() => setViewMode("flow")}
                style={{
                  ...buttonStyle,
                  backgroundColor: viewMode === "flow" ? "#4a90e2" : "#f0f0f0",
                  color: viewMode === "flow" ? "white" : "#333",
                }}
              >
                Flow View
              </button>
            </div>
          )}
        </div>

        {completeConfig && viewMode === "json" && (
          <div
            style={{
              maxHeight: "500px",
              overflow: "auto",
              border: "1px solid #eee",
              padding: "12px",
              backgroundColor: "#f9f9f9",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "13px",
              whiteSpace: "pre-wrap",
            }}
          >
            {completeConfig}
          </div>
        )}

        {completeConfig && viewMode === "flow" && (
          <ConfigurationViewer configData={JSON.parse(completeConfig)[0]} />
        )}
      </Card>
    </div>
  );
}
