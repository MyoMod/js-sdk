import React from "react";

interface StatusMessageProps {
  successMessage: string | null;
  error: string | null;
}

export function StatusMessage({ successMessage, error }: StatusMessageProps) {
  if (!successMessage && !error) return null;
  
  if (successMessage) {
    return (
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
    );
  }
  
  if (error) {
    return (
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
    );
  }
  
  return null;
}
