import { create } from "zustand";
import { 
  MyoModHandPose, 
  MyoModEmgData, 
  MyoModFilteredEmgData 
} from "@myomod/three";
import { 
  PoseHistory, 
  EmgHistory, 
  FilteredEmgHistory, 
  BatteryState 
} from "../types";

export const usePoseStore = create<{ 
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

export const useEmgStore = create<{
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

export const useFilteredEmgStore = create<{
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

// Battery state store
export const useBatteryStore = create<{
  batteryState: BatteryState;
  updateTime: number | null;
}>(() => ({
  batteryState: null,
  updateTime: null,
}));

// Helper functions that efficiently update history data
export const updatePoseHistory = (pose: MyoModHandPose, history: PoseHistory[], packetCount: number | null) => {
  const updatedCount = packetCount === null ? 0 : packetCount + 1;
  const now = updatedCount * 10;
  
  // More efficient approach: push to existing array when possible
  history.push({ timestamp: now, values: { ...pose } });
  
  return { history, packetCount: updatedCount };
};

export const updateEmgHistory = (emg: MyoModEmgData, rawCounter: number, history: EmgHistory[], packetCount: number | null) => {
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

export const updateFilteredEmgHistory = (filteredEmg: MyoModFilteredEmgData, rawCounter: number, history: FilteredEmgHistory[], packetCount: number | null) => {
  const updatedCount = packetCount === null ? 0 : packetCount + 1;
  const now = updatedCount * 10;
  
  // Push directly to the existing array
  history.push({ timestamp: now, values: new Float32Array(filteredEmg.data), state: filteredEmg.state, rawCounter });
  
  return { history, packetCount: updatedCount };
};

export const loadMyoModSymbol = Symbol("loadMyoMod");
