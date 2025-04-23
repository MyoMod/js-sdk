import { createRoot } from "react-dom/client";
import { StrictMode, Suspense, useEffect, useMemo, useState, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { create } from "zustand";
import {
  createUpdateHandModel,
  loadHandModel,
  loadMyoMod,
  MyoMod,
  MyoModHandPose,
} from "@myomod/three";
import { suspend } from "suspend-react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Type for storing history data
type PoseHistory = {
  timestamp: number;
  values: Record<string, number>;
};

const useStore = create<{ 
  pose: MyoModHandPose; 
  raw: DataView;
  history: PoseHistory[];
  startTime: number | null;
}>(() => ({
  pose: {
    thumbFlex: 0,
    thumbOposition: 0,
    indexFlex: 0,
    middleFlex: 0,
    ringFlex: 0,
    pinkyFlex: 0,
    wristFlex: 0,
    wristRotation: 0,
    counter: 0,
  },
  raw: new DataView(new Uint8Array(9).buffer),
  history: [],
  startTime: null,
}));

// Helper to keep only last 10 seconds of data
const updateHistory = (pose: MyoModHandPose, history: PoseHistory[], startTime: number | null) => {
  const now = Date.now();
  const updatedStartTime = startTime === null ? now : startTime;
  
  const newHistory = [
    ...history.filter(item => now - item.timestamp < 10000),
    { timestamp: now, values: { ...pose } }
  ];
  return { history: newHistory, startTime: updatedStartTime };
};

function App() {
  const [hasInteracted, setHasInteracted] = useState(false);
  if (!hasInteracted) {
    return (
      <div
        onClick={() => setHasInteracted(true)}
        style={{
          position: "absolute",
          inset: 0,
          background: "white",
          color: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          cursor: "pointer",
        }}
      >
        Click to start.
      </div>
    );
  }
  return (
    <Suspense fallback={<Connecting />}>
      <Connected />
    </Suspense>
  );
}

const loadMyoModSymbol = Symbol("loadMyoMod");

function Connected() {
  const myoMod = suspend(loadMyoMod, [loadMyoModSymbol]);
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
            <Hand myoMod={myoMod} />
          </Suspense>
        </group>
        <ambientLight intensity={1} />
        <directionalLight intensity={10} position={[0, 1, 1]} />
        <OrbitControls enablePan={false} />
      </Canvas>
      <Chart />
      <DataSliders />
    </>
  );
}

function DataSliders() {
  const data = useStore();
  return (
    <div
      style={{
        position: "absolute",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        padding: "0 16px"
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {Object.entries(data.pose).map(([key, value], i) => (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 8,
              fontSize: 14,
              alignItems: "center",
              minWidth: "200px"
            }}
            key={key}
          >
            <span style={{ minWidth: "100px" }}>{key}</span>
            <input
              style={{ width: 80 }}
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={value}
            />
            <span style={{ minWidth: "50px" }}>{data.raw.getUint8(i)}/255</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chart() {
  const { history, startTime } = useStore();
  const chartRef = useRef<HTMLDivElement>(null);
  const uPlotRef = useRef<uPlot | null>(null);
  
  // Create the chart only once when component mounts
  useEffect(() => {
    if (!chartRef.current || uPlotRef.current) return;
    
    console.log("Creating uPlot instance");
    
    // Calculate initial dimensions based on window size
    const initialWidth = Math.max(window.innerWidth - 40, 600);
    const initialHeight = Math.max(Math.min(window.innerHeight * 0.6, 600), 300);
    
    const opts = {
      width: initialWidth,
      height: initialHeight,
      scales: {
        x: {
          time: false,
        },
        y: {
          range: [0, 1]
        }
      },
      legend: {
        show: true,
      },
      series: [
        { label: "Time (s)",  value: (self: any, rawValue: number | null) => rawValue == null ? '0.00' : rawValue.toFixed(2), },
        { label: "thumbFlex", stroke: "red", width: 2 },
        { label: "indexFlex", stroke: "blue", width: 2 },
        { label: "middleFlex", stroke: "green", width: 2 },
        { label: "ringFlex", stroke: "orange", width: 2 },
        { label: "pinkyFlex", stroke: "purple", width: 2 },
        { label: "wristFlex", stroke: "cyan", width: 2 },
        { label: "wristRotation", stroke: "magenta", width: 2 },
        { label: "counter", stroke: "black", width: 2, value: (self: any, rawValue: number | null) => rawValue == null ? '0.00' : rawValue.toFixed(2), },
      ]
    };
    
    // Initialize with empty data
    const initialData = [
      [], // timestamps
      [], [], [], [], [], [], [], [], // sensor values
    ];
    
    uPlotRef.current = new uPlot(opts, initialData, chartRef.current);
    
    // Handle resize
    const handleResize = () => {
      if (uPlotRef.current && chartRef.current) {
        // Use almost full window width and a good portion of height
        const width = Math.max(window.innerWidth - 40, 600);
        const height = Math.max(Math.min(window.innerHeight * 0.6, 600), 300);
        uPlotRef.current.setSize({ width, height });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    // Cleanup only when component unmounts
    return () => {
      window.removeEventListener('resize', handleResize);
      if (uPlotRef.current) {
        uPlotRef.current.destroy();
        uPlotRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs once
  
  // Separate effect to update data when history changes
  useEffect(() => {
    if (!uPlotRef.current || history.length === 0 || startTime === null) return;
    
    const now = Date.now();
    const timeWindow = 10000; // 10 seconds window
    
    // Only show data from the last 10 seconds
    const recentHistory = history.filter(point => now - point.timestamp < timeWindow);
    
    if (recentHistory.length < 2) return;
    
    // Convert timestamps to seconds since start
    const timestamps = recentHistory.map(point => (point.timestamp - startTime) / 1000);
    
    const data = [
      timestamps,
      recentHistory.map(p => p.values.thumbFlex || 0),
      recentHistory.map(p => p.values.indexFlex || 0),
      recentHistory.map(p => p.values.middleFlex || 0),
      recentHistory.map(p => p.values.ringFlex || 0),
      recentHistory.map(p => p.values.pinkyFlex || 0),
      recentHistory.map(p => p.values.wristFlex || 0),
      recentHistory.map(p => p.values.wristRotation || 0),
      recentHistory.map(p => p.values.counter || 0),
    ];
    
    // Update plot data
    uPlotRef.current.setData(data);
  }, [history, startTime]);
  
  return (
    <div style={{ marginTop: 10, width: '100%' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>Real-time Sensor Data:</div>
      <div ref={chartRef} style={{ margin: '0 auto' }} />
    </div>
  );
}

function Connecting() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "white",
        color: "black",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
      }}
    >
      Connecting to MyoMod
    </div>
  );
}

function Hand({ myoMod }: { myoMod: MyoMod }) {
  useEffect(() => {
    return myoMod.subscribeHandPose((pose, raw) => {
      useStore.setState(state => {
        const { history, startTime } = updateHistory(pose, state.history, state.startTime);
        return { 
          pose, 
          raw, 
          history,
          startTime
        }
      }, true);
    });
  }, [myoMod]);
  //return <primitive object={model} />;
}
