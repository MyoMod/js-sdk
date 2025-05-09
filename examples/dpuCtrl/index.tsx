import { createRoot } from "react-dom/client";
import { StrictMode, Suspense, useState } from "react";
import { loadMyoMod } from "@myomod/three";
import { suspend } from "suspend-react";
import "./index.css";
import { DpuControlApp } from "./components/DpuControlApp";
import { Connecting } from "./components/Connecting";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

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
  const myoMod = suspend(() => loadMyoMod(), [loadMyoModSymbol]);
  return <DpuControlApp myoMod={myoMod} />;
}
