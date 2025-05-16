import { Suspense, useState } from "react";
import { Connected } from "./Connected";
import { Connecting } from "./Connecting";

export function App() {
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
