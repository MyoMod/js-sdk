import { useState, useEffect } from "react";
import { useBatteryStore } from "../store";

interface BatteryStatusDisplayProps {
  onRefresh?: () => Promise<void>;
}

export function BatteryStatusDisplay({ onRefresh }: BatteryStatusDisplayProps) {
  const { batteryState, updateTime } = useBatteryStore();

  // Handle click event to refresh battery status
  const handleClick = async () => {
    if (onRefresh) {
      await onRefresh();
    }
  };

  if (!batteryState) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        background: "rgba(255, 255, 255, 0.7)",
        padding: "8px 12px",
        borderRadius: "5px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        zIndex: 10,
        transition: "all 0.2s ease",
      }}
      onClick={handleClick} // Add click handler
      title="Click to refresh battery status" // Add tooltip
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{
            width: "24px",
            height: "12px",
            border: "1px solid #333",
            borderRadius: "2px",
            position: "relative",
            marginRight: "8px",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: "1px",
              left: "1px",
              right: "1px",
              height: `${batteryState.capacity * 0.1 - 0.2}px`,
              backgroundColor: batteryState.charging
                ? "#4CAF50"
                : batteryState.capacity > 20
                ? "#4CAF50"
                : "#FF5722",
              transition: "height 0.3s ease, background-color 0.3s ease",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: "-3px",
              top: "3px",
              width: "2px",
              height: "6px",
              backgroundColor: "#333",
              borderRadius: "0 1px 1px 0",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: "bold" }}>
            {batteryState.capacity}%
            {batteryState.charging && " ⚡"}
          </span>
          <span style={{ fontSize: "10px", color: "#555" }}>
            {batteryState.voltage}V
          </span>
        </div>
      </div>
    </div>
  );
}
