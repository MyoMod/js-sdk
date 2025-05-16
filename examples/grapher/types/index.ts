import { MyoModHandPose, MyoModEmgData, MyoModFilteredEmgData } from "@myomod/three";

// Type for storing history data
export type PoseHistory = {
  timestamp: number;
  values: Record<string, number>;
};

export type EmgHistory = {
  timestamp: number;
  values: Record<string, Float32Array>;
  rawCounter: number;
};

export type FilteredEmgHistory = {
  timestamp: number;
  values: Float32Array;
  state: number;
  rawCounter: number;
};

// Battery state type
export type BatteryState = {
  capacity: number;
  charging: boolean;
} | null;
