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

  // Track mounting with useRef to prevent double initialization
  const mountedRef = useRef(false);

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
  
  // Initial loading state
  const [isInitializing, setIsInitializing] = useState(true);
  const [initProgress, setInitProgress] = useState(0);
  const [initStep, setInitStep] = useState("");

  // Initialization effect - runs once when component mounts
  useEffect(() => {
    // Skip initialization if this is a duplicate mount
    if (mountedRef.current) {
      console.log("Skipping initialization - component already mounted");
      return;
    }

    // Mark as mounted
    mountedRef.current = true;

    const fetchInitialData = async () => {
      console.log("Initializing MyoMod DPU Control...");
      try {
        setIsInitializing(true);
        setError(null);
        
        // Sequential data fetching - one command at a time
        setInitStep("Version");
        setInitProgress(0);
        const versionInfo = await myoMod.dpuControl.getVersion();
        setVersion(versionInfo);
        
        setInitStep("Real-Time Mode");
        setInitProgress(14);
        const rtModeVal = await myoMod.dpuControl.getRealTimeMode();
        setRtMode(rtModeVal);
        
        setInitStep("Active Config");
        setInitProgress(28);
        const activeConfigIndexVal = await myoMod.dpuControl.getActiveConfigIndex();
        setActiveConfigIndex(activeConfigIndexVal);
        
        setInitStep("Config Checksum");
        setInitProgress(42);
        const configChecksumVal = await myoMod.dpuControl.getConfigurationsChecksum();
        setConfigChecksum(configChecksumVal);
        
        setInitStep("Battery State");
        setInitProgress(84);
        const batteryStateVal = await myoMod.dpuControl.getBatteryState();
        setBatteryState(batteryStateVal);
        
        setInitStep("Devices and Config");
        setInitProgress(92);
        
        // Get devices
        await handleGetAllDevicesInternal();
        
        // Get configurations
        await handleGetAllConfigurationChunksInternal();
        
        setInitProgress(100);
        setSuccessMessage("All data loaded successfully");
      } catch (err) {
        console.error("Error during initialization:", err);
        setError(`Error during initialization (${initStep}): ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsInitializing(false);
      }
    };
    
    fetchInitialData();
    
    // Cleanup function
    return () => {
      console.log("Connected component unmounting");
    };
  }, [myoMod]);

  // Internal version of handleGetAllDevices that doesn't update UI loading state
  const handleGetAllDevicesInternal = async () => {
    try {
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
      
    } catch (err) {
      console.error("Error retrieving all devices:", err);
    }
  };
  
  // Internal version of handleGetAllConfigurationChunks that doesn't update UI loading state
  const handleGetAllConfigurationChunksInternal = async () => {
    try {
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
      } catch (jsonError) {
        console.error("Error parsing config JSON:", jsonError);
        setCompleteConfig(transformedJsonData); // Still set the transformed data
      }
    } catch (err) {
      console.error("Error retrieving all configuration chunks:", err);
    }
  };

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
  const cardStyle = {
    background: "white",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    padding: "16px",
    marginBottom: "16px",
    border: "1px solid #eee",
    overflow: "hidden",
  };

  const cardHeaderStyle = {
    fontWeight: 600,
    fontSize: "16px",
    marginBottom: "12px",
    borderBottom: "1px solid #eee",
    paddingBottom: "8px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };

  const cardContentStyle = {
    display: "flex",
    flexDirection: "column" as "column",
    gap: "12px",
  };

  const buttonStyle = {
    padding: "8px 16px",
    background: "#0066cc",
    color: "white",
    border: "none",
    borderRadius: 4,
    cursor: isLoading ? "wait" : "pointer",
    fontSize: "14px",
    transition: "background 0.2s",
  };
  
  const secondaryButtonStyle = {
    ...buttonStyle,
    background: "#f0f0f0",
    color: "#333",
    border: "1px solid #ddd",
  };
  
  const successButtonStyle = {
    ...buttonStyle,
    background: "#00cc66",
  };
  
  const warningButtonStyle = {
    ...buttonStyle,
    background: "#cc6600",
  };
  
  const disabledButtonStyle = {
    ...buttonStyle,
    background: "#cccccc",
    cursor: "not-allowed",
    opacity: 0.7,
  };
  
  const tabButtonStyle = (tab: string) => ({
    padding: "10px 16px",
    background: activeTab === tab ? "#fff" : "#f5f5f5",
    color: activeTab === tab ? "#0066cc" : "#555",
    border: "none",
    borderBottom: activeTab === tab ? "2px solid #0066cc" : "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: activeTab === tab ? 600 : 400,
    transition: "all 0.2s",
  });
  
  const inputStyle = {
    padding: "8px 12px",
    border: "1px solid #ddd",
    borderRadius: 4,
    fontSize: "14px",
    width: "100px",
  };
  
  const infoValueStyle = {
    padding: "8px 12px",
    background: "#f7f7f7",
    borderRadius: "4px",
    fontFamily: "monospace",
    fontSize: "14px",
    color: "#333",
    wordBreak: "break-all" as "break-all",
  };

  const getDeviceColor = (deviceType: string) => {
    const type = deviceType.toLowerCase();
    if (type.includes("emg")) return "#3388cc";
    if (type.includes("imu")) return "#33cc33";
    if (type.includes("led")) return "#cc3388";
    if (type.includes("bridge")) return "#cc6600";
    return "#888888"; // Default color
  };

  // Card component for grouping related functionality
  const Card = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>{title}</div>
      <div style={cardContentStyle}>{children}</div>
    </div>
  );

  // Info display component
  const InfoValue = ({ label, value }: { label: string, value: string | number | null | undefined }) => {
    if (value === null || value === undefined) return null;
    return (
      <div>
        <div style={{ marginBottom: "4px", fontSize: "14px", color: "#555" }}>{label}</div>
        <div style={infoValueStyle}>{value}</div>
      </div>
    );
  };

  return (
    <>
      <div style={{
        position: "absolute",
        top: 20,
        left: 20,
        background: "#f8f9fa",
        padding: 20,
        borderRadius: 8,
        boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
        zIndex: 100,
        maxWidth: "800px",
        width: "90%",
        maxHeight: "90vh",
        overflow: "auto"
      }}>
        <h2 style={{ marginBottom: "20px", color: "#333", borderBottom: "2px solid #0066cc", paddingBottom: "10px" }}>
          <span style={{ color: "#0066cc" }}>MyoMod</span> DPU Control
        </h2>
        
        {/* Loading state overlay */}
        {isInitializing && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,0.9)",
            zIndex: 101,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div style={{ marginBottom: "20px", fontSize: "18px" }}>
              Initializing MyoMod Connection
            </div>
            <div style={{ width: "300px", height: "10px", background: "#eee", borderRadius: "5px", overflow: "hidden" }}>
              <div 
                style={{ 
                  height: "100%", 
                  background: "#0066cc", 
                  width: `${initProgress}%`,
                  transition: "width 0.3s ease-out"
                }} 
              />
            </div>
            <div style={{ marginTop: "10px", color: "#666" }}>
              {initStep}... {initProgress}%
            </div>
            {error && (
              <div style={{ 
                marginTop: "20px",
                color: "red",
                padding: "10px",
                background: "#ffeeee",
                borderRadius: "4px",
                maxWidth: "80%"
              }}>
                {error}
              </div>
            )}
          </div>
        )}
        
        {/* Tab Navigation */}
        <div style={{ 
          display: "flex", 
          marginBottom: "24px", 
          borderBottom: "1px solid #ddd",
          overflow: "auto",
          whiteSpace: "nowrap" as "nowrap"
        }}>
          <button style={tabButtonStyle("basics")} onClick={() => setActiveTab("basics")}>System Overview</button>
          <button style={tabButtonStyle("config")} onClick={() => setActiveTab("config")}>Configuration</button>
          <button style={tabButtonStyle("system")} onClick={() => setActiveTab("system")}>Firmware & Battery</button>
          <button style={tabButtonStyle("devices")} onClick={() => setActiveTab("devices")}>Connected Devices</button>
        </div>
        
        {/* Basics Tab */}
        {activeTab === "basics" && (
          <div>
            <Card title="System Version">
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <button 
                  onClick={handleGetVersion} 
                  disabled={isLoading}
                  style={isLoading ? disabledButtonStyle : buttonStyle}
                >
                  {isLoading ? "Loading..." : "Get Version"}
                </button>
                {version && <InfoValue label="Version" value={version} />}
              </div>
            </Card>

            <Card title="Real-Time Mode">
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div>
                  <div style={{ marginBottom: "8px", fontSize: "14px", color: "#555" }}>Current Mode</div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button 
                      onClick={handleGetRealTimeMode} 
                      disabled={isLoading}
                      style={isLoading ? disabledButtonStyle : secondaryButtonStyle}
                    >
                      Refresh
                    </button>
                    {rtMode !== null && (
                      <div style={infoValueStyle}>{rtMode} ({rtMode === 0 ? "Off" : "On"})</div>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
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
                  Turn Off (0)
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
                  Turn On (1)
                </button>
              </div>
            </Card>
            
            <Card title="Battery State">
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <button 
                  onClick={handleGetBatteryState} 
                  disabled={isLoading}
                  style={isLoading ? disabledButtonStyle : buttonStyle}
                >
                  {isLoading ? "Loading..." : "Get Battery State"}
                </button>
                
                {batteryState && (
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      marginBottom: "4px"
                    }}>
                      <span>{batteryState.capacity}%</span>
                      {batteryState.charging && (
                        <span style={{ color: "#33cc33", fontSize: "14px" }}>
                          ⚡ Charging
                        </span>
                      )}
                    </div>
                    <div style={{ 
                      width: "100%", 
                      height: "12px", 
                      backgroundColor: "#eee", 
                      borderRadius: "6px",
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
            </Card>
            
            <Card title="Active Configuration">
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div>
                  <div style={{ marginBottom: "8px", fontSize: "14px", color: "#555" }}>Current Config</div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button 
                      onClick={handleGetActiveConfigIndex} 
                      disabled={isLoading}
                      style={isLoading ? disabledButtonStyle : secondaryButtonStyle}
                    >
                      Refresh
                    </button>
                    {activeConfigIndex !== null && (
                      <div style={infoValueStyle}>{activeConfigIndex}</div>
                    )}
                  </div>
                </div>
                
                <div>
                  <div style={{ marginBottom: "8px", fontSize: "14px", color: "#555" }}>Set Config</div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </Card>
            
            <Card title="Configurations Management">
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button 
                  onClick={handleGetConfigurationsChecksum} 
                  disabled={isLoading}
                  style={isLoading ? disabledButtonStyle : secondaryButtonStyle}
                >
                  Get Checksum
                </button>
                
                <button 
                  onClick={handleReloadConfigurations} 
                  disabled={isLoading}
                  style={isLoading ? disabledButtonStyle : warningButtonStyle}
                >
                  Reload Configurations
                </button>
                
                <button 
                  onClick={handleGetAllConfigurationChunks} 
                  disabled={isLoading}
                  style={isLoading ? disabledButtonStyle : successButtonStyle}
                >
                  Get Complete Config
                </button>
              </div>
              
              {configChecksum && (
                <InfoValue label="Config Checksum" value={configChecksum} />
              )}
            </Card>
          </div>
        )}
        
        {/* Configuration Tab */}
        {activeTab === "config" && (
          <div>
            <Card title="Configuration Chunks">
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                  <div style={{ marginBottom: "8px", fontSize: "14px", color: "#555" }}>Get Configuration Chunk</div>
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
                  <div style={{ marginBottom: "8px", fontSize: "14px", color: "#555" }}>Set Configuration Chunk</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
                        fontSize: "14px"
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button 
                        onClick={handleSetConfigurationsChunk} 
                        disabled={isLoading || !chunkDataInput.trim()}
                        style={isLoading || !chunkDataInput.trim() ? disabledButtonStyle : buttonStyle}
                      >
                        Set Chunk Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {configChunk && (
                <div style={{ marginTop: "16px" }}>
                  <div style={{ marginBottom: "8px", fontSize: "14px", color: "#555" }}>Configuration Chunk</div>
                  <div style={{ marginBottom: "8px", fontSize: "14px" }}>
                    Total Chunks: <strong>{configChunk.chunksCount}</strong>
                  </div>
                  <div style={{ 
                    maxHeight: "150px", 
                    overflow: "auto", 
                    border: "1px solid #eee", 
                    padding: "12px",
                    backgroundColor: "#f9f9f9",
                    borderRadius: "4px",
                    fontFamily: "monospace",
                    fontSize: "13px",
                    whiteSpace: "pre-wrap"
                  }}>
                    {configChunk.jsonData}
                  </div>
                </div>
              )}
            </Card>
            
            <Card title="Complete Configuration">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <button 
                  onClick={handleGetAllConfigurationChunks} 
                  disabled={isLoading}
                  style={isLoading ? disabledButtonStyle : buttonStyle}
                >
                  {isLoading ? "Loading..." : "Load Complete Configuration"}
                </button>
              </div>
              
              {completeConfig && (
                <div style={{ 
                  maxHeight: "500px", 
                  overflow: "auto", 
                  border: "1px solid #eee", 
                  padding: "12px",
                  backgroundColor: "#f9f9f9",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "13px",
                  whiteSpace: "pre-wrap"
                }}>
                  {completeConfig}
                </div>
              )}
            </Card>
          </div>
        )}
        
        {/* System Tab */}
        {activeTab === "system" && (
          <div>
            <Card title="Firmware Information">
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
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
              </div>
              
              {firmwareVersion && (
                <InfoValue label="Firmware Version" value={firmwareVersion} />
              )}
              
              {firmwareChecksum && (
                <InfoValue label="Firmware Checksum" value={firmwareChecksum} />
              )}
            </Card>
            
            <Card title="Battery Status">
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <button 
                  onClick={handleGetBatteryState} 
                  disabled={isLoading}
                  style={isLoading ? disabledButtonStyle : buttonStyle}
                >
                  {isLoading ? "Loading..." : "Refresh Battery Status"}
                </button>
                
                {batteryState && (
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      marginBottom: "4px"
                    }}>
                      <span>{batteryState.capacity}%</span>
                      {batteryState.charging && (
                        <span style={{ color: "#33cc33", fontSize: "14px" }}>
                          ⚡ Charging
                        </span>
                      )}
                    </div>
                    <div style={{ 
                      width: "100%", 
                      height: "12px", 
                      backgroundColor: "#eee", 
                      borderRadius: "6px",
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
            </Card>
          </div>
        )}
        
        {/* Devices Tab */}
        {activeTab === "devices" && (
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
                      onClick={() => {
                        const el = document.getElementById("rawDeviceData");
                        if (el) el.style.display = el.style.display === "none" ? "block" : "none";
                      }}
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
                      Toggle raw JSON view
                    </button>
                    <pre id="rawDeviceData" style={{
                      display: "none",
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
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
        
        {/* Messages - shown on all tabs */}
        {!isInitializing && successMessage && (
          <div style={{ 
            marginTop: 20, 
            color: "#1a8754",
            padding: "10px 16px",
            background: "#d1e7dd",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span style={{ fontWeight: "bold" }}>✓</span> {successMessage}
          </div>
        )}
        
        {!isInitializing && error && (
          <div style={{ 
            marginTop: 20, 
            color: "#842029",
            padding: "10px 16px",
            background: "#f8d7da",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <span style={{ fontWeight: "bold" }}>⚠</span> {error}
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
