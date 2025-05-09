import React, { useState } from "react";
import { Card } from "../components/Card";
import { buttonStyle, disabledButtonStyle, inputStyle, successButtonStyle } from "../utils/styleUtils";
import { getDeviceColor } from "../utils/deviceUtils";

interface DevicesTabProps {
  isLoading: boolean;
  devicesList: {devicesCount: number, jsonData: string, devicesHash: string} | null;
  completeDevices: string | null;
  deviceIndexInput: string;
  setDeviceIndexInput: (value: string) => void;
  handleListConnectedDevices: () => Promise<void>;
  handleGetAllDevices: () => Promise<void>;
}

export function DevicesTab({
  isLoading,
  devicesList,
  completeDevices,
  deviceIndexInput,
  setDeviceIndexInput,
  handleListConnectedDevices,
  handleGetAllDevices
}: DevicesTabProps) {
  const [showRawJson, setShowRawJson] = useState(false);
  
  return (
    <div>
      <Card title="Single Device Information">
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <label style={{ fontSize: "14px" }}>Device #:</label>
            <input 
              type="number" 
              value={deviceIndexInput} 
              onChange={(e) => setDeviceIndexInput(e.target.value)}
              style={inputStyle}
              min="0"
            />
          </div>
          <button 
            onClick={handleListConnectedDevices} 
            disabled={isLoading}
            style={isLoading ? disabledButtonStyle : buttonStyle}
          >
            Get Device Info
          </button>
        </div>
        
        {devicesList && (
          <div style={{ marginTop: "12px" }}>
            <div style={{ marginBottom: "8px", fontSize: "14px" }}>
              Device <strong>{deviceIndexInput}</strong> of <strong>{devicesList.devicesCount}</strong>
            </div>
            <div style={{ fontSize: "14px", color: "#555", marginBottom: "4px" }}>
              Hash: {devicesList.devicesHash}
            </div>
            {devicesList.jsonData && (
              <div style={{ 
                overflow: "auto", 
                border: "1px solid #eee", 
                padding: "12px",
                backgroundColor: "#f9f9f9",
                borderRadius: "4px",
                fontFamily: "monospace",
                fontSize: "13px",
                whiteSpace: "pre-wrap"
              }}>
                {devicesList.jsonData}
              </div>
            )}
          </div>
        )}
      </Card>
      
      <Card title="All Connected Devices">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <button 
            onClick={handleGetAllDevices} 
            disabled={isLoading}
            style={isLoading ? disabledButtonStyle : successButtonStyle}
          >
            {isLoading ? "Loading..." : "Get All Connected Devices"}
          </button>
        </div>
        
        {completeDevices && (
          <div>
            <div style={{ 
              borderRadius: "4px",
              border: "1px solid #eee",
              overflow: "hidden",
            }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "sans-serif",
                fontSize: "14px"
              }}>
                <thead>
                  <tr style={{
                    backgroundColor: "#f3f3f3",
                  }}>
                    <th style={{
                      padding: "12px",
                      textAlign: "left",
                    }}>Type</th>
                    <th style={{
                      padding: "12px",
                      textAlign: "left",
                    }}>ID</th>
                    <th style={{
                      padding: "12px",
                      textAlign: "left",
                    }}>Device</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    try {
                      const devices = JSON.parse(completeDevices);
                      return devices.map((device: any, index: number) => (
                        <tr key={index} style={{
                          backgroundColor: index % 2 === 0 ? "white" : "#f9f9f9",
                          borderTop: "1px solid #eee"
                        }}>
                          <td style={{ padding: "10px 12px" }}>{device.type}</td>
                          <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{device.id}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              {/* Icon based on device type */}
                              <div style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "50%",
                                backgroundColor: getDeviceColor(device.type),
                                marginRight: "12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                                fontWeight: "bold",
                                fontSize: "13px"
                              }}>
                                {device.type.charAt(0).toUpperCase()}
                              </div>
                              {device.displayName || device.type}
                            </div>
                          </td>
                        </tr>
                      ));
                    } catch (e) {
                      return (
                        <tr>
                          <td colSpan={3} style={{ padding: "12px", color: "red" }}>
                            Error parsing device data
                          </td>
                        </tr>
                      );
                    }
                  })()}
                </tbody>
              </table>
            </div>
            
            <div style={{
              marginTop: "12px",
              fontSize: "13px",
              color: "#666",
            }}>
              <button 
                onClick={() => setShowRawJson(!showRawJson)}
                style={{
                  background: "none",
                  border: "none",
                  textDecoration: "underline",
                  cursor: "pointer",
                  color: "#0066cc",
                  fontSize: "13px",
                  padding: 0,
                }}
              >
                {showRawJson ? "Hide raw JSON" : "Show raw JSON"}
              </button>
              {showRawJson && (
                <pre style={{
                  maxHeight: "150px",
                  overflow: "auto",
                  border: "1px solid #eee",
                  padding: "12px",
                  marginTop: "8px",
                  backgroundColor: "#f9f9f9",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  whiteSpace: "pre-wrap"
                }}>
                  {completeDevices}
                </pre>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
