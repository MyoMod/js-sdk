import { MyoMod, MyoModHandPose } from "@myomod/core";
import {
  buildRelativeHandPose,
  computeFingerPoseBuffer,
  createFingersPoseBuffer,
  Finger,
  fingerJointsMap,
  joints,
  readJointMatrix,
} from "./finger.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Group, Object3D } from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

export const DefaultAssetBasePath =
  "https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles/";

const DefaultDefaultXRHandProfileId = "generic-hand";

export class HandModel extends Group {
  private destroyed = false;
  private unsubscribeHandPose?: () => void;

  constructor(
    myoMod: MyoMod,
    handedness: Omit<XRHandedness, "none">,
    assetBasePath = DefaultAssetBasePath,
    defaultXRHandProfileId = DefaultDefaultXRHandProfileId
  ) {
    super();
    this.visible = false;
    loadHandModel(handedness, assetBasePath, defaultXRHandProfileId).then(
      (model) => {
        if (this.destroyed) {
          return;
        }
        this.add(model);
        const update = createUpdateHandModel(model);
        myoMod
          .subscribeHandPose((pose) => {
            this.visible = true;
            update(pose);
          })
          .then((unsubscribe) => {
            this.unsubscribeHandPose = unsubscribe;
          });
      }
    );
  }

  destroy(): void {
    this.clear();
    this.unsubscribeHandPose?.();
  }
}

const loader = new GLTFLoader();

export async function loadHandModel(
  handedness: Omit<XRHandedness, "none">,
  assetBasePath = DefaultAssetBasePath,
  defaultXRHandProfileId = DefaultDefaultXRHandProfileId
) {
  const gltf = await loader.loadAsync(
    new URL(`${defaultXRHandProfileId}/${handedness}.glb`, assetBasePath).href
  );
  const result = cloneSkeleton(gltf.scene);
  const mesh = result.getObjectByProperty("type", "SkinnedMesh");
  if (mesh == null) {
    throw new Error(`missing SkinnedMesh in loaded XRHand model`);
  }
  mesh.frustumCulled = false;
  return result;
}

const openRelativePose = buildRelativeHandPose("open");
const closeRelativePose = buildRelativeHandPose("close");

export function createUpdateHandModel(handModel: Object3D) {
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
  return (pose: MyoModHandPose) => {
    let i = 0;
    for (const [finger, joints] of Object.entries(fingerJointsMap)) {
      computeFingerPoseBuffer(
        "left",
        finger as Finger,
        openRelativePose,
        closeRelativePose,
        pose[`${finger as Finger}Flex`],
        buffer
      );
      for (const joint of joints) {
        readJointMatrix(joint, buffer, jointMatrcies[i++]);
      }
    }
    handModel.rotation.set(
      (0.5 - pose.wristFlex) * Math.PI,
      0,
      (((0.5 - pose.wristRotation) * 182) / 180) * Math.PI,
      "ZXY"
    );
  };
}
