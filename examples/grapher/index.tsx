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
  MyoModFilteredEmgData,
} from "@myomod/three";
import { suspend } from "suspend-react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import "./index.css";
import { round } from "three/webgpu";

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

type FilteredEmgHistory = {
  timestamp: number;
  values: Float32Array;
  state: number;
  rawCounter: number;
};

// Add battery state type
type BatteryState = {
  capacity: number;
  charging: boolean;
} | null;

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

const useFilteredEmgStore = create<{
  filteredEmg: MyoModFilteredEmgData;
  raw: DataView;
  history: FilteredEmgHistory[];
  packetCount: number | null;
}>(() => ({
  filteredEmg: {
    data: new Float32Array(6),
    state: 0,
  },
  raw: new DataView(new Uint8Array(6*4+4+1).buffer),
  history: [],
  packetCount: null,
}));

// Add a battery state store
const useBatteryStore = create<{
  batteryState: BatteryState;
  updateTime: number | null;
}>(() => ({
  batteryState: null,
  updateTime: null,
}));

// Helper functions that efficiently update history data
const updatePoseHistory = (pose: MyoModHandPose, history: PoseHistory[], packetCount: number | null) => {
  const updatedCount = packetCount === null ? 0 : packetCount + 1;
  const now = updatedCount * 10;
  
  // More efficient approach: push to existing array when possible
  // This avoids recreating the entire array each time
  history.push({ timestamp: now, values: { ...pose } });
  
  return { history, packetCount: updatedCount };
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
  
  // Push directly to the existing array
  history.push({ timestamp: now, values: emgDeepCopy, rawCounter });
  
  return { history, packetCount: updatedCount };
};

const updateFilteredEmgHistory = (filteredEmg: MyoModFilteredEmgData, rawCounter: number, history: FilteredEmgHistory[], packetCount: number | null) => {
  const updatedCount = packetCount === null ? 0 : packetCount + 1;
  const now = updatedCount * 10;
  
  // Push directly to the existing array
  history.push({ timestamp: now, values: new Float32Array(filteredEmg.data), state: filteredEmg.state, rawCounter });
  
  return { history, packetCount: updatedCount };
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

// Download button component for EMG data
function DownloadButton() {
  const handleDownload = () => {
    // Prompt the user for a filename
    const userFilename = window.prompt("Enter a filename for the EMG data (without extension):", 
      `emg-data-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`);
    
    // If user cancels or enters an empty filename, abort download
    if (!userFilename || userFilename.trim() === "") return;
    
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
    link.download = `${userFilename.trim()}.json`;
    
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

// Battery status component
function BatteryStatusDisplay() {
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

function Connected() {
  const myoMod = suspend(loadMyoMod, [loadMyoModSymbol]);
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
      {/* <DataSliders /> */}
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
}

function SamplingControls({
  poseSamplingRate,
  setPoseSamplingRate,
  emgSamplingRate,
  setEmgSamplingRate,
  filteredEmgSamplingRate,
  setFilteredEmgSamplingRate,
  updateFramerate,
  setUpdateFramerate
}: {
  poseSamplingRate: number;
  setPoseSamplingRate: (value: number) => void;
  emgSamplingRate: number;
  setEmgSamplingRate: (value: number) => void;
  filteredEmgSamplingRate: number;
  setFilteredEmgSamplingRate: (value: number) => void;
  updateFramerate: number;
  setUpdateFramerate: (value: number) => void;
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
      {/* <div style={{ marginBottom: "10px" }}>
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
      <div style={{ marginBottom: "10px" }}>
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
      <div style={{ marginBottom: "10px" }}>
        <div style={{ fontSize: "14px", marginBottom: "5px" }}>
          Filtered EMG sampling: every {filteredEmgSamplingRate}th point
        </div>
        <input
          type="range"
          min="1"
          max="50"
          step="1"
          value={filteredEmgSamplingRate}
          onChange={(e) => setFilteredEmgSamplingRate(parseInt(e.target.value))}
          style={{ width: "200px" }}
        />
      </div> */}
      <div>
        <div style={{ fontSize: "14px", marginBottom: "5px" }}>
          Graph update rate: {updateFramerate} FPS
        </div>
        <input
          type="range"
          min="1"
          max="60"
          step="1"
          value={updateFramerate}
          onChange={(e) => setUpdateFramerate(parseInt(e.target.value))}
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
      recentHistory.map(p => p.values.chnA ? p.values.chnA[0] : 0),
      recentHistory.map(p => p.values.chnB ? p.values.chnB[0] : 0),
      recentHistory.map(p => p.values.chnC ? p.values.chnC[0] : 0),
      recentHistory.map(p => p.values.chnD ? p.values.chnD[0] : 0),
      recentHistory.map(p => p.values.chnE ? p.values.chnE[0] : 0),
      recentHistory.map(p => p.values.chnF ? p.values.chnF[0] : 0),
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

function FilteredEmgChart({ samplingRate }: { samplingRate: number }) {
  const { history, packetCount } = useFilteredEmgStore();
  const chartRef = useRef<HTMLDivElement>(null);
  const uPlotRef = useRef<uPlot | null>(null);
  
  useEffect(() => {
    if (!chartRef.current || uPlotRef.current) return;
    
    console.log("Creating uPlot instance for Filtered EMG data");
    
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
        { label: "Channel 1", stroke: "red", width: 2 },
        { label: "Channel 2", stroke: "blue", width: 2 },
        { label: "Channel 3", stroke: "green", width: 2 },
        { label: "Channel 4", stroke: "orange", width: 2 },
        { label: "Channel 5", stroke: "purple", width: 2 },
        { label: "Channel 6", stroke: "cyan", width: 2 },
        { label: "State", stroke: "black", width: 2, show: false },
        { label: "Counter", stroke: "gray", width: 2, show: false },
      ]
    };
    
    const initialData: uPlot.AlignedData = [
      [], // timestamps
      [], [], [], [], [], [], // EMG channels
      [], // state
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
    
    // Process filtered EMG data
    const data: uPlot.AlignedData = [
      timestamps,
      recentHistory.map(p => p.values[0] || 0),
      recentHistory.map(p => p.values[1] || 0),
      recentHistory.map(p => p.values[2] || 0),
      recentHistory.map(p => p.values[3] || 0),
      recentHistory.map(p => p.values[4] || 0),
      recentHistory.map(p => p.values[5] || 0),
      recentHistory.map(p => p.state || 0),
      recentHistory.map(p => p.rawCounter || 0),
    ];
    
    uPlotRef.current.setData(data);
  }, [history, packetCount, samplingRate]);
  
  return (
    <div style={{ marginTop: 10, width: '100%' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>Filtered EMG Data:</div>
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

// Modify the Hand component to use requestAnimationFrame
function Hand({ 
  myoMod, 
  updateFramerate 
}: { 
  myoMod: MyoMod,
  updateFramerate: number
}) {
  // Create refs to store incoming data
  const poseDataRef = useRef<{pose: MyoModHandPose, raw: DataView}[]>([]);
  const emgDataRef = useRef<{emg: MyoModEmgData, counter: number, raw: DataView}[]>([]);
  const filteredEmgDataRef = useRef<{filteredEmg: MyoModFilteredEmgData, counter: number, raw: DataView}[]>([]);
  
  // Animation frame reference
  const animationFrameRef = useRef<number | null>(null);
  
  // Last update timestamp
  const lastUpdateRef = useRef<number>(0);
  
  // Function to process and update all data at a specific framerate
  const processAllData = (timestamp: number) => {
    // Calculate time since last update
    const frameInterval = 1000 / updateFramerate;
    const elapsed = timestamp - lastUpdateRef.current;
    
    // Only update if enough time has passed for the desired framerate
    if (elapsed >= frameInterval) {
      // Update pose data if available
      const poseData = poseDataRef.current;
      if (poseData.length > 0) {
        const latest = poseData[poseData.length - 1];
        
        usePoseStore.setState(state => {
          let historyCopy = [...state.history];
          let updatedPacketCount = state.packetCount;
          
          // Process all collected data points
          poseData.forEach(item => {
            const result = updatePoseHistory(item.pose, historyCopy, updatedPacketCount);
            historyCopy = result.history;
            updatedPacketCount = result.packetCount;
          });
          
          return { 
            pose: latest.pose, 
            raw: latest.raw, 
            history: historyCopy,
            packetCount: updatedPacketCount
          };
        }, true);
        
        // Clear processed data
        poseDataRef.current = [];
      }
      
      // Update EMG data if available
      const emgData = emgDataRef.current;
      if (emgData.length > 0) {
        const latest = emgData[emgData.length - 1];
        
        useEmgStore.setState(state => {
          let historyCopy = [...state.history];
          let updatedPacketCount = state.packetCount;
          
          // Process all collected data points
          emgData.forEach(item => {
            const result = updateEmgHistory(item.emg, item.counter, historyCopy, updatedPacketCount);
            historyCopy = result.history;
            updatedPacketCount = result.packetCount;
          });
          
          return {
            emg: latest.emg,
            raw: latest.raw,
            history: historyCopy,
            packetCount: updatedPacketCount
          };
        }, true);
        
        // Clear processed data
        emgDataRef.current = [];
      }
      
      // Update Filtered EMG data if available
      const filteredEmgData = filteredEmgDataRef.current;
      if (filteredEmgData.length > 0) {
        const latest = filteredEmgData[filteredEmgData.length - 1];
        
        useFilteredEmgStore.setState(state => {
          let historyCopy = [...state.history];
          let updatedPacketCount = state.packetCount;
          
          // Process all collected data points
          filteredEmgData.forEach(item => {
            const result = updateFilteredEmgHistory(item.filteredEmg, item.counter, historyCopy, updatedPacketCount);
            historyCopy = result.history;
            updatedPacketCount = result.packetCount;
          });
          
          return {
            filteredEmg: latest.filteredEmg,
            raw: latest.raw,
            history: historyCopy,
            packetCount: updatedPacketCount
          };
        }, true);
        
        // Clear processed data
        filteredEmgDataRef.current = [];
      }
      
      // Update timestamp of last update
      lastUpdateRef.current = timestamp;
    }
    
    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(processAllData);
  };

  // Setup animation frame loop
  useEffect(() => {
    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(processAllData);
    
    // Cleanup function
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateFramerate]);  // Restart the loop when framerate changes

  useEffect(() => {
    const poseUnsubscribe = myoMod.subscribeHandPose((pose, raw) => {
      // Just collect the data, processing happens in the animation frame
      const deepCopyPose = { ...pose };
      poseDataRef.current.push({ pose: deepCopyPose, raw });
      
      // Limit buffer size to prevent memory issues (keep last 1000 samples at most)
      if (poseDataRef.current.length > 1000) {
        poseDataRef.current = poseDataRef.current.slice(-1000);
      }
    });
    
    const emgUnsubscribe = myoMod.subscribeEmgData((emg, counter, raw) => {
      // Create deep copies of Float32Arrays for EMG data
      const emgDeepCopy: MyoModEmgData = {
        chnA: new Float32Array(emg.chnA),
        chnB: new Float32Array(emg.chnB),
        chnC: new Float32Array(emg.chnC),
        chnD: new Float32Array(emg.chnD),
        chnE: new Float32Array(emg.chnE),
        chnF: new Float32Array(emg.chnF),
      };
      
      // Collect data
      emgDataRef.current.push({ emg: emgDeepCopy, counter, raw });
      
      // Limit buffer size
      if (emgDataRef.current.length > 1000) {
        emgDataRef.current = emgDataRef.current.slice(-1000);
      }
    });
    
    const filteredEmgUnsubscribe = myoMod.subscribeFilteredEmgData((filteredEmg, counter, raw) => {
      // Create deep copy for filtered EMG data
      const filteredEmgDeepCopy: MyoModFilteredEmgData = {
        data: new Float32Array(filteredEmg.data),
        state: filteredEmg.state
      };
      
      // Collect data
      filteredEmgDataRef.current.push({ filteredEmg: filteredEmgDeepCopy, counter, raw });
      
      // Limit buffer size
      if (filteredEmgDataRef.current.length > 1000) {
        filteredEmgDataRef.current = filteredEmgDataRef.current.slice(-1000);
      }
    });
    
    // Cleanup function
    return () => {
      poseUnsubscribe();
      emgUnsubscribe();
      filteredEmgUnsubscribe();
    };
  }, [myoMod]);
  
  return null;
}
