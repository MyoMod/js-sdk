import { createRoot } from "react-dom/client";
import { StrictMode, Suspense, useEffect, useMemo, useState, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { create } from "zustand";
import {
  createUpdateHandModel,
  loadHandModel,
  loadMyoMod,
  MyoMod,
  MyoModHandPose,
} from "@myomod/three";
import { suspend } from "suspend-react";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

function App() {
  const [hasInteracted, setHasInteracted] = useState(false);
  if (!hasInteracted) {
    return (
      <div
        onClick={() => setHasInteracted(true)}
        style={{
          position: "absolute",
          inset: 0,
          background: "white",
          color: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          cursor: "pointer",
        }}
      >
        Click to start.
      </div>
    );
  }
  return (
    <Suspense fallback={<Connecting />}>
      <Connected />
    </Suspense>
  );
}

const loadMyoModSymbol = Symbol("loadMyoMod");

function Connected() {
  const myoMod = suspend(() => loadMyoMod(), [loadMyoModSymbol]);
  // State for various data types
  const [version, setVersion] = useState<string | null>(null);
  const [rtMode, setRtMode] = useState<number | null>(null);
  const [activeConfigIndex, setActiveConfigIndex] = useState<number | null>(null);
  const [configChecksum, setConfigChecksum] = useState<string | null>(null);
  const [firmwareChecksum, setFirmwareChecksum] = useState<string | null>(null);
  const [firmwareVersion, setFirmwareVersion] = useState<string | null>(null);
  const [batteryState, setBatteryState] = useState<{capacity: number, charging: boolean} | null>(null);
  const [devicesList, setDevicesList] = useState<{devicesCount: number, jsonData: string, devicesHash: string} | null>(null);
  const [configChunk, setConfigChunk] = useState<{chunksCount: number, jsonData: string} | null>(null);
  const [completeConfig, setCompleteConfig] = useState<string | null>(null);
  const [completeDevices, setCompleteDevices] = useState<string | null>(null);
  
  // Input states for form controls
  const [configIndexInput, setConfigIndexInput] = useState<string>("0");
  const [deviceIndexInput, setDeviceIndexInput] = useState<string>("0");
  const [chunkIndexInput, setChunkIndexInput] = useState<string>("0");
  const [chunkDataInput, setChunkDataInput] = useState<string>("");
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("basics");

  // Basic GET handlers
  const handleGetVersion = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const versionInfo = await myoMod.dpuControl.getVersion();
      setVersion(versionInfo);
    } catch (err) {
      setError(`Error retrieving version: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetRealTimeMode = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const mode = await myoMod.dpuControl.getRealTimeMode();
      setRtMode(mode);
    } catch (err) {
      setError(`Error retrieving real-time mode: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetRealTimeMode = async (mode: 0 | 1) => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);
      await myoMod.dpuControl.setRealTimeMode(mode);
      setRtMode(mode);
      setSuccessMessage(`Real-Time Mode successfully set to ${mode} (${mode === 0 ? "Off" : "On"})`);
    } catch (err) {
      setError(`Error setting real-time mode: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Configuration handlers
  const handleGetActiveConfigIndex = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const index = await myoMod.dpuControl.getActiveConfigIndex();
      setActiveConfigIndex(index);
      setSuccessMessage(`Retrieved active config index: ${index}`);
    } catch (err) {
      setError(`Error retrieving active config index: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSetActiveConfigIndex = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);
      const index = parseInt(configIndexInput);
      await myoMod.dpuControl.setActiveConfigIndex(index);
      setActiveConfigIndex(index);
      setSuccessMessage(`Active config index set to: ${index}`);
    } catch (err) {
      setError(`Error setting active config index: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Checksum handlers
  const handleGetConfigurationsChecksum = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const checksum = await myoMod.dpuControl.getConfigurationsChecksum();
      setConfigChecksum(checksum);
      setSuccessMessage(`Retrieved configurations checksum: ${checksum}`);
    } catch (err) {
      setError(`Error retrieving configurations checksum: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGetFirmwareChecksum = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const checksum = await myoMod.dpuControl.getFirmwareChecksum();
      setFirmwareChecksum(checksum);
      setSuccessMessage(`Retrieved firmware checksum: ${checksum}`);
    } catch (err) {
      setError(`Error retrieving firmware checksum: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Firmware & battery handlers
  const handleGetFirmwareVersion = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const version = await myoMod.dpuControl.getFirmwareVersion();
      setFirmwareVersion(version);
      setSuccessMessage(`Retrieved firmware version: ${version}`);
    } catch (err) {
      setError(`Error retrieving firmware version: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGetBatteryState = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const state = await myoMod.dpuControl.getBatteryState();
      setBatteryState(state);
      setSuccessMessage(`Retrieved battery state: ${state.capacity}% ${state.charging ? "(charging)" : "(not charging)"}`);
    } catch (err) {
      setError(`Error retrieving battery state: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Device listing handlers
  const handleListConnectedDevices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const deviceIndex = parseInt(deviceIndexInput);
      const devices = await myoMod.dpuControl.listConnectedDevices(deviceIndex);
      setDevicesList(devices);
      setSuccessMessage(`Retrieved ${devices.devicesCount} connected devices`);
    } catch (err) {
      setError(`Error listing connected devices: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  function parseDevice(deviceEntry: string) : { type: string; id: string, displayName: string } | null {
    let type : string= deviceEntry.substring(1, 11);
    let id : string= deviceEntry.substring(12, 22);

    let displayName;
    switch(type.toLowerCase()) {
      case "embed' emg":
        displayName = "EMG Sensor";
        break;
      case "embed' emg":
        displayName = "IMU Sensor";
        break;
      case "embed' led":
        displayName = "LED";
        break;
      default:
        displayName = type;
    }
    
    return { type, id, displayName };
}
    
  
  const handleGetAllDevices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);
      setCompleteDevices(null);
      
      // First get a single chunk to determine the total number of devices
      const firstChunk = await myoMod.dpuControl.listConnectedDevices(0);
      const totalDevices = firstChunk.devicesCount;
      
      // Initialize an array to hold all device objects
      const deviceObjects = [];
      
      // Process the first device's JSON data
      try {
        const deviceEntry = firstChunk.jsonData.trim();
        const parsedDevice = parseDevice(deviceEntry);
        if (parsedDevice) {
          deviceObjects.push(parsedDevice);
        }
      } catch (parseErr) {
        console.error("Error parsing first device:", parseErr);
      }
      
      // If there are multiple devices, get the rest
      if (totalDevices > 1) {
        for (let i = 1; i < totalDevices; i++) {
          try {
            const deviceChunk = await myoMod.dpuControl.listConnectedDevices(i);
            const deviceEntry = deviceChunk.jsonData.trim();
            const parsedDevice = parseDevice(deviceEntry);
            if (parsedDevice) {
              deviceObjects.push(parsedDevice);
            }
          } catch (chunkErr) {
            console.error(`Error getting device at index ${i}:`, chunkErr);
          }
        }
      }

      // Create the final JSON string from the processed objects
      const formattedDevices = JSON.stringify(deviceObjects, null, 2);
      setCompleteDevices(formattedDevices);
      setSuccessMessage(`Successfully retrieved and processed all ${totalDevices} devices`);
      
    } catch (err) {
      setError(`Error retrieving all devices: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Configuration chunk handlers
  const handleGetConfigurationsChunk = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const chunkIndex = parseInt(chunkIndexInput);
      const chunk = await myoMod.dpuControl.getConfigurationsChunk(chunkIndex);
      setConfigChunk(chunk);
      setSuccessMessage(`Retrieved configuration chunk ${chunkIndex} of ${chunk.chunksCount}`);
    } catch (err) {
      setError(`Error retrieving configuration chunk: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGetAllConfigurationChunks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);
      setCompleteConfig(null);
      
      // First get a single chunk to determine the total number of chunks
      const firstChunk = await myoMod.dpuControl.getConfigurationsChunk(0);
      const totalChunks = firstChunk.chunksCount;
      
      // Create an array to store all chunks
      let allJsonData = firstChunk.jsonData;
      
      // Retrieve remaining chunks
      for (let i = 1; i < totalChunks; i++) {
        const chunk = await myoMod.dpuControl.getConfigurationsChunk(i);
        allJsonData += chunk.jsonData;
      }
      
      // Transform hex numbers to regular numbers before parsing
      const transformedJsonData = allJsonData.replace(/0x[0-9a-fA-F]+/g, (match) => {
        return parseInt(match, 16).toString();
      });
      
      // Try to parse the combined JSON to make sure it's valid
      try {
        const parsedConfig = JSON.parse(transformedJsonData);
        // Pretty-print the JSON for better readability
        const formattedConfig = JSON.stringify(parsedConfig, null, 2);
        setCompleteConfig(formattedConfig);
        setSuccessMessage(`Successfully retrieved and combined all ${totalChunks} configuration chunks`);
      } catch (jsonError) {
        setError(`Retrieved all chunks but failed to parse JSON: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
        setCompleteConfig(transformedJsonData); // Still set the transformed data
      }
    } catch (err) {
      setError(`Error retrieving all configuration chunks: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSetConfigurationsChunk = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);
      const chunkIndex = parseInt(chunkIndexInput);
      await myoMod.dpuControl.setConfigurationsChunk(chunkIndex, chunkDataInput);
      setSuccessMessage(`Configuration chunk ${chunkIndex} set successfully`);
    } catch (err) {
      setError(`Error setting configuration chunk: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Special operations
  const handleReloadConfigurations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);
      await myoMod.dpuControl.reloadConfigurations();
      setSuccessMessage("Configurations reloaded successfully");
    } catch (err) {
      setError(`Error reloading configurations: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Common styles
  const buttonStyle = {
    padding: "8px 16px",
    background: "#0066cc",
    color: "white",
    border: "none",
    borderRadius: 4,
    cursor: isLoading ? "wait" : "pointer",
    fontSize: "14px",
  };
  
  const disabledButtonStyle = {
    ...buttonStyle,
    background: "#cccccc",
    cursor: "not-allowed",
    opacity: 0.7,
  };
  
  const tabButtonStyle = (tab: string) => ({
    padding: "8px 16px",
    background: activeTab === tab ? "#0066cc" : "#e0e0e0",
    color: activeTab === tab ? "white" : "black",
    border: "none",
    borderRadius: "4px 4px 0 0",
    cursor: "pointer",
    fontSize: "14px",
  });
  
  const inputStyle = {
    padding: "6px 10px",
    border: "1px solid #cccccc",
    borderRadius: 4,
    fontSize: "14px",
    width: "100px",
  };

  const getDeviceColor = (deviceType: string) => {
    const type = deviceType.toLowerCase();
    if (type.includes("emg")) return "#3388cc";
    if (type.includes("imu")) return "#33cc33";
    if (type.includes("fsr")) return "#cc3388";
    if (type.includes("sensor")) return "#cc6600";
    return "#888888"; // Default color
  };

  return (
    <>
      <div style={{
        position: "absolute",
        top: 20,
        left: 20,
        background: "white",
        padding: 20,
        borderRadius: 8,
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        zIndex: 100,
        maxWidth: "800px",
        width: "90%",
        maxHeight: "80vh",
        overflow: "auto"
      }}>
        <h2>MyoMod DPU Control</h2>
        
        {/* Tab Navigation */}
        <div style={{ display: "flex", marginBottom: "10px", borderBottom: "1px solid #cccccc" }}>
          <button style={tabButtonStyle("basics")} onClick={() => setActiveTab("basics")}>Basics</button>
          <button style={tabButtonStyle("config")} onClick={() => setActiveTab("config")}>Configuration</button>
          <button style={tabButtonStyle("system")} onClick={() => setActiveTab("system")}>System</button>
          <button style={tabButtonStyle("devices")} onClick={() => setActiveTab("devices")}>Devices</button>
        </div>
        
        {/* Basics Tab */}
        {activeTab === "basics" && (
          <div>
            <h3>Get Values</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
              <button 
                onClick={handleGetVersion} 
                disabled={isLoading}
                style={isLoading ? disabledButtonStyle : buttonStyle}
              >
                {isLoading ? "Loading..." : "Get Version"}
              </button>

              <button 
                onClick={handleGetRealTimeMode} 
                disabled={isLoading}
                style={isLoading ? disabledButtonStyle : buttonStyle}
              >
                {isLoading ? "Loading..." : "Get Real-Time Mode"}
              </button>
            </div>
            
            <h3>Set Real-Time Mode</h3>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button 
                onClick={() => handleSetRealTimeMode(0)} 
                disabled={isLoading || rtMode === 0}
                style={{
                  ...buttonStyle,
                  background: rtMode === 0 ? "#cccccc" : "#cc3300",
                  cursor: isLoading || rtMode === 0 ? "not-allowed" : "pointer",
                  opacity: rtMode === 0 ? 0.7 : 1
                }}
              >
                {isLoading ? "Setting..." : "Turn Off (0)"}
              </button>

              <button 
                onClick={() => handleSetRealTimeMode(1)} 
                disabled={isLoading || rtMode === 1}
                style={{
                  ...buttonStyle,
                  background: rtMode === 1 ? "#cccccc" : "#00cc33",
                  cursor: isLoading || rtMode === 1 ? "not-allowed" : "pointer",
                  opacity: rtMode === 1 ? 0.7 : 1
                }}
              >
                {isLoading ? "Setting..." : "Turn On (1)"}
              </button>
            </div>
            
            <h3>Results</h3>
            {version && (
              <div style={{ marginTop: 10 }}>
                <strong>Version:</strong> {version}
              </div>
            )}
            
            {rtMode !== null && (
              <div style={{ marginTop: 10 }}>
                <strong>Real-Time Mode:</strong> {rtMode} ({rtMode === 0 ? "Off" : "On"})
              </div>
            )}
          </div>
        )}
        
        {/* Configuration Tab */}
        {activeTab === "config" && (
          <div>
            <h3>Configuration Index</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20, alignItems: "center" }}>
              <button 
                onClick={handleGetActiveConfigIndex} 
                disabled={isLoading}
                style={isLoading ? disabledButtonStyle : buttonStyle}
              >
                Get Active Config
              </button>
              
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <input 
                  type="number" 
                  value={configIndexInput} 
                  onChange={(e) => setConfigIndexInput(e.target.value)}
                  style={inputStyle}
                  min="0"
                />
                <button 
                  onClick={handleSetActiveConfigIndex} 
                  disabled={isLoading}
                  style={isLoading ? disabledButtonStyle : buttonStyle}
                >
                  Set Config
                </button>
              </div>
            </div>
            
            <h3>Configuration Operations</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
              <button 
                onClick={handleGetConfigurationsChecksum} 
                disabled={isLoading}
                style={isLoading ? disabledButtonStyle : buttonStyle}
              >
                Get Config Checksum
              </button>
              
              <button 
                onClick={handleReloadConfigurations} 
                disabled={isLoading}
                style={isLoading ? disabledButtonStyle : {...buttonStyle, background: "#cc6600"}}
              >
                Reload Configurations
              </button>
              
              <button 
                onClick={handleGetAllConfigurationChunks} 
                disabled={isLoading}
                style={isLoading ? disabledButtonStyle : {...buttonStyle, background: "#009966"}}
              >
                Get Complete Config
              </button>
            </div>
            
            <h3>Configuration Chunks</h3>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 10 }}>
                <label>Chunk Index:</label>
                <input 
                  type="number" 
                  value={chunkIndexInput} 
                  onChange={(e) => setChunkIndexInput(e.target.value)}
                  style={inputStyle}
                  min="0"
                />
                <button 
                  onClick={handleGetConfigurationsChunk} 
                  disabled={isLoading}
                  style={isLoading ? disabledButtonStyle : buttonStyle}
                >
                  Get Chunk
                </button>
              </div>
              
              <div style={{ marginBottom: 10 }}>
                <label>Chunk Data:</label>
                <textarea 
                  value={chunkDataInput} 
                  onChange={(e) => setChunkDataInput(e.target.value)}
                  style={{ 
                    width: "100%", 
                    minHeight: "80px", 
                    padding: "8px",
                    marginTop: "5px",
                    border: "1px solid #cccccc",
                    borderRadius: "4px"
                  }}
                />
              </div>
              
              <button 
                onClick={handleSetConfigurationsChunk} 
                disabled={isLoading || !chunkDataInput.trim()}
                style={isLoading || !chunkDataInput.trim() ? disabledButtonStyle : buttonStyle}
              >
                Set Chunk Data
              </button>
            </div>
            
            <h3>Results</h3>
            {activeConfigIndex !== null && (
              <div style={{ marginTop: 10 }}>
                <strong>Active Config Index:</strong> {activeConfigIndex}
              </div>
            )}
            
            {configChecksum && (
              <div style={{ marginTop: 10 }}>
                <strong>Config Checksum:</strong> {configChecksum}
              </div>
            )}
            
            {configChunk && (
              <div style={{ marginTop: 10 }}>
                <strong>Config Chunk:</strong> 
                <div>Total Chunks: {configChunk.chunksCount}</div>
                <div style={{ 
                  maxHeight: "150px", 
                  overflow: "auto", 
                  border: "1px solid #eee", 
                  padding: "8px",
                  marginTop: "5px",
                  backgroundColor: "#f9f9f9",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  whiteSpace: "pre-wrap"
                }}>
                  {configChunk.jsonData}
                </div>
              </div>
            )}
            
            {completeConfig && (
              <div style={{ marginTop: 10 }}>
                <strong>Complete Configuration:</strong> 
                <div style={{ 
                  maxHeight: "300px", 
                  overflow: "auto", 
                  border: "1px solid #eee", 
                  padding: "8px",
                  marginTop: "5px",
                  backgroundColor: "#f9f9f9",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  whiteSpace: "pre-wrap"
                }}>
                  {completeConfig}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* System Tab */}
        {activeTab === "system" && (
          <div>
            <h3>System Information</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
              <button 
                onClick={handleGetFirmwareVersion} 
                disabled={isLoading}
                style={isLoading ? disabledButtonStyle : buttonStyle}
              >
                Get Firmware Version
              </button>
              
              <button 
                onClick={handleGetFirmwareChecksum} 
                disabled={isLoading}
                style={isLoading ? disabledButtonStyle : buttonStyle}
              >
                Get Firmware Checksum
              </button>
              
              <button 
                onClick={handleGetBatteryState} 
                disabled={isLoading}
                style={isLoading ? disabledButtonStyle : buttonStyle}
              >
                Get Battery State
              </button>
            </div>
            
            <h3>Results</h3>
            {firmwareVersion && (
              <div style={{ marginTop: 10 }}>
                <strong>Firmware Version:</strong> {firmwareVersion}
              </div>
            )}
            
            {firmwareChecksum && (
              <div style={{ marginTop: 10 }}>
                <strong>Firmware Checksum:</strong> {firmwareChecksum}
              </div>
            )}
            
            {batteryState && (
              <div style={{ marginTop: 10 }}>
                <strong>Battery:</strong> {batteryState.capacity}% {batteryState.charging ? "(Charging)" : "(Not Charging)"}
                <div style={{ 
                  width: "100%", 
                  height: "20px", 
                  backgroundColor: "#eee", 
                  borderRadius: "10px",
                  marginTop: "5px", 
                  overflow: "hidden" 
                }}>
                  <div style={{ 
                    width: `${batteryState.capacity}%`, 
                    height: "100%", 
                    backgroundColor: batteryState.charging ? "#33cc33" : "#3388cc",
                    transition: "width 0.5s ease-out"
                  }} />
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Devices Tab */}
        {activeTab === "devices" && (
          <div>
            <h3>Connected Devices</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <label>Device Index:</label>
                <input 
                  type="number" 
                  value={deviceIndexInput} 
                  onChange={(e) => setDeviceIndexInput(e.target.value)}
                  style={inputStyle}
                  min="0"
                />
                <button 
                  onClick={handleListConnectedDevices} 
                  disabled={isLoading}
                  style={isLoading ? disabledButtonStyle : buttonStyle}
                >
                  List Single Device
                </button>
              </div>
              
              <button 
                onClick={handleGetAllDevices} 
                disabled={isLoading}
                style={isLoading ? disabledButtonStyle : {...buttonStyle, background: "#009966"}}
              >
                Get All Devices
              </button>
            </div>
            
            <h3>Results</h3>
            {devicesList && (
              <div style={{ marginTop: 10 }}>
                <strong>Connected Device:</strong> (Index {deviceIndexInput} of {devicesList.devicesCount})
                <div>Hash: {devicesList.devicesHash}</div>
                {devicesList.jsonData && (
                  <div style={{ 
                    maxHeight: "200px", 
                    overflow: "auto", 
                    border: "1px solid #eee", 
                    padding: "8px",
                    marginTop: "5px",
                    backgroundColor: "#f9f9f9",
                    borderRadius: "4px",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    whiteSpace: "pre-wrap"
                  }}>
                    {devicesList.jsonData}
                  </div>
                )}
              </div>
            )}
            
            {completeDevices && (
              <div style={{ marginTop: 10 }}>
                <strong>All Connected Devices:</strong> 
                <div style={{ 
                  maxHeight: "300px", 
                  overflow: "auto",
                  marginTop: "10px",
                  borderRadius: "4px"
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
                        borderBottom: "2px solid #ddd"
                      }}>
                        <th style={{
                          padding: "10px",
                          textAlign: "left",
                          borderBottom: "1px solid #ddd"
                        }}>Type</th>
                        <th style={{
                          padding: "10px",
                          textAlign: "left",
                          borderBottom: "1px solid #ddd"
                        }}>ID</th>
                        <th style={{
                          padding: "10px",
                          textAlign: "left",
                          borderBottom: "1px solid #ddd"
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
                              borderBottom: "1px solid #ddd"
                            }}>
                              <td style={{ padding: "8px 10px" }}>{device.type}</td>
                              <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>{device.id}</td>
                              <td style={{ padding: "8px 10px" }}>
                                <div style={{ display: "flex", alignItems: "center" }}>
                                  {/* Icon based on device type */}
                                  <div style={{
                                    width: "24px",
                                    height: "24px",
                                    borderRadius: "50%",
                                    backgroundColor: getDeviceColor(device.type),
                                    marginRight: "10px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "white",
                                    fontWeight: "bold",
                                    fontSize: "12px"
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
                              <td colSpan={3} style={{ padding: "10px", color: "red" }}>
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
                  marginTop: "10px",
                  fontSize: "12px",
                  color: "#666",
                  fontStyle: "italic"
                }}>
                  Raw data: 
                  <button 
                    onClick={() => {
                      const el = document.getElementById("rawDeviceData");
                      if (el) el.style.display = el.style.display === "none" ? "block" : "none";
                    }}
                    style={{
                      marginLeft: "5px",
                      background: "none",
                      border: "none",
                      textDecoration: "underline",
                      cursor: "pointer",
                      color: "#0066cc",
                      fontSize: "12px"
                    }}
                  >
                    Toggle view
                  </button>
                  <pre id="rawDeviceData" style={{
                    display: "none",
                    maxHeight: "150px",
                    overflow: "auto",
                    border: "1px solid #eee",
                    padding: "8px",
                    marginTop: "5px",
                    backgroundColor: "#f9f9f9",
                    borderRadius: "4px",
                    fontFamily: "monospace",
                    fontSize: "12px",
                    whiteSpace: "pre-wrap"
                  }}>
                    {completeDevices}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Messages - shown on all tabs */}
        {successMessage && (
          <div style={{ 
            marginTop: 20, 
            color: "green",
            padding: 8,
            background: "#eeffee",
            borderRadius: 4
          }}>
            {successMessage}
          </div>
        )}
        
        {error && (
          <div style={{ 
            marginTop: 20, 
            color: "red",
            padding: 8,
            background: "#ffeeee",
            borderRadius: 4
          }}>
            {error}
          </div>
        )}
      </div>
    </>
  );
}

function Connecting() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "white",
        color: "black",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
      }}
    >
      Connecting to MyoMod
    </div>
  );
}

const loadHandModelSymbol = Symbol("loadHandModel");

function Hand({ myoMod }: { myoMod: MyoMod }) {
  const model = suspend(loadHandModel, [
    "left",
    undefined,
    undefined,
    loadHandModelSymbol,
  ]);
  const update = useMemo(() => createUpdateHandModel(model), [model]);
  useEffect(() => {
    model.visible = false;
    return myoMod.subscribeHandPose((pose, raw) => {
      model.visible = true;
      update(pose);
    });
  }, [model, update, myoMod]);
  return null;
}
