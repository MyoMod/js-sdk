import {
  buildRelativeHandPose,
  computeFingerPoseBuffer,
  createFingersPoseBuffer,
  Finger,
  fingerJointsMap,
  joints,
  readJointMatrix,
} from "@myomod/core";
import { createRoot } from "react-dom/client";
import { StrictMode, Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { Object3D } from "three";
import { useControls } from "leva";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

function App() {
  return (
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
        <Suspense>
          <Hand />
        </Suspense>
      </group>
      <ambientLight intensity={1} />
      <directionalLight intensity={10} position={[0, 1, 1]} />
      <OrbitControls enablePan={false} />
    </Canvas>
  );
}

export const DefaultAssetBasePath =
  "https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/";

const DefaultDefaultXRHandProfileId = "generic-hand";

function Hand({ handedness = "left" }: { handedness?: string }) {
  const alphas = useControls({
    thumb: {
      value: 0.5,
      min: 0,
      max: 1,
    },
    index: {
      value: 0.5,
      min: 0,
      max: 1,
    },
    middle: {
      value: 0.5,
      min: 0,
      max: 1,
    },
    ring: {
      value: 0.5,
      min: 0,
      max: 1,
    },
    pinky: {
      value: 0.5,
      min: 0,
      max: 1,
    },
  });
  const gltf = useGLTF(
    new URL(
      `${DefaultDefaultXRHandProfileId}/${handedness}.glb`,
      DefaultAssetBasePath
    ).href
  );
  const model = useMemo(() => {
    const result = cloneSkeleton(gltf.scene);
    const mesh = result.getObjectByProperty("type", "SkinnedMesh");
    if (mesh == null) {
      throw new Error(`missing SkinnedMesh in loaded XRHand model`);
    }
    mesh.frustumCulled = false;
    return result;
  }, [gltf]);
  const update = useMemo(() => createUpdateXRHandVisuals(model), [model]);
  useFrame(() => update(alphas));
  return <primitive object={model} />;
}

const openRelativePose = buildRelativeHandPose("open");
const closeRelativePose = buildRelativeHandPose("close");

function createUpdateXRHandVisuals(handModel: Object3D) {
  const jointMatrcies = joints.map((joint) => {
    const jointObject = handModel.getObjectByName(joint);
    if (jointObject == null) {
      throw new Error(`missing joint "${joint}" in hand model`);
    }
    jointObject.matrixAutoUpdate = false;
    return jointObject.matrix;
  });
  const wrist = handModel.getObjectByName("wrist");
  if (wrist != null) {
    wrist.matrixAutoUpdate = false;
    wrist.matrix.identity();
  }
  const buffer = createFingersPoseBuffer();
  return (alphas: Record<Finger, number>) => {
    let i = 0;
    for (const [finger, joints] of Object.entries(fingerJointsMap)) {
      computeFingerPoseBuffer(
        "left",
        finger as Finger,
        openRelativePose,
        closeRelativePose,
        alphas[finger as Finger],
        buffer
      );
      for (const joint of joints) {
        readJointMatrix(joint, buffer, jointMatrcies[i++]);
      }
    }
  };
}
