import React from "react";
import { Card } from "../components/Card";
import { InfoValue } from "../components/InfoValue";
import { BatteryDisplay } from "../components/BatteryDisplay";
import { buttonStyle, disabledButtonStyle } from "../utils/styleUtils";

interface SystemTabProps {
  isLoading: boolean;
  firmwareVersion: string | null;
  firmwareChecksum: string | null;
  batteryState: {capacity: number, charging: boolean} | null;
  handleGetFirmwareVersion: () => Promise<void>;
  handleGetFirmwareChecksum: () => Promise<void>;
  handleGetBatteryState: () => Promise<void>;
}

export function SystemTab({
  isLoading,
  firmwareVersion,
  firmwareChecksum,
  batteryState,
  handleGetFirmwareVersion,
  handleGetFirmwareChecksum,
  handleGetBatteryState
}: SystemTabProps) {
  return (
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
            <BatteryDisplay 
              capacity={batteryState.capacity} 
              charging={batteryState.charging} 
            />
          )}
        </div>
      </Card>
    </div>
  );
}
