import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { suspend } from "suspend-react";
import { loadMyoMod } from "@myomod/three";
import "uplot/dist/uPlot.min.css";

import { Hand } from "./Hand";
import { EmgChart, FilteredEmgChart } from "./charts";
import { DownloadButton } from "./DownloadButton";
import { BatteryStatusDisplay } from "./BatteryStatusDisplay";
import { SamplingControls } from "./SamplingControls";
import { EmgGrapher } from "./EmgGrapher";
import { DpuControlApp } from "./DpuControlApp";

const loadMyoModSymbol = Symbol("loadMyoMod");

export function Connected() {
  const myoMod = suspend(() => loadMyoMod(), [loadMyoModSymbol]);
  const [activeView, setActiveView] = useState<'emgGrapher' | 'dpuControl'>('dpuControl');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Toggle fullscreen function
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      // Enter fullscreen
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {

  
  return (
    <>
      {/* View toggle buttons */}
      <div style={{
        position: "absolute",
        top: "10px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        display: "flex",
        gap: "10px",
        backgroundColor: "rgba(255, 255, 255, 0.7)",
        padding: "5px 10px",
        borderRadius: "5px",
        boxShadow: "0 2px 5px rgba(0, 0, 0, 0.1)"
      }}>
        <button
          onClick={() => setActiveView('dpuControl')}
          style={{
            padding: "8px 16px",
            backgroundColor: activeView === 'dpuControl' ? "#4CAF50" : "#e0e0e0",
            color: activeView === 'dpuControl' ? "white" : "black",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: activeView === 'dpuControl' ? "bold" : "normal",
            transition: "all 0.2s ease"
          }}
        >
          DPU Control
        </button>
        <button
          onClick={() => setActiveView('emgGrapher')}
          style={{
            padding: "8px 16px",
            backgroundColor: activeView === 'emgGrapher' ? "#4CAF50" : "#e0e0e0",
            color: activeView === 'emgGrapher' ? "white" : "black",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: activeView === 'emgGrapher' ? "bold" : "normal",
            transition: "all 0.2s ease"
          }}
        >
          EMG Grapher
        </button>
        <button
          onClick={() => setActiveView('dpuControl')}
          style={{
            padding: "8px 16px",
            backgroundColor: activeView === 'dpuControl' ? "#4CAF50" : "#e0e0e0",
            color: activeView === 'dpuControl' ? "white" : "black",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: activeView === 'dpuControl' ? "bold" : "normal",
            transition: "all 0.2s ease"
          }}
        >
          DPU Control
        </button>
      </div>
      
      {/* Render active component based on selection */}
      {activeView === 'emgGrapher' ? (
        <EmgGrapher myoMod={myoMod} />
      ) : (
        <DpuControlApp myoMod={myoMod} />
      )}
    </>
  );
}
