export function SamplingControls({
  poseSamplingRate,
  setPoseSamplingRate,
  emgSamplingRate,
  setEmgSamplingRate,
  filteredEmgSamplingRate,
  setFilteredEmgSamplingRate,
  updateFramerate,
  setUpdateFramerate
}: {
  poseSamplingRate: number;
  setPoseSamplingRate: (value: number) => void;
  emgSamplingRate: number;
  setEmgSamplingRate: (value: number) => void;
  filteredEmgSamplingRate: number;
  setFilteredEmgSamplingRate: (value: number) => void;
  updateFramerate: number;
  setUpdateFramerate: (value: number) => void;
}) {
  return (
    <div style={{
      position: "absolute",
      bottom: "10px",
      right: "10px",
      background: "rgba(255,255,255,0.8)",
      padding: "10px",
      borderRadius: "5px",
      zIndex: 10,
      boxShadow: "0 0 5px rgba(0,0,0,0.2)"
    }}>
      {/* <div style={{ marginBottom: "10px" }}>
        <div style={{ fontSize: "14px", marginBottom: "5px" }}>
          Pose sampling: every {poseSamplingRate}th point
        </div>
        <input
          type="range"
          min="1"
          max="20"
          step="1"
          value={poseSamplingRate}
          onChange={(e) => setPoseSamplingRate(parseInt(e.target.value))}
          style={{ width: "200px" }}
        />
      </div>
      <div style={{ marginBottom: "10px" }}>
        <div style={{ fontSize: "14px", marginBottom: "5px" }}>
          EMG sampling: every {emgSamplingRate}th point
        </div>
        <input
          type="range"
          min="1"
          max="50"
          step="1"
          value={emgSamplingRate}
          onChange={(e) => setEmgSamplingRate(parseInt(e.target.value))}
          style={{ width: "200px" }}
        />
      </div>
      <div style={{ marginBottom: "10px" }}>
        <div style={{ fontSize: "14px", marginBottom: "5px" }}>
          Filtered EMG sampling: every {filteredEmgSamplingRate}th point
        </div>
        <input
          type="range"
          min="1"
          max="50"
          step="1"
          value={filteredEmgSamplingRate}
          onChange={(e) => setFilteredEmgSamplingRate(parseInt(e.target.value))}
          style={{ width: "200px" }}
        />
      </div> */}
      <div>
        <div style={{ fontSize: "14px", marginBottom: "5px" }}>
          Graph update rate: {updateFramerate} FPS
        </div>
        <input
          type="range"
          min="1"
          max="60"
          step="1"
          value={updateFramerate}
          onChange={(e) => setUpdateFramerate(parseInt(e.target.value))}
          style={{ width: "200px" }}
        />
      </div>
    </div>
  );
}
