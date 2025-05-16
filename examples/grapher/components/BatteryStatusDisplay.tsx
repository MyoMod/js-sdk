import { useState } from "react";
import { useBatteryStore } from "../store";

export function BatteryStatusDisplay() {
  const { batteryState, updateTime } = useBatteryStore();
  const [expanded, setExpanded] = useState(false);
  
  // Calculate time since last update
  const timeSinceUpdate = updateTime ? 
    Math.floor((Date.now() - updateTime) / 1000) : null;
  
  if (!batteryState) {
    return null;
  }
  
  return (
    <div 
      style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: expanded ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)',
        padding: expanded ? '12px' : '8px 12px',
        borderRadius: '5px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        zIndex: 10,
        transition: 'all 0.2s ease'
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div 
          style={{ 
            width: '24px', 
            height: '12px', 
            border: '1px solid #333',
            borderRadius: '2px',
            position: 'relative',
            marginRight: '8px'
          }}
        >
          <div 
            style={{ 
              position: 'absolute',
              bottom: '1px',
              left: '1px',
              right: '1px',
              height: `${batteryState.capacity * 0.1 - 0.2}px`, 
              backgroundColor: batteryState.charging ? '#4CAF50' : 
                batteryState.capacity > 20 ? '#4CAF50' : '#FF5722',
              transition: 'height 0.3s ease, background-color 0.3s ease'
            }} 
          />
          <div 
            style={{ 
              position: 'absolute',
              right: '-3px',
              top: '3px',
              width: '2px',
              height: '6px',
              backgroundColor: '#333',
              borderRadius: '0 1px 1px 0'
            }}
          />
        </div>
        <span style={{ fontWeight: 'bold' }}>
          {batteryState.capacity}%
          {batteryState.charging && ' ⚡'}
        </span>
      </div>
      
      {expanded && timeSinceUpdate !== null && (
        <div style={{ 
          fontSize: '12px', 
          marginTop: '8px',
          color: '#666'
        }}>
          Updated {timeSinceUpdate} seconds ago
        </div>
      )}
    </div>
  );
}
