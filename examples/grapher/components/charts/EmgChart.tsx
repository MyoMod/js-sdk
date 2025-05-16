import { useRef, useEffect } from "react";
import uPlot from "uplot";
import { useEmgStore } from "../../store";

export function EmgChart({ samplingRate }: { samplingRate: number }) {
  const { history, packetCount } = useEmgStore();
  const chartRef = useRef<HTMLDivElement>(null);
  const uPlotRef = useRef<uPlot | null>(null);
  
  useEffect(() => {
    if (!chartRef.current || uPlotRef.current) return;
    
    console.log("Creating uPlot instance for EMG data");
    
    const initialWidth = Math.max(window.innerWidth - 40, 600);
    const initialHeight = Math.max(Math.min(window.innerHeight * 0.3, 300), 200);
    
    const opts: uPlot.Options = {
      width: initialWidth,
      height: initialHeight,
      scales: {
        x: {
          time: false,
          // Set default range to show last 10 seconds of data
          range: [-10, 0],
          // Keep 0 (the present) at the right edge
          auto: false
        },
        y: {
          auto: true,
        }
      },
      legend: {
        show: true,
      },
      series: [
        { label: "Time (s)", value: (self: any, rawValue: number | null) => rawValue == null ? '0.00' : rawValue.toFixed(2) },
        { label: "Channel A", stroke: "red", width: 1 },
        { label: "Channel B", stroke: "blue", width: 1 },
        { label: "Channel C", stroke: "green", width: 1 },
        { label: "Channel D", stroke: "orange", width: 1 },
        { label: "Channel E", stroke: "purple", width: 1 },
        { label: "Channel F", stroke: "cyan", width: 1 },
        { label: "Counter", stroke: "black", width: 1, "show": false  },
      ]
    };
    
    const initialData: uPlot.AlignedData = [
      [], // timestamps
      [], [], [], [], [], [], // EMG channels
      [], // counter
    ];
    
    uPlotRef.current = new uPlot(opts, initialData, chartRef.current);
    
    const handleResize = () => {
      if (uPlotRef.current && chartRef.current) {
        const width = Math.max(window.innerWidth - 40, 600);
        const height = Math.max(Math.min(window.innerHeight * 0.3, 300), 200);
        uPlotRef.current.setSize({ width, height });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (uPlotRef.current) {
        uPlotRef.current.destroy();
        uPlotRef.current = null;
      }
    };
  }, []);
  
  useEffect(() => {
    if (!uPlotRef.current || history.length === 0 || packetCount === null) return;
    // Find the most recent timestamp
    const latestTime = history[history.length - 1].timestamp;
    
    // Filter to only show the last 10 seconds for display
    const recentHistory = history
      .filter(item => latestTime - item.timestamp < 10000)
      .filter((item) => (item.timestamp/10) % samplingRate === 0);
    
    if (recentHistory.length < 2) return;
    
    // Convert timestamps to negative seconds relative to the present (0)
    const timestamps = recentHistory.map(point => (point.timestamp - latestTime) / 1000);
    
    // Process EMG data - take the average of each channel's array
    const data: uPlot.AlignedData = [
      timestamps,
      recentHistory.map(p => p.values.chnA ? p.values.chnA[0] : 0),
      recentHistory.map(p => p.values.chnB ? p.values.chnB[0] : 0),
      recentHistory.map(p => p.values.chnC ? p.values.chnC[0] : 0),
      recentHistory.map(p => p.values.chnD ? p.values.chnD[0] : 0),
      recentHistory.map(p => p.values.chnE ? p.values.chnE[0] : 0),
      recentHistory.map(p => p.values.chnF ? p.values.chnF[0] : 0),
      recentHistory.map(p => p.rawCounter || 0),
    ];
    
    uPlotRef.current.setData(data);
  }, [history, packetCount, samplingRate]);
  
  return (
    <div style={{ marginTop: 10, width: '100%' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>EMG Data:</div>
      <div ref={chartRef} style={{ margin: '0 auto' }} />
    </div>
  );
}
