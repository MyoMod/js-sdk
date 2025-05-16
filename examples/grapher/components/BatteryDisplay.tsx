import React from "react";

interface BatteryDisplayProps {
  capacity: number;
  charging: boolean;
}

export function BatteryDisplay({ capacity, charging }: BatteryDisplayProps) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between",
        marginBottom: "4px"
      }}>
        <span>{capacity}%</span>
        {charging && (
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
          width: `${capacity}%`, 
          height: "100%", 
          backgroundColor: charging ? "#33cc33" : "#3388cc",
          transition: "width 0.5s ease-out"
        }} />
      </div>
    </div>
  );
}
