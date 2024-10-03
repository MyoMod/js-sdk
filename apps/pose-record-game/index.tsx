import { createRoot } from "react-dom/client";
import { StrictMode, Suspense, useEffect, useRef, useState } from "react";
import { loadMyoMod } from "@myomod/three";
import { suspend } from "suspend-react";
import "./index.css";
import PocketBase from "pocketbase";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export const pb = new PocketBase("https://db.cloud.myomod.org");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

function App() {
  const [analogAmplification, setAnalogAmplification] = useState<
    number | undefined
  >(undefined);
  const ref = useRef<HTMLInputElement>(null);
  if (analogAmplification == null) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "white",
          color: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          fontSize: 20,
        }}
      >
        <input style={{ fontSize: 20, padding: "6px 12px"}} type="number" placeholder="Analog Amplification" ref={ref} />
        <button
          style={{
            backgroundColor: "#4CAF50",
            border: "none",
            color: "white",
            padding: "10px 20px",
            textAlign: "center",
            textDecoration: "none",
            display: "inline-block",
            fontSize: "16px",
            margin: "4px 2px",
            cursor: "pointer",
            borderRadius: "5px",
          }}
          onClick={() => {
            if (ref.current == null || isNaN(ref.current.valueAsNumber)) {
              return;
            }
            setAnalogAmplification(ref.current.valueAsNumber);
          }}
        >
          Start
        </button>
      </div>
    );
  }
  return (
    <Suspense fallback={<Connecting />}>
      <Connected analogAmplification={analogAmplification} />
    </Suspense>
  );
}

const loadMyoModSymbol = Symbol("loadMyoMod");

const recordingTimeInSeconds = 5;

const colors = ["red", "green", "blue", "black", "pink", "brown"];

const maxUint32 = Math.pow(2, 32) - 1;

function Connected({ analogAmplification }: { analogAmplification: number }) {
  const myoMod = suspend(loadMyoMod, [loadMyoModSymbol]);
  const [state, setState] = useState<
    | { type: "recording" | "uploading" }
    | { type: "finished"; data: Array<any> }
    | { type: "error"; message: string }
  >({ type: "recording" });
  useEffect(() => {
    if (state.type != "recording") {
      return;
    }
    //each data entry has 32 floats (128 byte)
    const dataList: Array<Readonly<Uint32Array | Float32Array>> = [];
    const startTime = performance.now();
    const addData = (data: Uint32Array) => {
      dataList.push(new Float32Array([performance.now() - startTime]));
      dataList.push(data);
    };
    const unsubscribe = myoMod.subscribeRawData(addData);
    const ref = setTimeout(() => {
      unsubscribe();
      const length = dataList.length;
      if (length === 0) {
        setState({ type: "error", message: "No data was recorded" });
        return;
      }
      setState({ type: "uploading" });
      const formData = new FormData();
      formData.append("data", new Blob(dataList));
      formData.append("analog_amplification", analogAmplification.toString());
      pb.collection("pose_recordings")
        .create(formData)
        .then(() =>
          setState({
            type: "finished",
            data: new Array(dataList.length / 2)
              .fill(undefined)
              .map((_, i) => ({
                time: dataList[i * 2][0],
                channel0: dataList[i * 2 + 1][0] / maxUint32,
                channel1: dataList[i * 2 + 1][1] / maxUint32,
                channel2: dataList[i * 2 + 1][2] / maxUint32,
                channel3: dataList[i * 2 + 1][3] / maxUint32,
                channel4: dataList[i * 2 + 1][4] / maxUint32,
                channel5: dataList[i * 2 + 1][5] / maxUint32,
              })),
          })
        )
        .catch((e) =>
          setState({
            type: "error",
            message: `During uploading: "${e.message}"`,
          })
        );
    }, recordingTimeInSeconds * 1000);
    return () => {
      clearTimeout(ref);
      unsubscribe();
    };
  }, [state, myoMod]);

  if (state.type === "recording") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "white",
          color: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          fontSize: 20,
        }}
      >
        Recording for {recordingTimeInSeconds} Seconds ...
      </div>
    );
  }

  if (state.type === "error") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "white",
          color: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          fontSize: 20,
        }}
      >
        Error Occured: {state.message}
        <button
          style={{
            backgroundColor: "#4CAF50",
            border: "none",
            color: "white",
            padding: "10px 20px",
            textAlign: "center",
            textDecoration: "none",
            display: "inline-block",
            fontSize: "16px",
            margin: "4px 2px",
            cursor: "pointer",
            borderRadius: "5px",
          }}
          onClick={() => setState({ type: "recording" })}
        >
          Restart
        </button>
      </div>
    );
  }

  if (state.type === "uploading") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "white",
          color: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
        }}
      >
        Uploading Data ...
      </div>
    );
  }

  if (state.type === "finished") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "white",
          color: "black",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          fontSize: 20,
        }}
      >
        Successfully Finished Recording !
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={state.data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickFormatter={formatXAxis}
              type="number"
              domain={[
                0,
                Math.ceil(Math.max(...state.data.map((e) => e.time))),
              ]}
            />
            <Tooltip labelFormatter={(label) => `Time: ${label}ms`} />
            <YAxis />
            <Legend />
            {new Array(6).fill(undefined).map((_, index) => (
              <Line
                key={index}
                type="linear"
                dataKey={`channel${index}`}
                stroke={colors[index]}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <button
          style={{
            backgroundColor: "#4CAF50",
            border: "none",
            color: "white",
            padding: "10px 20px",
            textAlign: "center",
            textDecoration: "none",
            display: "inline-block",
            fontSize: "16px",
            margin: "4px 2px",
            cursor: "pointer",
            borderRadius: "5px",
          }}
          onClick={() => setState({ type: "recording" })}
        >
          Restart
        </button>
      </div>
    );
  }
}

const formatXAxis = (tickItem: number) => {
  return `${tickItem}ms`;
};

function Connecting() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "white",
        color: "black",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
      }}
    >
      Connecting to MyoMod
    </div>
  );
}
