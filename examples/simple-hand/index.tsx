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
  },
  raw: new DataView(new Uint8Array(8).buffer),
  history: [],
}));

// Helper to keep only last 10 seconds of data
const updateHistory = (pose: MyoModHandPose, history: PoseHistory[]) => {
  const now = Date.now();
  const newHistory = [
    ...history.filter(item => now - item.timestamp < 10000),
    { timestamp: now, values: { ...pose } }
  ];
  return newHistory;
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
      <DataVis />
    </>
  );
}

function DataVis() {
  const data = useStore();
  return (
    <div
      style={{
        position: "absolute",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {Object.entries(data.pose).map(([key, value], i) => (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 16,
            fontSize: 14,
          }}
          key={key}
        >
          {key}
          <input
            style={{ width: 100 }}
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={value}
          />
          {data.raw.getUint8(i)} / 255
        </div>
      ))}
      <Chart />
    </div>
  );
}

function Chart() {
  const { history } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colors = useMemo(() => ({
    thumbFlex: "red",
    thumbOposition: "green",
    indexFlex: "blue",
    middleFlex: "orange",
    ringFlex: "purple",
    pinkyFlex: "cyan",
    wristFlex: "magenta",
    wristRotation: "yellow",
    counter: "black",
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (history.length < 2) return;
    
    // Get the time range
    const now = Date.now();
    const startTime = now - 10000; // 10 seconds ago
    
    // Draw grid
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const y = canvas.height * (1 - i / 10);
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
    }
    for (let i = 0; i <= 10; i++) {
      const x = canvas.width * (i / 10);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    ctx.stroke();
    
    // Draw each sensor data
    Object.keys(colors).forEach((sensor) => {
      const sensorColor = colors[sensor as keyof typeof colors];
      
      ctx.strokeStyle = sensorColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      let isFirstPoint = true;
      
      history.forEach((point) => {
        if (point.timestamp < startTime) return;
        
        const x = ((point.timestamp - startTime) / 10000) * canvas.width;
        const y = (1 - point.values[sensor]) * canvas.height;
        
        if (isFirstPoint) {
          ctx.moveTo(x, y);
          isFirstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    });
    
    // Draw legend
    ctx.font = "10px Arial";
    Object.entries(colors).forEach(([sensor, color], index) => {
      ctx.fillStyle = color;
      ctx.fillText(sensor, 10, 15 + index * 15);
    });
    
  }, [history, colors]);

  return (
    <div style={{ marginTop: 10 }}>
      <div>Last 10 seconds:</div>
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={200} 
        style={{ border: "1px solid #ccc", backgroundColor: "#f9f9f9" }}
      />
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

const loadHandModelSymbol = Symbol("loadHandModel");

function Hand({ myoMod }: { myoMod: MyoMod }) {
  const model = suspend(loadHandModel, [
    "left",
    undefined,
    undefined,
    loadHandModelSymbol,
  ]);
  const update = useMemo(() => createUpdateHandModel(model), [model]);
  useEffect(() => {
    model.visible = false;
    return myoMod.subscribeHandPose((pose, raw) => {
      useStore.setState(state => ({ 
        pose, 
        raw, 
        history: updateHistory(pose, state.history) 
      }), true);
      model.visible = true;
      update(pose);
    });
  }, [model, update, myoMod]);
  return <primitive object={model} />;
}
