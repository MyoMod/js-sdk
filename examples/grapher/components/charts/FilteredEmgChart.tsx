import { useRef, useEffect } from "react";
import uPlot from "uplot";
import { useFilteredEmgStore } from "../../store";

export function FilteredEmgChart({ samplingRate }: { samplingRate: number }) {
  const { history, packetCount } = useFilteredEmgStore();
  const chartRef = useRef<HTMLDivElement>(null);
  const uPlotRef = useRef<uPlot | null>(null);
  
  useEffect(() => {
    if (!chartRef.current || uPlotRef.current) return;
    
    console.log("Creating uPlot instance for Filtered EMG data");
    
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
        { label: "Channel 1", stroke: "red", width: 2 },
        { label: "Channel 2", stroke: "blue", width: 2 },
        { label: "Channel 3", stroke: "green", width: 2 },
        { label: "Channel 4", stroke: "orange", width: 2 },
        { label: "Channel 5", stroke: "purple", width: 2 },
        { label: "Channel 6", stroke: "cyan", width: 2 },
        { label: "State", stroke: "black", width: 2, show: false },
        { label: "Counter", stroke: "gray", width: 2, show: false },
      ]
    };
    
    const initialData: uPlot.AlignedData = [
      [], // timestamps
      [], [], [], [], [], [], // EMG channels
      [], // state
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
    
    // Process filtered EMG data
    const data: uPlot.AlignedData = [
      timestamps,
      recentHistory.map(p => p.values[0] || 0),
      recentHistory.map(p => p.values[1] || 0),
      recentHistory.map(p => p.values[2] || 0),
      recentHistory.map(p => p.values[3] || 0),
      recentHistory.map(p => p.values[4] || 0),
      recentHistory.map(p => p.values[5] || 0),
      recentHistory.map(p => p.state || 0),
      recentHistory.map(p => p.rawCounter || 0),
    ];
    
    uPlotRef.current.setData(data);
  }, [history, packetCount, samplingRate]);
  
  return (
    <div style={{ marginTop: 10, width: '100%' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>Filtered EMG Data:</div>
      <div ref={chartRef} style={{ margin: '0 auto' }} />
    </div>
  );
}
