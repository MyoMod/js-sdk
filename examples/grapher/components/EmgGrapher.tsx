import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { suspend } from "suspend-react";
import { loadMyoMod } from "@myomod/three";
import { MyoMod } from "@myomod/three";
import "uplot/dist/uPlot.min.css";

import { loadMyoModSymbol, useBatteryStore } from "../store";
import { Hand } from "./Hand";
import { EmgChart, FilteredEmgChart } from "./charts";
import { DownloadButton } from "./DownloadButton";
import { BatteryStatusDisplay } from "./BatteryStatusDisplay";
import { SamplingControls } from "./SamplingControls";

interface EmgGrapherProps {
  myoMod: MyoMod;
}

export function EmgGrapher({ myoMod }: EmgGrapherProps) {
  // Create sampling rate states at app level to share them
  const [poseSamplingRate, setPoseSamplingRate] = useState(5);
  const [emgSamplingRate, setEmgSamplingRate] = useState(1);
  const [filteredEmgSamplingRate, setFilteredEmgSamplingRate] = useState(1);
  // Replace batch size with framerate controls
  const [updateFramerate, setUpdateFramerate] = useState(30);
  
  // Add state for diagram visibility
  const [showFilteredEmg, setShowFilteredEmg] = useState(true);
  // Only activate showRawEmg by default on desktop, deactivate on mobile
  const [showRawEmg, setShowRawEmg] = useState(() => {
    // Simple check for mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return !isMobile; // Return true for desktop, false for mobile
  });
  
  // Add battery state polling effect
  useEffect(() => {
    const pollBatteryState = async () => {
      try {
        const batteryState = await myoMod.dpuControl.getBatteryState();
        useBatteryStore.setState({
          batteryState,
          updateTime: Date.now()
        });
      } catch (err) {
        console.error("Error fetching battery state:", err);
      }
    };
    
    // Poll initially
    pollBatteryState();
    
    // Then poll every minute
    const interval = setInterval(pollBatteryState, 60000);
    
    return () => clearInterval(interval);
  }, [myoMod]);
  
  return (
    <>
      <Canvas
        camera={{ near: 0.001, position: [0, 0, 0.2] }}
        style={{ position: "absolute", inset: "0", touchAction: "none" }}
      >
        <group
          position-y={-0.08}
          rotation-y={Math.PI / 2}
          rotation-x={Math.PI / 2}
          rotation-z={-Math.PI}
          rotation-order="YXZ"
        >
        <Suspense fallback={null}>
          <Hand 
            myoMod={myoMod} 
            updateFramerate={updateFramerate}
            dataStreams={
              { 
                subscribeToFilteredEmg: showFilteredEmg, 
                subscribeToRawEmg: showRawEmg 
              }
            }
          />
        </Suspense>
          
        </group>
        <ambientLight intensity={1} />
        <directionalLight intensity={10} position={[0, 1, 1]} />
        <OrbitControls enablePan={false} />
      </Canvas>
      
      {/* Chart Visibility Toggles */}
      <div style={{
        position: "absolute",
        top: "70px",
        right: "10px",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        background: "rgba(255,255,255,0.8)",
        padding: "10px",
        borderRadius: "5px",
        boxShadow: "0 0 5px rgba(0,0,0,0.2)"
      }}>
        <div style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "5px" }}>
          Toggle Charts:
        </div>
        <label style={{ 
          display: "flex", 
          alignItems: "center", 
          cursor: "pointer",
          padding: "4px 0"
        }}>
          <input
            type="checkbox"
            checked={showFilteredEmg}
            onChange={() => setShowFilteredEmg(!showFilteredEmg)}
            style={{ marginRight: "8px" }}
          />
          <span>Filtered EMG</span>
        </label>
        <label style={{ 
          display: "flex", 
          alignItems: "center", 
          cursor: "pointer",
          padding: "4px 0"
        }}>
          <input
            type="checkbox"
            checked={showRawEmg}
            onChange={() => setShowRawEmg(!showRawEmg)}
            style={{ marginRight: "8px" }}
          />
          <span>Raw EMG</span>
        </label>
      </div>
      
      <div style={{ position: "absolute", width: "100%", top: "5%", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Only show charts if their visibility is toggled on */}
        {showFilteredEmg && <FilteredEmgChart samplingRate={filteredEmgSamplingRate} />}
        {showRawEmg && <EmgChart samplingRate={emgSamplingRate} />}
      </div>
      <SamplingControls 
        poseSamplingRate={poseSamplingRate}
        setPoseSamplingRate={setPoseSamplingRate}
        emgSamplingRate={emgSamplingRate}
        setEmgSamplingRate={setEmgSamplingRate}
        filteredEmgSamplingRate={filteredEmgSamplingRate}
        setFilteredEmgSamplingRate={setFilteredEmgSamplingRate}
        updateFramerate={updateFramerate}
        setUpdateFramerate={setUpdateFramerate}
      />
      <DownloadButton />
      <BatteryStatusDisplay />
    </>
    );
};