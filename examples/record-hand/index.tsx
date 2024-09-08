import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { Canvas } from "@react-three/fiber";
import {
  createXRStore,
  useXR,
  useXRInputSourceEvent,
  useXRInputSourceState,
  XR,
} from "@react-three/xr";
import { Matrix4 } from "three";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

const store = createXRStore();

function App() {
  return (
    <Canvas
      onClick={() => store.enterAR()}
      style={{ position: "absolute", inset: "0", touchAction: "none" }}
    >
      <XR store={store}>
        <HandRecorder />
        <ambientLight intensity={1} />
        <directionalLight intensity={10} position={[0, 1, 1]} />
      </XR>
    </Canvas>
  );
}

const invertedWirstMatrixHelper = new Matrix4();
const matrixHelper = new Matrix4();

function HandRecorder() {
  const rightHand = useXRInputSourceState("hand", "right");
  const leftHand = useXRInputSourceState("hand", "left");
  const referenceSpace = useXR((s) => s.originReferenceSpace);
  useXRInputSourceEvent(
    rightHand?.inputSource,
    "select",
    (event) => {
      if (leftHand == null || referenceSpace == null) {
        return;
      }
      const buffer = new Float32Array(leftHand.inputSource.hand.size * 16);
      event.frame.fillPoses(
        leftHand.inputSource.hand.values(),
        referenceSpace,
        buffer
      );
      invertedWirstMatrixHelper.fromArray(buffer, 0).invert();
      const result: Partial<
        Record<XRHandJoint, { transform: Array<number>; radius: number }>
      > = {};
      const keys = [...leftHand.inputSource.hand.keys()];
      for (let i = 0; i < keys.length; i++) {
        matrixHelper.fromArray(buffer, i * 16);
        matrixHelper.premultiply(invertedWirstMatrixHelper);
        result[keys[i]] = {
          radius: 0,
          transform: matrixHelper.toArray(),
        };
      }
      console.log(result);
    },
    []
  );
  return null;
}
