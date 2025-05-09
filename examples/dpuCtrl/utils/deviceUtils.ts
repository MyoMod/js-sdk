export function parseDevice(deviceEntry: string): { type: string; id: string, displayName: string } | null {
  let type: string = deviceEntry.substring(1, 11);
  let id: string = deviceEntry.substring(12, 22);

  let displayName;
  switch(type.toLowerCase()) {
    case "embed' emg":
      displayName = "EMG Sensor";
      break;
    case "embed' imu":
      displayName = "IMU Sensor";
      break;
    case "embed' led":
      displayName = "LED";
      break;
    default:
      displayName = type;
  }
  
  return { type, id, displayName };
}

export function getDeviceColor(deviceType: string): string {
  const type = deviceType.toLowerCase();
  if (type.includes("emg")) return "#3388cc";
  if (type.includes("imu")) return "#33cc33";
  if (type.includes("led")) return "#cc3388";
  if (type.includes("bridge")) return "#cc6600";
  return "#888888"; // Default color
}
