import React from "react";

interface TabNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function TabNavigation({ activeTab, setActiveTab }: TabNavigationProps) {
  const tabButtonStyle = (tab: string) => ({
    padding: "10px 16px",
    background: activeTab === tab ? "#fff" : "#f5f5f5",
    color: activeTab === tab ? "#0066cc" : "#555",
    border: "none",
    borderBottom: activeTab === tab ? "2px solid #0066cc" : "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: activeTab === tab ? 600 : 400,
    transition: "all 0.2s",
  });

  return (
    <div style={{ 
      display: "flex", 
      marginBottom: "24px", 
      borderBottom: "1px solid #ddd",
      overflow: "auto",
      whiteSpace: "nowrap" as "nowrap"
    }}>
      <button style={tabButtonStyle("basics")} onClick={() => setActiveTab("basics")}>System Overview</button>
      <button style={tabButtonStyle("config")} onClick={() => setActiveTab("config")}>Configuration</button>
      <button style={tabButtonStyle("system")} onClick={() => setActiveTab("system")}>Firmware & Battery</button>
      <button style={tabButtonStyle("devices")} onClick={() => setActiveTab("devices")}>Connected Devices</button>
    </div>
  );
}
