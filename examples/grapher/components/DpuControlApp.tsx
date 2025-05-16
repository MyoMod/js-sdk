import { useEffect, useRef, useState } from "react";
import { MyoMod } from "@myomod/three";
import { TabNavigation } from "./TabNavigation";
import { BasicsTab } from "../tabs/BasicsTab";
import { ConfigTab } from "../tabs/ConfigTab";
import { SystemTab } from "../tabs/SystemTab";
import { DevicesTab } from "../tabs/DevicesTab";
import { StatusMessage } from "./StatusMessage";
import { LoadingOverlay } from "./LoadingOverlay";
import { useMyoModData } from "../hooks/useMyoModData";

interface DpuControlAppProps {
  myoMod: MyoMod;
}

export function DpuControlApp({ myoMod }: DpuControlAppProps) {
  // Track mounting with useRef to prevent double initialization
  const mountedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<string>("basics");
  
  // Get shared state and handlers from custom hook
  const {
    // Data states
    version, rtMode, activeConfigIndex, configChecksum, 
    firmwareChecksum, firmwareVersion, batteryState,
    devicesList, configChunk, completeConfig, completeDevices,
    
    // Input states
    configIndexInput, setConfigIndexInput,
    deviceIndexInput, setDeviceIndexInput,
    chunkIndexInput, setChunkIndexInput,
    chunkDataInput, setChunkDataInput,
    
    // UI states
    isLoading, error, successMessage,
    isInitializing, initProgress, initStep,
    
    // Handler functions
    initializeData,
    handleGetVersion, handleGetRealTimeMode, handleSetRealTimeMode,
    handleGetActiveConfigIndex, handleSetActiveConfigIndex,
    handleGetConfigurationsChecksum, handleGetFirmwareChecksum,
    handleGetFirmwareVersion, handleGetBatteryState,
    handleListConnectedDevices, handleGetAllDevices,
    handleGetConfigurationsChunk, handleGetAllConfigurationChunks,
    handleSetConfigurationsChunk, handleReloadConfigurations
  } = useMyoModData(myoMod);

  // Initialization effect - runs once when component mounts
  useEffect(() => {
    // Skip initialization if this is a duplicate mount
    if (mountedRef.current) {
      console.log("Skipping initialization - component already mounted");
      return;
    }

    // Mark as mounted
    mountedRef.current = true;
    
    // Initialize data
    initializeData();
    
  }, []);

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
        //maxWidth: "800px",
        width: "90%",
        maxHeight: "90vh",
        overflow: "auto"
      }}>
        <h2 style={{ marginBottom: "20px", color: "#333", borderBottom: "2px solid #0066cc", paddingBottom: "10px" }}>
          <span style={{ color: "#0066cc" }}>MyoMod</span> DPU Control
        </h2>
        
        {isInitializing && (
          <LoadingOverlay 
            progress={initProgress} 
            step={initStep} 
            error={error}
          />
        )}
        
        <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
        
        {activeTab === "basics" && (
          <BasicsTab
            isLoading={isLoading}
            version={version}
            rtMode={rtMode}
            batteryState={batteryState}
            activeConfigIndex={activeConfigIndex}
            configChecksum={configChecksum}
            configIndexInput={configIndexInput}
            setConfigIndexInput={setConfigIndexInput}
            handleGetVersion={handleGetVersion}
            handleGetRealTimeMode={handleGetRealTimeMode}
            handleSetRealTimeMode={handleSetRealTimeMode}
            handleGetBatteryState={handleGetBatteryState}
            handleGetActiveConfigIndex={handleGetActiveConfigIndex}
            handleSetActiveConfigIndex={handleSetActiveConfigIndex}
            handleGetConfigurationsChecksum={handleGetConfigurationsChecksum}
            handleGetAllConfigurationChunks={handleGetAllConfigurationChunks}
            handleReloadConfigurations={handleReloadConfigurations}
          />
        )}
        
        {activeTab === "config" && (
          <ConfigTab
            isLoading={isLoading}
            configChunk={configChunk}
            completeConfig={completeConfig}
            chunkIndexInput={chunkIndexInput}
            setChunkIndexInput={setChunkIndexInput}
            chunkDataInput={chunkDataInput}
            setChunkDataInput={setChunkDataInput}
            handleGetConfigurationsChunk={handleGetConfigurationsChunk}
            handleSetConfigurationsChunk={handleSetConfigurationsChunk}
            handleGetAllConfigurationChunks={handleGetAllConfigurationChunks}
          />
        )}
        
        {activeTab === "system" && (
          <SystemTab
            isLoading={isLoading}
            firmwareVersion={firmwareVersion}
            firmwareChecksum={firmwareChecksum}
            batteryState={batteryState}
            handleGetFirmwareVersion={handleGetFirmwareVersion}
            handleGetFirmwareChecksum={handleGetFirmwareChecksum}
            handleGetBatteryState={handleGetBatteryState}
          />
        )}
        
        {activeTab === "devices" && (
          <DevicesTab
            isLoading={isLoading}
            devicesList={devicesList}
            completeDevices={completeDevices}
            deviceIndexInput={deviceIndexInput}
            setDeviceIndexInput={setDeviceIndexInput}
            handleListConnectedDevices={handleListConnectedDevices}
            handleGetAllDevices={handleGetAllDevices}
          />
        )}
        
        {!isInitializing && (successMessage || error) && (
          <StatusMessage 
            successMessage={successMessage} 
            error={error}
          />
        )}
      </div>
    </>
  );
}
