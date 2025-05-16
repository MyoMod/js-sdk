import { useEmgStore } from "../store";

export function DownloadButton() {
  const handleDownload = () => {
    // Prompt the user for a filename
    const userFilename = window.prompt("Enter a filename for the EMG data (without extension):", 
      `emg-data-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`);
    
    // If user cancels or enters an empty filename, abort download
    if (!userFilename || userFilename.trim() === "") return;
    
    const emgStore = useEmgStore.getState();
    
    // Convert Float32Arrays to regular arrays for JSON serialization
    const exportData = emgStore.history.map(item => ({
      timestamp: item.timestamp,
      rawCounter: item.rawCounter,
      values: {
        chnA: Array.from(item.values.chnA),
        chnB: Array.from(item.values.chnB),
        chnC: Array.from(item.values.chnC),
        chnD: Array.from(item.values.chnD),
        chnE: Array.from(item.values.chnE),
        chnF: Array.from(item.values.chnF),
      }
    }));
    
    // Create a Blob containing the JSON data
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    
    // Create a download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${userFilename.trim()}.json`;
    
    // Trigger the download
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: "absolute",
      top: "10px",
      right: "10px",
      zIndex: 10
    }}>
      <button 
        onClick={handleDownload}
        style={{
          padding: "8px 16px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "bold",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
        }}
      >
        Download EMG Data
      </button>
    </div>
  );
}
