import { useState } from "react";
import { MyoMod } from "@myomod/three";
import { parseDevice } from "../utils/deviceUtils";

export function useMyoModData(myoMod: MyoMod) {
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
  
  // Initial loading state
  const [isInitializing, setIsInitializing] = useState(true);
  const [initProgress, setInitProgress] = useState(0);
  const [initStep, setInitStep] = useState("");

  // Initialize data
  const initializeData = async () => {
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
      
      setInitStep("Battery State");
      setInitProgress(28);
      const batteryStateVal = await myoMod.dpuControl.getBatteryState();
      setBatteryState(batteryStateVal);
      
      // Only fetch configuration data when not in real-time mode
      if (rtModeVal === 0) {
        setInitStep("Active Config");
        setInitProgress(42);
        const activeConfigIndexVal = await myoMod.dpuControl.getActiveConfigIndex();
        setActiveConfigIndex(activeConfigIndexVal);
        
        setInitStep("Config Checksum");
        setInitProgress(56);
        const configChecksumVal = await myoMod.dpuControl.getConfigurationsChecksum();
        setConfigChecksum(configChecksumVal);
        
        setInitStep("Devices and Config");
        setInitProgress(70);
        
        // Get devices
        await handleGetAllDevicesInternal();
        
        // Get configurations
        setInitProgress(85);
        await handleGetAllConfigurationChunksInternal();
      } else {
        setInitStep("Skipping configuration data (Real-Time Mode active)");
        setInitProgress(70);
        console.log("Skipping configuration data fetching as device is in real-time mode");
      }
      
      setInitProgress(100);
      setSuccessMessage("All data loaded successfully");
    } catch (err) {
      console.error("Error during initialization:", err);
      setError(`Error during initialization (${initStep}): ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsInitializing(false);
    }
  };

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

      const base64ChunkData = btoa(chunkDataInput);
      await myoMod.dpuControl.setConfigurationsChunk(chunkIndex, base64ChunkData);
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

  return {
    // Data states
    version,
    rtMode,
    activeConfigIndex,
    configChecksum,
    firmwareChecksum,
    firmwareVersion,
    batteryState,
    devicesList,
    configChunk,
    completeConfig,
    completeDevices,
    
    // Input states
    configIndexInput,
    setConfigIndexInput,
    deviceIndexInput,
    setDeviceIndexInput,
    chunkIndexInput,
    setChunkIndexInput,
    chunkDataInput,
    setChunkDataInput,
    
    // UI states
    isLoading,
    error,
    successMessage,
    isInitializing,
    initProgress,
    initStep,
    
    // Functions
    initializeData,
    handleGetVersion,
    handleGetRealTimeMode,
    handleSetRealTimeMode,
    handleGetActiveConfigIndex,
    handleSetActiveConfigIndex,
    handleGetConfigurationsChecksum,
    handleGetFirmwareChecksum,
    handleGetFirmwareVersion,
    handleGetBatteryState,
    handleListConnectedDevices,
    handleGetAllDevices,
    handleGetConfigurationsChunk,
    handleGetAllConfigurationChunks,
    handleSetConfigurationsChunk,
    handleReloadConfigurations,
  };
}
