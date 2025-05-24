import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { suspend } from "suspend-react";
import {
  loadMyoMod,
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
import { MyoMod } from "@myomod/three";
import "uplot/dist/uPlot.min.css";

import { loadMyoModSymbol, useBatteryStore } from "../store";
import { EmgChart, FilteredEmgChart } from "./charts";
import { DownloadButton } from "./DownloadButton";
import { BatteryStatusDisplay } from "./BatteryStatusDisplay";
import { SamplingControls } from "./SamplingControls";

// Define interface for data stream subscription controls
interface DataStreamControls {
  subscribeToHandPose?: boolean;
  subscribeToRawEmg?: boolean;
  subscribeToFilteredEmg?: boolean;
}

interface EmgGrapherProps {
  myoMod: MyoMod;
}

export function EmgGrapher({ myoMod }: EmgGrapherProps) {
  // Create sampling rate states at app level to share them
  const [poseSamplingRate, setPoseSamplingRate] = useState(5);
  const [emgSamplingRate, setEmgSamplingRate] = useState(1);
  const [filteredEmgSamplingRate, setFilteredEmgSamplingRate] = useState(1);
  // Replace batch size with framerate controls
  const [updateFramerate, setUpdateFramerate] = useState(30);

  // Add state for diagram visibility
  const [dataStreams, setDataStreams] = useState<DataStreamControls>(() => {
    // Simple check for mobile device
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    // Show raw emg for desktop only
    return {
      subscribeToHandPose: false,
      subscribeToRawEmg: !isMobile,
      subscribeToFilteredEmg: true,
    };
  });

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

  // Add battery state polling effect
  useEffect(() => {
    const pollBatteryState = async () => {
      try {
        const batteryState = await myoMod.dpuControl.getBatteryState();
        useBatteryStore.setState({
          batteryState,
          updateTime: Date.now(),
        });
      } catch (err) {
        console.error("Error fetching battery state:", err);
      }
    };

    // Poll initially
    pollBatteryState();

    // Then poll every minute
    const interval = setInterval(pollBatteryState, 60000);

    return () => clearInterval(interval);
  }, [myoMod]);

  // Function to manually refresh battery state
  const refreshBatteryState = async () => {
    try {
      const batteryState = await myoMod.dpuControl.getBatteryState();
      useBatteryStore.setState({
        batteryState,
        updateTime: Date.now(),
      });
    } catch (err) {
      console.error("Error fetching battery state:", err);
    }
  };

  // Function to process and update all data at a specific framerate
  const processAllData = (timestamp: number) => {
    // Calculate time since last update
    const frameInterval = 1000 / updateFramerate;
    const elapsed = timestamp - lastUpdateRef.current;

    // Only update if enough time has passed for the desired framerate
    if (elapsed >= frameInterval) {
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

  // Subscribe to EMG data
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

  return (
    <>
      {/* Chart Visibility Toggles - Moved to top row next to download button */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "200px", // Position to the left of download button
          zIndex: 10,
          display: "flex",
          flexDirection: "row", // Changed to row layout
          alignItems: "center",
          gap: "12px",
          background: "rgba(255,255,255,0.8)",
          padding: "2px 10px",
          borderRadius: "5px",
          boxShadow: "0 0 5px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: "bold" }}>
          Toggle Charts:
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          <input
            type="checkbox"
            checked={dataStreams.subscribeToFilteredEmg}
            onChange={() =>
              setDataStreams((prev) => ({
                ...prev,
                subscribeToFilteredEmg: !prev.subscribeToFilteredEmg,
              }))
            }
            style={{ marginRight: "8px" }}
          />
          <span>Filtered EMG</span>
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          <input
            type="checkbox"
            checked={dataStreams.subscribeToRawEmg}
            onChange={() =>
              setDataStreams((prev) => ({
                ...prev,
                subscribeToRawEmg: !prev.subscribeToRawEmg,
              }))
            }
            style={{ marginRight: "8px" }}
          />
          <span>Raw EMG</span>
        </label>
      </div>

      <div
        style={{
          position: "absolute",
          width: "100%",
          top: "5%",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Only show charts if their visibility is toggled on */}
        {dataStreams.subscribeToFilteredEmg && (
          <FilteredEmgChart samplingRate={filteredEmgSamplingRate} />
        )}
        {dataStreams.subscribeToRawEmg && (
          <EmgChart samplingRate={emgSamplingRate} />
        )}
      </div>
      <SamplingControls
        poseSamplingRate={poseSamplingRate}
        setPoseSamplingRate={setPoseSamplingRate}
        emgSamplingRate={emgSamplingRate}
        setEmgSamplingRate={setEmgSamplingRate}
        filteredEmgSamplingRate={filteredEmgSamplingRate}
        setFilteredEmgSamplingRate={setFilteredEmgSamplingRate}
        updateFramerate={updateFramerate}
        setUpdateFramerate={setUpdateFramerate}
      />
      <DownloadButton />
      <BatteryStatusDisplay onRefresh={refreshBatteryState} />
    </>
  );
}
