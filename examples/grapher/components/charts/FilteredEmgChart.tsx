import { useRef, useEffect, useState } from "react";
import uPlot from "uplot";
import { useFilteredEmgStore } from "../../store";

export function FilteredEmgChart({ samplingRate }: { samplingRate: number }) {
  const { history, packetCount } = useFilteredEmgStore();
  const chartRef = useRef<HTMLDivElement>(null);
  const uPlotRef = useRef<uPlot | null>(null);
  // Add state for scaling mode
  const [useIndividualScaling, setUseIndividualScaling] = useState(false);
  
  // Effect to recreate chart when scaling mode changes
  useEffect(() => {
    // Destroy previous chart if it exists
    if (uPlotRef.current) {
      uPlotRef.current.destroy();
      uPlotRef.current = null;
    }
    
    if (!chartRef.current) return;
    
    console.log(`Creating uPlot instance for Filtered EMG data with ${useIndividualScaling ? 'individual' : 'common'} scaling`);
    
    const initialWidth = Math.max(window.innerWidth - 40, 600);
    const initialHeight = Math.max(Math.min(window.innerHeight * 0.3, 300), 200);
    
    const opts: uPlot.Options = {
      width: initialWidth,
      height: initialHeight,
      scales: {
        x: {
          time: false,
          range: [-10, 0],
          auto: false
        },
        // Define scales based on scaling mode
        y: { auto: true },
        ...(useIndividualScaling ? {
          y1: { auto: true },
          y2: { auto: true },
          y3: { auto: true },
          y4: { auto: true },
          y5: { auto: true },
          y6: { auto: true },
        } : {})
      },
      legend: {
        show: true,
      },
      series: [
        { label: "Time (s)", value: (self: any, rawValue: number | null) => rawValue == null ? '0.00' : rawValue.toFixed(2) },
        { label: "Channel 1", stroke: "red", width: 2, scale: useIndividualScaling ? "y1" : "y" },
        { label: "Channel 2", stroke: "blue", width: 2, scale: useIndividualScaling ? "y2" : "y" },
        { label: "Channel 3", stroke: "green", width: 2, scale: useIndividualScaling ? "y3" : "y" },
        { label: "Channel 4", stroke: "orange", width: 2, scale: useIndividualScaling ? "y4" : "y" },
        { label: "Channel 5", stroke: "purple", width: 2, scale: useIndividualScaling ? "y5" : "y" },
        { label: "Channel 6", stroke: "cyan", width: 2, scale: useIndividualScaling ? "y6" : "y" },
        { label: "State", stroke: "black", width: 2, show: false },
        { label: "Counter", stroke: "gray", width: 2, show: false },
      ],
      axes: [
        { scale: "x" }, // x-axis
        // { scale: "y" }, // common y-axis
        // ...(useIndividualScaling ? [
        //   { scale: "y1", values: (self, ticks) => ticks.map(v => v.toFixed(1)), side: 3, grid: {show: false}, show: true },
        //   { scale: "y2", values: (self, ticks) => ticks.map(v => v.toFixed(1)), side: 3, grid: {show: false}, show: true },
        //   { scale: "y3", values: (self, ticks) => ticks.map(v => v.toFixed(1)), side: 3, grid: {show: false}, show: true },
        //   { scale: "y4", values: (self, ticks) => ticks.map(v => v.toFixed(1)), side: 3, grid: {show: false}, show: true },
        //   { scale: "y5", values: (self, ticks) => ticks.map(v => v.toFixed(1)), side: 3, grid: {show: false}, show: true },
        //   { scale: "y6", values: (self, ticks) => ticks.map(v => v.toFixed(1)), side: 3, grid: {show: false}, show: true },
        // ] : [])
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
  }, [useIndividualScaling]); // Add useIndividualScaling as dependency
  
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
      <div style={{ 
        fontSize: 16, 
        fontWeight: 'bold', 
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span>Filtered EMG Data:</span>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          fontSize: 14,
          fontWeight: 'normal',
          cursor: 'pointer'
        }}>
          <input 
            type="checkbox"
            checked={useIndividualScaling}
            onChange={() => setUseIndividualScaling(prev => !prev)}
            style={{ marginRight: 8 }}
          />
          Individual Channel Scaling  
        </label>
      </div>
      <div ref={chartRef} style={{ margin: '0 auto' }} />
    </div>
  );
}
