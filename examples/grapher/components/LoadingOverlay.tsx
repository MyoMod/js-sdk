import React from "react";

interface LoadingOverlayProps {
  progress: number;
  step: string;
  error: string | null;
}

export function LoadingOverlay({ progress, step, error }: LoadingOverlayProps) {
  return (
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
            width: `${progress}%`,
            transition: "width 0.3s ease-out"
          }} 
        />
      </div>
      <div style={{ marginTop: "10px", color: "#666" }}>
        {step}... {progress}%
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
  );
}
