import { createRoot } from "react-dom/client";
import { StrictMode, Suspense, useEffect, useMemo, useState } from "react";
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

const useStore = create<{ pose: MyoModHandPose; raw: DataView }>(() => ({
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
}));

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
        camera={{ near: 0.001, position: [0.25, 0, 0] }}
        style={{ position: "absolute", inset: "0", touchAction: "none" }}
      >
        <group
          rotation-y={-Math.PI / 2}
          rotation-x={Math.PI / 2}
          rotation-order="YXZ"
          position-y={-0.1}
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
      useStore.setState({ pose, raw }, true);
      model.visible = true;
      update(pose);
    });
  }, [model, update, myoMod]);
  return <primitive object={model} />;
}
