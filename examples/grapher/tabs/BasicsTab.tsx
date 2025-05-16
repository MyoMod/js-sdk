import React from "react";
import { Card } from "../components/Card";
import { InfoValue } from "../components/InfoValue";
import { BatteryDisplay } from "../components/BatteryDisplay";
import { 
  buttonStyle, 
  secondaryButtonStyle, 
  warningButtonStyle, 
  successButtonStyle,
  disabledButtonStyle,
  inputStyle
} from "../utils/styleUtils";

interface BasicsTabProps {
  isLoading: boolean;
  version: string | null;
  rtMode: number | null;
  batteryState: {capacity: number, charging: boolean} | null;
  activeConfigIndex: number | null;
  configChecksum: string | null;
  configIndexInput: string;
  setConfigIndexInput: (value: string) => void;
  handleGetVersion: () => Promise<void>;
  handleGetRealTimeMode: () => Promise<void>;
  handleSetRealTimeMode: (mode: 0 | 1) => Promise<void>;
  handleGetBatteryState: () => Promise<void>;
  handleGetActiveConfigIndex: () => Promise<void>;
  handleSetActiveConfigIndex: () => Promise<void>;
  handleGetConfigurationsChecksum: () => Promise<void>;
  handleGetAllConfigurationChunks: () => Promise<void>;
  handleReloadConfigurations: () => Promise<void>;
}

export function BasicsTab({
  isLoading,
  version,
  rtMode,
  batteryState,
  activeConfigIndex,
  configChecksum,
  configIndexInput,
  setConfigIndexInput,
  handleGetVersion,
  handleGetRealTimeMode,
  handleSetRealTimeMode,
  handleGetBatteryState,
  handleGetActiveConfigIndex,
  handleSetActiveConfigIndex,
  handleGetConfigurationsChecksum,
  handleGetAllConfigurationChunks,
  handleReloadConfigurations
}: BasicsTabProps) {
  return (
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
                <div style={{
                  padding: "8px 12px",
                  background: "#f7f7f7",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "14px",
                  color: "#333",
                }}>{rtMode} ({rtMode === 0 ? "Off" : "On"})</div>
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
            <BatteryDisplay 
              capacity={batteryState.capacity} 
              charging={batteryState.charging} 
            />
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
                <div style={{
                  padding: "8px 12px",
                  background: "#f7f7f7",
                  borderRadius: "4px",
                  fontFamily: "monospace",
                  fontSize: "14px",
                  color: "#333",
                }}>{activeConfigIndex}</div>
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
  );
}
