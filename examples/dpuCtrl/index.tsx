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
            <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 20 }}>
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
                List Devices
              </button>
            </div>
            
            <h3>Results</h3>
            {devicesList && (
              <div style={{ marginTop: 10 }}>
                <strong>Connected Devices:</strong> {devicesList.devicesCount}
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
