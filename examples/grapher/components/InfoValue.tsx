import React from "react";

interface InfoValueProps {
  label: string;
  value: string | number | null | undefined;
}

export function InfoValue({ label, value }: InfoValueProps) {
  if (value === null || value === undefined) return null;
  
  const infoValueStyle = {
    padding: "8px 12px",
    background: "#f7f7f7",
    borderRadius: "4px",
    fontFamily: "monospace",
    fontSize: "14px",
    color: "#333",
    wordBreak: "break-all" as "break-all",
  };

  return (
    <div>
      <div style={{ marginBottom: "4px", fontSize: "14px", color: "#555" }}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  );
}
