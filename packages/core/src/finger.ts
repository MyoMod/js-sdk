import { Matrix4, Quaternion, Vector3 } from "three";
import { DefaultPoseName, Pose, poses } from "./pose";

export const fingerJointsMap = {
  thumb: [
    "thumb-metacarpal",
    "thumb-phalanx-proximal",
    "thumb-phalanx-distal",
    "thumb-tip",
  ],
  index: [
    "index-finger-metacarpal",
    "index-finger-phalanx-proximal",
    "index-finger-phalanx-intermediate",
    "index-finger-phalanx-distal",
    "index-finger-tip",
  ],
  middle: [
    "middle-finger-metacarpal",
    "middle-finger-phalanx-proximal",
    "middle-finger-phalanx-intermediate",
    "middle-finger-phalanx-distal",
    "middle-finger-tip",
  ],
  ring: [
    "ring-finger-metacarpal",
    "ring-finger-phalanx-proximal",
    "ring-finger-phalanx-intermediate",
    "ring-finger-phalanx-distal",
    "ring-finger-tip",
  ],
  pinky: [
    "pinky-finger-metacarpal",
    "pinky-finger-phalanx-proximal",
    "pinky-finger-phalanx-intermediate",
    "pinky-finger-phalanx-distal",
    "pinky-finger-tip",
  ],
} as const;

const fingerJointsOffsetMap = {} as Record<Finger, number>;
let offset = 0;
for (const [key, joints] of Object.entries(fingerJointsMap)) {
  fingerJointsOffsetMap[key as Finger] = offset;
  offset += joints.length;
}

export const joints = Object.values(fingerJointsMap).reduce<Array<XRHandJoint>>(
  (prev, current) => prev.concat(current),
  []
);

export type Finger = keyof typeof fingerJointsMap;

export type RelativeHandPose = Record<
  keyof (typeof poses)[keyof typeof poses],
  {
    offsetLength: number;
    offsetRotation: Quaternion;
    rotation: Quaternion;
    scale: Vector3;
  }
>;

const invertedPrevMatrixHelper = new Matrix4();
const matrixHelper = new Matrix4();

export function buildRelativeHandPose(
  pose: Pose | DefaultPoseName
): RelativeHandPose {
  const resolvedPose = typeof pose === "string" ? poses[pose] : pose;
  const result = {} as RelativeHandPose;
  for (const fingerJoints of Object.values(fingerJointsMap)) {
    invertedPrevMatrixHelper.identity();
    for (const joint of fingerJoints) {
      const { transform } = resolvedPose[joint];
      //compute local matrix
      matrixHelper.fromArray(transform).premultiply(invertedPrevMatrixHelper);
      //compute next inverted prev matrix
      invertedPrevMatrixHelper.fromArray(transform).invert();
      result[joint] = buildRelativeJointPose(matrixHelper);
    }
  }
  return result;
}

const positionHelper = new Vector3();
const ZAxis = new Vector3(0, 0, 1);

function buildRelativeJointPose(
  matrix: Matrix4
): RelativeHandPose[keyof RelativeHandPose] {
  const scale = new Vector3();
  const rotation = new Quaternion();

  matrix.decompose(positionHelper, rotation, scale);

  const offsetLength = positionHelper.length();
  const offsetRotation = new Quaternion().setFromUnitVectors(
    ZAxis,
    positionHelper.divideScalar(offsetLength)
  );

  return {
    offsetLength,
    offsetRotation,
    rotation,
    scale,
  };
}

export function createFingersPoseBuffer(): Float32Array {
  return new Float32Array(joints.length * 16);
}

export function readJointMatrix(
  joint: XRHandJoint,
  buffer: Float32Array,
  target: Matrix4
): void {
  const index = joints.indexOf(joint);
  if (index === -1) {
    return;
  }
  target.fromArray(buffer, index * 16);
}

const prevMatrixHelper = new Matrix4();
const scaleHelper = new Vector3();
const offsetQuaternionHelper = new Quaternion();
const quaternionHelper = new Quaternion();

export function computeFingerPoseBuffer(
  handedness: XRHandedness,
  finger: Finger,
  fromRelativePose: RelativeHandPose,
  toRelativePose: RelativeHandPose,
  alpha: number,
  targetMatrixBuffer: Float32Array
): void {
  prevMatrixHelper.identity();
  let startJointIndex = fingerJointsOffsetMap[finger]; //TODO
  const joints = fingerJointsMap[finger];
  const jointsLength = joints.length;
  for (let i = 0; i < jointsLength; i++) {
    const joint = joints[i];
    const from = fromRelativePose[joint];
    const to = toRelativePose[joint];

    //building the interpolated new position
    offsetQuaternionHelper.slerpQuaternions(
      from.offsetRotation,
      to.offsetRotation,
      alpha
    );
    const offsetLength =
      from.offsetLength * (1 - alpha) + to.offsetLength * alpha;
    positionHelper
      .copy(ZAxis)
      .multiplyScalar(offsetLength)
      .applyQuaternion(offsetQuaternionHelper);

    matrixHelper.compose(
      positionHelper,
      quaternionHelper.slerpQuaternions(from.rotation, to.rotation, alpha),
      scaleHelper.lerpVectors(from.scale, to.scale, alpha)
    );

    prevMatrixHelper.multiply(matrixHelper);
    prevMatrixHelper.toArray(targetMatrixBuffer, (startJointIndex + i) * 16);
  }
}
