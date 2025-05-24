import { useEffect, useState } from "react";
import { suspend } from "suspend-react";
import { loadMyoMod } from "@myomod/three";
import "uplot/dist/uPlot.min.css";
import { EmgGrapher } from "./EmgGrapher";
import { DpuControlApp } from "./DpuControlApp";

const loadMyoModSymbol = Symbol("loadMyoMod");

export function Connected() {
  const myoMod = suspend(() => loadMyoMod(false), [loadMyoModSymbol]);
  if (myoMod === null) {
    return <div className="fullscreen-container">Failed to load MyoMod</div>;
  }
  const [activeView, setActiveView] = useState<"emgGrapher" | "dpuControl">(
    "emgGrapher"
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Toggle fullscreen function
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      // Enter fullscreen
      document.documentElement
        .requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
        })
        .catch((err) => {
          console.error(
            `Error attempting to enable fullscreen: ${err.message}`
          );
        });
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document
          .exitFullscreen()
          .then(() => {
            setIsFullscreen(false);
          })
          .catch((err) => {
            console.error(
              `Error attempting to exit fullscreen: ${err.message}`
            );
          });
      }
    }
  };

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <>
      {/* View toggle buttons */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          display: "flex",
          gap: "10px",
          backgroundColor: "rgba(255, 255, 255, 0.7)",
          padding: "5px 10px",
          borderRadius: "5px",
          boxShadow: "0 2px 5px rgba(0, 0, 0, 0.1)",
        }}
      >
        <button
          onClick={() => setActiveView("dpuControl")}
          style={{
            padding: "8px 16px",
            backgroundColor:
              activeView === "dpuControl" ? "#4CAF50" : "#e0e0e0",
            color: activeView === "dpuControl" ? "white" : "black",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: activeView === "dpuControl" ? "bold" : "normal",
            transition: "all 0.2s ease",
          }}
        >
          DPU Control
        </button>
        <button
          onClick={() => setActiveView("emgGrapher")}
          style={{
            padding: "8px 16px",
            backgroundColor:
              activeView === "emgGrapher" ? "#4CAF50" : "#e0e0e0",
            color: activeView === "emgGrapher" ? "white" : "black",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: activeView === "emgGrapher" ? "bold" : "normal",
            transition: "all 0.2s ease",
          }}
        >
          EMG Grapher
        </button>

        {/* Fullscreen toggle button */}
        <button
          onClick={toggleFullscreen}
          style={{
            padding: "8px 16px",
            backgroundColor: isFullscreen ? "#ff9800" : "#e0e0e0",
            color: isFullscreen ? "white" : "black",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginLeft: "5px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
          }}
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>
      </div>

      {/* Render active component based on selection */}
      {activeView === "emgGrapher" ? (
        <EmgGrapher myoMod={myoMod} />
      ) : (
        <DpuControlApp myoMod={myoMod} />
      )}
    </>
  );
}
