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
  MyoModEmgData,
} from "@myomod/three";
import { suspend } from "suspend-react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import "./index.css";
import { round } from "three/webgpu";

// Create a component to inject CSS styles
function StylesInjector() {
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .u-legend .u-value {
        min-width: 80px !important;
      }
    `;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  
  return null;
}

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

type EmgHistory = {
  timestamp: number;
  values: Record<string, Float32Array>;
  rawCounter: number;
};

const usePoseStore = create<{ 
  pose: MyoModHandPose; 
  raw: DataView;
  history: PoseHistory[];
  packetCount: number | null;
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
  packetCount: null,
}));

const useEmgStore = create<{
  emg: MyoModEmgData;
  raw: DataView;
  history: EmgHistory[];
  packetCount: number | null;
}>(() => ({
  emg: {
    chnA: new Float32Array(15),
    chnB: new Float32Array(15),
    chnC: new Float32Array(15),
    chnD: new Float32Array(15),
    chnE: new Float32Array(15),
    chnF: new Float32Array(15),
  },
  raw: new DataView(new Uint8Array(15*6*4+1).buffer),
  history: [],
  packetCount: null,
}));

// Helper to keep all data for history but filter for display
const updatePoseHistory = (pose: MyoModHandPose, history: PoseHistory[], packetCount: number | null) => {
  const updatedCount = packetCount === null ? 0 : packetCount + 1;
  const now = updatedCount * 10;
  
  // Add new data point without filtering
  const newHistory = [
    ...history,
    { timestamp: now, values: { ...pose } }
  ];
  return { history: newHistory, packetCount: updatedCount };
};

const updateEmgHistory = (emg: MyoModEmgData, rawCounter: number, history: EmgHistory[], packetCount: number | null) => {
  const updatedCount = packetCount === null ? 0 : packetCount + 1;
  const now = updatedCount * 10;
  
  // Create deep copies of all Float32Arrays
  const emgDeepCopy: Record<string, Float32Array> = {
    chnA: new Float32Array(emg.chnA),
    chnB: new Float32Array(emg.chnB),
    chnC: new Float32Array(emg.chnC),
    chnD: new Float32Array(emg.chnD),
    chnE: new Float32Array(emg.chnE),
    chnF: new Float32Array(emg.chnF),
  };
  
  // Add new data point without filtering
  const newHistory = [
    ...history,
    { timestamp: now, values: emgDeepCopy, rawCounter }
  ];
  return { history: newHistory, packetCount: updatedCount };
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
      <StylesInjector />
      <Connected />
    </Suspense>
  );
}

// Download button component for EMG data
function DownloadButton() {
  const handleDownload = () => {
    const emgStore = useEmgStore.getState();
    
    // Convert Float32Arrays to regular arrays for JSON serialization
    const exportData = emgStore.history.map(item => ({
      timestamp: item.timestamp,
      rawCounter: item.rawCounter,
      values: {
        chnA: Array.from(item.values.chnA),
        chnB: Array.from(item.values.chnB),
        chnC: Array.from(item.values.chnC),
        chnD: Array.from(item.values.chnD),
        chnE: Array.from(item.values.chnE),
        chnF: Array.from(item.values.chnF),
      }
    }));
    
    // Create a Blob containing the JSON data
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    
    // Create a download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `emg-data-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    
    // Trigger the download
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: "absolute",
      top: "10px",
      right: "10px",
      zIndex: 10
    }}>
      <button 
        onClick={handleDownload}
        style={{
          padding: "8px 16px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "bold",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
        }}
      >
        Download EMG Data
      </button>
    </div>
  );
}

const loadMyoModSymbol = Symbol("loadMyoMod");

function Connected() {
  const myoMod = suspend(loadMyoMod, [loadMyoModSymbol]);
  // Create sampling rate states at app level to share them
  const [poseSamplingRate, setPoseSamplingRate] = useState(5);
  const [emgSamplingRate, setEmgSamplingRate] = useState(1);
  
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
      <div style={{ position: "absolute", width: "100%", top: "10%", display: "flex", flexDirection: "column", gap: "20px" }}>
        <Chart samplingRate={poseSamplingRate} />
        <EmgChart samplingRate={emgSamplingRate} />
      </div>
      <DataSliders />
      <SamplingControls 
        poseSamplingRate={poseSamplingRate}
        setPoseSamplingRate={setPoseSamplingRate}
        emgSamplingRate={emgSamplingRate}
        setEmgSamplingRate={setEmgSamplingRate}
      />
      <DownloadButton />
    </>
  );
}

function SamplingControls({
  poseSamplingRate,
  setPoseSamplingRate,
  emgSamplingRate,
  setEmgSamplingRate
}: {
  poseSamplingRate: number;
  setPoseSamplingRate: (value: number) => void;
  emgSamplingRate: number;
  setEmgSamplingRate: (value: number) => void;
}) {
  return (
    <div style={{
      position: "absolute",
      bottom: "10px",
      right: "10px",
      background: "rgba(255,255,255,0.8)",
      padding: "10px",
      borderRadius: "5px",
      zIndex: 10,
      boxShadow: "0 0 5px rgba(0,0,0,0.2)"
    }}>
      <div style={{ marginBottom: "10px" }}>
        <div style={{ fontSize: "14px", marginBottom: "5px" }}>
          Pose sampling: every {poseSamplingRate}th point
        </div>
        <input
          type="range"
          min="1"
          max="20"
          step="1"
          value={poseSamplingRate}
          onChange={(e) => setPoseSamplingRate(parseInt(e.target.value))}
          style={{ width: "200px" }}
        />
      </div>
      <div>
        <div style={{ fontSize: "14px", marginBottom: "5px" }}>
          EMG sampling: every {emgSamplingRate}th point
        </div>
        <input
          type="range"
          min="1"
          max="50"
          step="1"
          value={emgSamplingRate}
          onChange={(e) => setEmgSamplingRate(parseInt(e.target.value))}
          style={{ width: "200px" }}
        />
      </div>
    </div>
  );
}

function DataSliders() {
  const data = usePoseStore();
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
              readOnly={true}
            />
            <span style={{ minWidth: "50px" }}>{data.raw.getUint8(i)}/255</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chart({ samplingRate }: { samplingRate: number }) {
  const { history, packetCount } = usePoseStore();
  const chartRef = useRef<HTMLDivElement>(null);
  const uPlotRef = useRef<uPlot | null>(null);
  
  // Create the chart only once when component mounts
  useEffect(() => {
    if (!chartRef.current || uPlotRef.current) return;
    
    console.log("Creating uPlot instance for pose data");
    
    // Calculate initial dimensions based on window size
    const initialWidth = Math.max(window.innerWidth - 40, 600);
    const initialHeight = Math.max(Math.min(window.innerHeight * 0.3, 300), 200);
    
    const opts: uPlot.Options = {
      width: initialWidth,
      height: initialHeight,
      scales: {
        x: {
          time: false,
          // Set default range to show last 10 seconds of data
          range: [-10, 0],
          // Keep 0 (the present) at the right edge
          auto: false
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
        { label: "wristRotation", stroke: "magenta", width: 2},
        { label: "counter", stroke: "black", width: 2, value: (self: any, rawValue: number | null) => rawValue == null ? '0.00' : rawValue.toFixed(2), "show": false },
      ]
    };
    
    // Initialize with empty data
    const initialData: uPlot.AlignedData = [
      [], // timestamps
      [], [], [], [], [], [], [], [], // sensor values
    ];
    
    uPlotRef.current = new uPlot(opts, initialData, chartRef.current);
    
    // Handle resize
    const handleResize = () => {
      if (uPlotRef.current && chartRef.current) {
        // Use almost full window width and a good portion of height
        const width = Math.max(window.innerWidth - 40, 600);
        const height = Math.max(Math.min(window.innerHeight * 0.3, 300), 200);
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
    if (!uPlotRef.current || history.length === 0 || packetCount === null) return;
    
    // Find the most recent timestamp
    const latestTime = history[history.length - 1].timestamp;
    
    // Filter to only show the last 10 seconds for display
    const recentHistory = history
      .filter(item => latestTime - item.timestamp < 10000)
      .filter((item) => (item.timestamp/10) % samplingRate === 0);
    
    if (recentHistory.length < 2) return;
    
    // Convert timestamps to negative seconds relative to the present (0)
    const timestamps = recentHistory.map(point => (point.timestamp - latestTime) / 1000);
    
    const data: uPlot.AlignedData = [
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
  }, [history, packetCount, samplingRate]); // Keep samplingRate in dependencies
  
  return (
    <div style={{ marginTop: 10, width: '100%' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>Hand Pose Data:</div>
      <div ref={chartRef} style={{ margin: '0 auto' }} />
    </div>
  );
}

function EmgChart({ samplingRate }: { samplingRate: number }) {
  const { history, packetCount } = useEmgStore();
  const chartRef = useRef<HTMLDivElement>(null);
  const uPlotRef = useRef<uPlot | null>(null);
  
  useEffect(() => {
    if (!chartRef.current || uPlotRef.current) return;
    
    console.log("Creating uPlot instance for EMG data");
    
    const initialWidth = Math.max(window.innerWidth - 40, 600);
    const initialHeight = Math.max(Math.min(window.innerHeight * 0.3, 300), 200);
    
    const opts: uPlot.Options = {
      width: initialWidth,
      height: initialHeight,
      scales: {
        x: {
          time: false,
          // Set default range to show last 10 seconds of data
          range: [-10, 0],
          // Keep 0 (the present) at the right edge
          auto: false
        },
        y: {
          auto: true,
        }
      },
      legend: {
        show: true,
      },
      series: [
        { label: "Time (s)", value: (self: any, rawValue: number | null) => rawValue == null ? '0.00' : rawValue.toFixed(2) },
        { label: "Channel A", stroke: "red", width: 1 },
        { label: "Channel B", stroke: "blue", width: 1 },
        { label: "Channel C", stroke: "green", width: 1 },
        { label: "Channel D", stroke: "orange", width: 1 },
        { label: "Channel E", stroke: "purple", width: 1 },
        { label: "Channel F", stroke: "cyan", width: 1 },
        { label: "Counter", stroke: "black", width: 1, "show": false  },
      ]
    };
    
    const initialData: uPlot.AlignedData = [
      [], // timestamps
      [], [], [], [], [], [], // EMG channels
      [], // counter
    ];
    
    uPlotRef.current = new uPlot(opts, initialData, chartRef.current);
    
    const handleResize = () => {
      if (uPlotRef.current && chartRef.current) {
        const width = Math.max(window.innerWidth - 40, 600);
        const height = Math.max(Math.min(window.innerHeight * 0.3, 300), 200);
        uPlotRef.current.setSize({ width, height });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (uPlotRef.current) {
        uPlotRef.current.destroy();
        uPlotRef.current = null;
      }
    };
  }, []);
  
  useEffect(() => {
    if (!uPlotRef.current || history.length === 0 || packetCount === null) return;
    
    // Find the most recent timestamp
    const latestTime = history[history.length - 1].timestamp;
    
    // Filter to only show the last 10 seconds for display
    const recentHistory = history
      .filter(item => latestTime - item.timestamp < 10000)
      .filter((item) => (item.timestamp/10) % samplingRate === 0);
    
    if (recentHistory.length < 2) return;
    
    // Convert timestamps to negative seconds relative to the present (0)
    const timestamps = recentHistory.map(point => (point.timestamp - latestTime) / 1000);

    const average = (arr: Float32Array) => arr.reduce( ( p, c ) => p + c, 0 ) / arr.length;
    
    // Process EMG data - take the average of each channel's array
    const data: uPlot.AlignedData = [
      timestamps,
      recentHistory.map(p => p.values.chnA ? Math.ceil(average(p.values.chnA)) : 0),
      recentHistory.map(p => p.values.chnB ? Math.ceil(average(p.values.chnB)) : 0),
      recentHistory.map(p => p.values.chnC ? Math.ceil(average(p.values.chnC)) : 0),
      recentHistory.map(p => p.values.chnD ? Math.ceil(average(p.values.chnD)) : 0),
      recentHistory.map(p => p.values.chnE ? Math.ceil(average(p.values.chnE)) : 0),
      recentHistory.map(p => p.values.chnF ? Math.ceil(average(p.values.chnF)) : 0),
      recentHistory.map(p => p.rawCounter || 0),
    ];
    
    uPlotRef.current.setData(data);
  }, [history, packetCount, samplingRate]);
  
  return (
    <div style={{ marginTop: 10, width: '100%' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>EMG Data:</div>
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
    const poseUnsubscribe = myoMod.subscribeHandPose((pose, raw) => {
      usePoseStore.setState(state => {
        const { history, packetCount } = updatePoseHistory(pose, state.history, state.packetCount);
        return { 
          pose, 
          raw, 
          history,
          packetCount
        }
      }, true);
    });
    
    const emgUnsubscribe = myoMod.subscribeEmgData((emg, counter, raw) => {
      useEmgStore.setState(state => {
        const { history, packetCount } = updateEmgHistory(emg, counter, state.history, state.packetCount);
        return {
          emg,
          raw,
          history,
          packetCount
        }
      }, true);
    });
    
    return () => {
      poseUnsubscribe();
      emgUnsubscribe();
    };
  }, [myoMod]);
  
  return null;
}
