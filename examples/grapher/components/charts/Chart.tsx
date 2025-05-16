import { useRef, useEffect } from "react";
import uPlot from "uplot";
import { usePoseStore } from "../../store";

export function Chart({ samplingRate }: { samplingRate: number }) {
  const { history, packetCount } = usePoseStore();
  const chartRef = useRef<HTMLDivElement>(null);
  const uPlotRef = useRef<uPlot | null>(null);
  
  // Create the chart only once when component mounts
  useEffect(() => {
    if (!chartRef.current || uPlotRef.current) return;
    
    console.log("Creating uPlot instance for pose data");
    
    // Calculate initial dimensions based on window size
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
          range: [0, 1]
        }
      },
      legend: {
        show: true,
      },
      series: [
        { label: "Time (s)",  value: (self: any, rawValue: number | null) => rawValue == null ? '0.00' : rawValue.toFixed(2), },
        { label: "thumbFlex", stroke: "red", width: 2 },
        { label: "indexFlex", stroke: "blue", width: 2 },
        { label: "middleFlex", stroke: "green", width: 2 },
        { label: "ringFlex", stroke: "orange", width: 2 },
        { label: "pinkyFlex", stroke: "purple", width: 2 },
        { label: "wristFlex", stroke: "cyan", width: 2 },
        { label: "wristRotation", stroke: "magenta", width: 2},
        { label: "counter", stroke: "black", width: 2, value: (self: any, rawValue: number | null) => rawValue == null ? '0.00' : rawValue.toFixed(2), "show": false },
      ]
    };
    
    // Initialize with empty data
    const initialData: uPlot.AlignedData = [
      [], // timestamps
      [], [], [], [], [], [], [], [], // sensor values
    ];
    
    uPlotRef.current = new uPlot(opts, initialData, chartRef.current);
    
    // Handle resize
    const handleResize = () => {
      if (uPlotRef.current && chartRef.current) {
        // Use almost full window width and a good portion of height
        const width = Math.max(window.innerWidth - 40, 600);
        const height = Math.max(Math.min(window.innerHeight * 0.3, 300), 200);
        uPlotRef.current.setSize({ width, height });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    // Cleanup only when component unmounts
    return () => {
      window.removeEventListener('resize', handleResize);
      if (uPlotRef.current) {
        uPlotRef.current.destroy();
        uPlotRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs once
  
  // Separate effect to update data when history changes
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
    
    const data: uPlot.AlignedData = [
      timestamps,
      recentHistory.map(p => p.values.thumbFlex || 0),
      recentHistory.map(p => p.values.indexFlex || 0),
      recentHistory.map(p => p.values.middleFlex || 0),
      recentHistory.map(p => p.values.ringFlex || 0),
      recentHistory.map(p => p.values.pinkyFlex || 0),
      recentHistory.map(p => p.values.wristFlex || 0),
      recentHistory.map(p => p.values.wristRotation || 0),
      recentHistory.map(p => p.values.counter || 0),
    ];
    
    // Update plot data
    uPlotRef.current.setData(data);
  }, [history, packetCount, samplingRate]); // Keep samplingRate in dependencies
  
  return (
    <div style={{ marginTop: 10, width: '100%' }}>
      <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>Hand Pose Data:</div>
      <div ref={chartRef} style={{ margin: '0 auto' }} />
    </div>
  );
}
