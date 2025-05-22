import { createRoot } from "react-dom/client";
import { StrictMode, Suspense, useEffect, useState } from "react";
import React from "react";
import "./index.css";
import { loadMyoMod } from "./myomod";
import { suspend } from "suspend-react";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Define interface for data stream subscription controls
interface DataStreamControls {
  subscribeToHandPose?: boolean;
  subscribeToRawEmg?: boolean;
  subscribeToFilteredEmg?: boolean;
}

function App() {
  const [hasInteracted, setHasInteracted] = useState(false);

  if (!hasInteracted) {
    return (
      <div
        onClick={() => setHasInteracted(true)}
        className="fullscreen-container interactive"
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

function Connecting() {
  return <div className="fullscreen-container">Connecting...</div>;
}

const loadMyoModSymbol = Symbol("loadMyoMod");

function Connected() {
  const myoMod = suspend(() => loadMyoMod(), [loadMyoModSymbol]);
  const [dataStreams, setDataStreams] = useState<DataStreamControls>({
    subscribeToHandPose: false,
    subscribeToRawEmg: true,
    subscribeToFilteredEmg: false,
  });
  // Keep counters in state for initial render, but updates will bypass React
  const [counters, setCounters] = useState({
    handPose: 0,
    rawEmg: 0,
    filteredEmg: 0,
  });
  const [subscriptionStatus, setSubscriptionStatus] = useState({
    isSubscribing: false,
    error: null as string | null,
  });

  // Create refs to hold references to DOM elements
  const handPoseCounterRef = React.useRef<HTMLDivElement>(null);
  const rawEmgCounterRef = React.useRef<HTMLDivElement>(null);
  const filteredEmgCounterRef = React.useRef<HTMLDivElement>(null);

  // Manage subscriptions with a delay between unsubscribe and subscribe
  useEffect(() => {
    // Flag that we're in the process of subscribing
    setSubscriptionStatus((prev) => ({
      ...prev,
      isSubscribing: true,
      error: null,
    }));

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
              // Direct DOM manipulation instead of React state
              if (handPoseCounterRef.current) {
                handPoseCounterRef.current.textContent =
                  pose.counter.toPrecision(2);
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
              // Direct DOM manipulation instead of React state
              if (rawEmgCounterRef.current) {
                rawEmgCounterRef.current.textContent = counter.toString();
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
              // Direct DOM manipulation instead of React state
              if (filteredEmgCounterRef.current) {
                filteredEmgCounterRef.current.textContent = counter.toString();
              }
            }
          );
          console.log("Subscribed to filtered EMG");
          unsubscribeFunctions.filtered = filteredEmgUnsubscribe;
        }

        // All subscriptions completed successfully
        setSubscriptionStatus({ isSubscribing: false, error: null });
      } catch (err) {
        console.error("Error setting up subscriptions:", err);
        setSubscriptionStatus({
          isSubscribing: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };

    // Start setup after a small delay to ensure previous subscriptions are cleaned up
    const timerId = setTimeout(() => {
      setupSubscriptions();
    }, 1000);

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
  }, [myoMod, dataStreams]);

  return (
    <div className="app-container">
      <h1 className="app-title">MyoMod Data Stream Tester</h1>

      <div className="controls-container">
        <div className="control-section">
          <h2>Data Stream Subscriptions</h2>
          <div className="control-options">
            <label className="control-option">
              <input
                type="checkbox"
                checked={dataStreams.subscribeToHandPose}
                onChange={(e) =>
                  setDataStreams({
                    ...dataStreams,
                    subscribeToHandPose: e.target.checked,
                  })
                }
              />
              <span>Hand Pose</span>
            </label>

            <label className="control-option">
              <input
                type="checkbox"
                checked={dataStreams.subscribeToRawEmg}
                onChange={(e) =>
                  setDataStreams({
                    ...dataStreams,
                    subscribeToRawEmg: e.target.checked,
                  })
                }
              />
              <span>Raw EMG</span>
            </label>

            <label className="control-option">
              <input
                type="checkbox"
                checked={dataStreams.subscribeToFilteredEmg}
                onChange={(e) =>
                  setDataStreams({
                    ...dataStreams,
                    subscribeToFilteredEmg: e.target.checked,
                  })
                }
              />
              <span>Filtered EMG</span>
            </label>
          </div>
        </div>

        <div className="data-section">
          <h2>Data Counters</h2>
          <div className="counter-grid">
            <div className="counter-item">
              <div className="counter-label">Hand Pose</div>
              <div className="counter-value" ref={handPoseCounterRef}>
                {counters.handPose.toPrecision(2)}
              </div>
            </div>
            <div className="counter-item">
              <div className="counter-label">Raw EMG</div>
              <div className="counter-value" ref={rawEmgCounterRef}>
                {counters.rawEmg}
              </div>
            </div>
            <div className="counter-item">
              <div className="counter-label">Filtered EMG</div>
              <div className="counter-value" ref={filteredEmgCounterRef}>
                {counters.filteredEmg}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
