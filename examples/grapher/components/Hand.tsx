import { useRef, useEffect } from "react";
import {
  MyoMod,
  MyoModHandPose,
  MyoModEmgData,
  MyoModFilteredEmgData,
} from "@myomod/three";
import {
  usePoseStore,
  useEmgStore,
  useFilteredEmgStore,
  updatePoseHistory,
  updateEmgHistory,
  updateFilteredEmgHistory,
} from "../store";

// Define interface for data stream subscription controls
interface DataStreamControls {
  subscribeToHandPose?: boolean;
  subscribeToRawEmg?: boolean;
  subscribeToFilteredEmg?: boolean;
}

export function Hand({
  myoMod,
  updateFramerate,
  dataStreams = { subscribeToFilteredEmg: true },
}: {
  myoMod: MyoMod;
  updateFramerate: number;
  dataStreams?: DataStreamControls;
}) {
  // Create refs to store incoming data
  const poseDataRef = useRef<{ pose: MyoModHandPose; raw: DataView }[]>([]);
  const emgDataRef = useRef<
    { emg: MyoModEmgData; counter: number; raw: DataView }[]
  >([]);
  const filteredEmgDataRef = useRef<
    { filteredEmg: MyoModFilteredEmgData; counter: number; raw: DataView }[]
  >([]);

  // Animation frame reference
  const animationFrameRef = useRef<number | null>(null);

  // Last update timestamp
  const lastUpdateRef = useRef<number>(0);

  console.log("Hand component mounted");

  // Function to process and update all data at a specific framerate
  const processAllData = (timestamp: number) => {
    // Calculate time since last update
    const frameInterval = 1000 / updateFramerate;
    const elapsed = timestamp - lastUpdateRef.current;

    // Only update if enough time has passed for the desired framerate
    if (elapsed >= frameInterval) {
      // Update pose data if available
      const poseData = poseDataRef.current;
      if (poseData.length > 0) {
        const latest = poseData[poseData.length - 1];

        usePoseStore.setState((state) => {
          let historyCopy = [...state.history];
          let updatedPacketCount = state.packetCount;

          // Process all collected data points
          poseData.forEach((item) => {
            const result = updatePoseHistory(
              item.pose,
              historyCopy,
              updatedPacketCount
            );
            historyCopy = result.history;
            updatedPacketCount = result.packetCount;
          });

          return {
            pose: latest.pose,
            raw: latest.raw,
            history: historyCopy,
            packetCount: updatedPacketCount,
          };
        }, true);

        // Clear processed data
        poseDataRef.current = [];
      }

      // Update EMG data if available
      const emgData = emgDataRef.current;
      if (emgData.length > 0) {
        const latest = emgData[emgData.length - 1];

        useEmgStore.setState((state) => {
          let historyCopy = [...state.history];
          let updatedPacketCount = state.packetCount;

          // Process all collected data points
          emgData.forEach((item) => {
            const result = updateEmgHistory(
              item.emg,
              item.counter,
              historyCopy,
              updatedPacketCount
            );
            historyCopy = result.history;
            updatedPacketCount = result.packetCount;
          });

          return {
            emg: latest.emg,
            raw: latest.raw,
            history: historyCopy,
            packetCount: updatedPacketCount,
          };
        }, true);

        // Clear processed data
        emgDataRef.current = [];
      }

      // Update Filtered EMG data if available
      const filteredEmgData = filteredEmgDataRef.current;
      if (filteredEmgData.length > 0) {
        const latest = filteredEmgData[filteredEmgData.length - 1];

        useFilteredEmgStore.setState((state) => {
          let historyCopy = [...state.history];
          let updatedPacketCount = state.packetCount;

          // Process all collected data points
          filteredEmgData.forEach((item) => {
            const result = updateFilteredEmgHistory(
              item.filteredEmg,
              item.counter,
              historyCopy,
              updatedPacketCount
            );
            historyCopy = result.history;
            updatedPacketCount = result.packetCount;
          });

          return {
            filteredEmg: latest.filteredEmg,
            raw: latest.raw,
            history: historyCopy,
            packetCount: updatedPacketCount,
          };
        }, true);

        // Clear processed data
        filteredEmgDataRef.current = [];
      }

      // Update timestamp of last update
      lastUpdateRef.current = timestamp;
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(processAllData);
  };

  // Setup animation frame loop
  useEffect(() => {
    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(processAllData);

    // Cleanup function
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateFramerate]); // Restart the loop when framerate changes

  useEffect(() => {
    console.log("Subscribing to MyoMod data streams:", dataStreams);

    // Store cleanup functions
    let unsubscribeFunctions: {
      raw: (() => void) | undefined;
      filtered: (() => void) | undefined;
      pose: (() => void) | undefined;
    } = {
      raw: undefined,
      filtered: undefined,
      pose: undefined,
    };

    // Async function to handle subscriptions
    const setupSubscriptions = async () => {
      try {
        // Subscribe to hand pose data if enabled
        if (dataStreams.subscribeToHandPose) {
          console.log("Subscribing to hand pose...");
          const poseUnsubscribe = await myoMod.subscribeHandPose(
            (pose, raw) => {
              // Just collect the data, processing happens in the animation frame
              const deepCopyPose = { ...pose };
              poseDataRef.current.push({ pose: deepCopyPose, raw });

              // Limit buffer size to prevent memory issues (keep last 1000 samples at most)
              if (poseDataRef.current.length > 1000) {
                poseDataRef.current = poseDataRef.current.slice(-1000);
              }
            }
          );
          console.log("Subscribed to hand pose");
          unsubscribeFunctions.pose = poseUnsubscribe;
        }

        // Subscribe to EMG data if enabled
        if (dataStreams.subscribeToRawEmg) {
          console.log("Subscribing to raw EMG...");
          const emgUnsubscribe = await myoMod.subscribeEmgData(
            (emg, counter, raw) => {
              // Create deep copies of Float32Arrays for EMG data
              const emgDeepCopy: MyoModEmgData = {
                chnA: new Float32Array(emg.chnA),
                chnB: new Float32Array(emg.chnB),
                chnC: new Float32Array(emg.chnC),
                chnD: new Float32Array(emg.chnD),
                chnE: new Float32Array(emg.chnE),
                chnF: new Float32Array(emg.chnF),
              };

              // Collect data
              emgDataRef.current.push({ emg: emgDeepCopy, counter, raw });

              // Limit buffer size
              if (emgDataRef.current.length > 1000) {
                emgDataRef.current = emgDataRef.current.slice(-1000);
              }
            }
          );
          console.log("Subscribed to raw EMG");
          unsubscribeFunctions.raw = emgUnsubscribe;
        }

        // Subscribe to filtered EMG data if enabled
        if (dataStreams.subscribeToFilteredEmg) {
          console.log("Subscribing to filtered EMG...");
          const filteredEmgUnsubscribe = await myoMod.subscribeFilteredEmgData(
            (filteredEmg, counter, raw) => {
              // Create deep copy for filtered EMG data
              const filteredEmgDeepCopy: MyoModFilteredEmgData = {
                data: new Float32Array(filteredEmg.data),
                state: filteredEmg.state,
              };

              // Collect data
              filteredEmgDataRef.current.push({
                filteredEmg: filteredEmgDeepCopy,
                counter,
                raw,
              });

              // Limit buffer size
              if (filteredEmgDataRef.current.length > 1000) {
                filteredEmgDataRef.current =
                  filteredEmgDataRef.current.slice(-1000);
              }
            }
          );
          console.log("Subscribed to filtered EMG");
          unsubscribeFunctions.filtered = filteredEmgUnsubscribe;
        }
      } catch (err) {
        console.error("Error setting up subscriptions:", err);
      }
    };

    // Start setup after a small delay to ensure previous subscriptions are cleaned up
    const timerId = setTimeout(() => {
      setupSubscriptions();
    }, 10);

    // Cleanup function: call all unsubscribe functions
    return () => {
      clearTimeout(timerId);
      // Clean up existing subscriptions
      Object.keys(unsubscribeFunctions).forEach(async (key) => {
        const unsubscribe =
          unsubscribeFunctions[key as keyof typeof unsubscribeFunctions];
        if (unsubscribe) {
          console.log(`Unsubscribing from ${key}...`);
          await unsubscribe();
        }
      });
    };
  }, [myoMod, dataStreams]); // Add dataStreams to dependency array

  return null;
}
