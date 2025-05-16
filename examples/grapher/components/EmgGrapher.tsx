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
          />
        </Suspense>
          
        </group>
        <ambientLight intensity={1} />
        <directionalLight intensity={10} position={[0, 1, 1]} />
        <OrbitControls enablePan={false} />
      </Canvas>
      <div style={{ position: "absolute", width: "100%", top: "5%", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* <Chart samplingRate={poseSamplingRate} /> */}
        <EmgChart samplingRate={emgSamplingRate} />
        <FilteredEmgChart samplingRate={filteredEmgSamplingRate} />
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