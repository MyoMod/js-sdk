export async function loadMyoMod(
  autoConnect: boolean = false
): Promise<MyoMod | null> {
  if (!navigator.bluetooth) {
    throw new Error("Bluetooth not supported");
  }

  let device;
  try {
    if (autoConnect) {
      // Try to get available devices using getAvailableDevices API (if available)
      if ("getDevices" in navigator.bluetooth) {
        const devices = await navigator.bluetooth.getDevices();
        const myoModDevices = devices.filter((d) =>
          d.name?.startsWith("MyoMod")
        );

        // If exactly one MyoMod device is available, connect to it automatically
        if (myoModDevices.length === 1) {
          device = myoModDevices[0];
          console.log("Auto-connecting to device:", device.name);
        } else if (myoModDevices.length > 1) {
          console.log(
            "Multiple MyoMod devices found, falling back to manual selection"
          );
        } else {
          console.log(
            "No MyoMod devices found, falling back to manual selection"
          );
        }
      } else {
        console.log(
          "getAvailableDevices not supported, falling back to manual selection"
        );
      }
    }

    // If autoConnect is false or no device was found automatically, use the requestDevice method
    if (!device) {
      device = await navigator.bluetooth.requestDevice({
        filters: [
          {
            namePrefix: "MyoMod",
          },
        ],
        optionalServices: ["f1f1d764-f9dc-4274-9f59-325fea6d631b"],
      });
    }
  } catch (err) {
    console.error("Error requesting Bluetooth device:", err);
    return null;
  }

  if (!device.gatt) {
    console.error("Bluetooth device does not support GATT");
    throw new Error("Device does not support GATT");
  }

  await device.gatt.connect();
  const service = await device.gatt.getPrimaryService(
    "f1f1d764-f9dc-4274-9f59-325fea6d631b"
  );
  const [
    handPoseCharacteristic,
    emgDataCharacteristic,
    filteredEmgCharacteristic,
    asyncCtrlCharacteristic,
  ] = await Promise.all([
    service.getCharacteristic("5782a59c-fca9-4213-909f-0f88517c8fae"),
    service.getCharacteristic("9c54ed76-847e-4d51-84be-7cf02794de53"),
    service.getCharacteristic("36845417-f01b-4167-afa1-81b322238fe1"),
    service.getCharacteristic("5f2d5b5b-2166-4d71-9b4a-ea719ce9777e"),
  ]);

  return new MyoMod(
    device,
    handPoseCharacteristic,
    emgDataCharacteristic,
    filteredEmgCharacteristic,
    asyncCtrlCharacteristic
  );
}

export type MyoModHandPose = {
  thumbFlex: number;
  thumbOposition: number;
  indexFlex: number;
  middleFlex: number;
  ringFlex: number;
  pinkyFlex: number;
  wristFlex: number;
  wristRotation: number;
  counter: number;
};

export type MyoModEmgData = {
  chnA: Float32Array;
  chnB: Float32Array;
  chnC: Float32Array;
  chnD: Float32Array;
  chnE: Float32Array;
  chnF: Float32Array;
};

export type MyoModFilteredEmgData = {
  data: Float32Array;
  state: number;
};

// CRC32 utility for the DPU Control Protocol
function crc32(str: string): string {
  const polynomial = 0x04c11db7;
  let crc = 0xffffffff;

  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 24;
    for (let j = 0; j < 8; j++) {
      crc = (crc << 1) ^ (crc < 0 ? polynomial : 0);
    }
  }

  return (crc >>> 0).toString(16).padStart(8, "0");
}

// Function to decode base64 JSON data
const decodeBase64Json = (base64String: string): string | null => {
  try {
    // Decode base64 to string
    return atob(base64String);
  } catch (err) {
    console.error("Failed to decode base64 JSON:", err);
    return null;
  }
};

// DPU Control Protocol response status codes
export enum DPUControlStatus {
  SUCCESS = 0x00,
  WRONG_CHECKSUM = 0x01,
  FORBIDDEN_MODE = 0x02,
  UNKNOWN_COMMAND = 0x03,
}

// DPU Control Protocol implementation
export class DPUControlProtocol {
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder("utf-8");
  private responsePromise: Promise<string> | null = null;
  private resolveResponse: ((value: string) => void) | null = null;
  private rejectResponse: ((reason: any) => void) | null = null;

  constructor(
    private readonly characteristic: BluetoothRemoteGATTCharacteristic
  ) {
    this.setupNotifications();
  }

  private async setupNotifications(): Promise<void> {
    await this.characteristic.startNotifications();
    this.characteristic.addEventListener(
      "characteristicvaluechanged",
      this.handleResponse.bind(this)
    );
  }

  private handleResponse(event: Event): void {
    const { value } = event.target as unknown as { value: DataView };
    const response = this.decoder.decode(value);

    if (this.resolveResponse) {
      this.resolveResponse(response);
      this.resolveResponse = null;
      this.rejectResponse = null;
    }
  }

  private async sendCommand(command: string): Promise<string> {
    if (this.responsePromise) {
      throw new Error("A command is already in progress");
    }

    this.responsePromise = new Promise<string>((resolve, reject) => {
      this.resolveResponse = resolve;
      this.rejectResponse = reject;

      setTimeout(() => {
        if (this.rejectResponse) {
          this.rejectResponse(new Error("Command timed out"));
          this.resolveResponse = null;
          this.rejectResponse = null;
          this.responsePromise = null;
        }
      }, 5000);
    });

    const data = this.encoder.encode(command);
    await this.characteristic.writeValue(data);

    const response = await this.responsePromise;
    this.responsePromise = null;
    return response;
  }

  private async executeCommand(
    commandPrefix: string,
    data: string = ""
  ): Promise<[number, string]> {
    // Create command with placeholder checksum (no validation)
    const commandWithoutCrc = `${commandPrefix}${data ? " " + data : ""}`;
    const fullCommand = `${commandWithoutCrc}`;

    console.log(`"${fullCommand}"`);

    const response = await this.sendCommand(fullCommand);

    console.log(`-> "${response}"`);

    const responseRegex = new RegExp(
      `^\\${commandPrefix} ([0-9a-f]{2}) ?([^\\s].*?)?$`
    );
    const match = response.match(responseRegex);

    console.log(match);

    if (!match) {
      throw new Error(`Invalid response format: ${response}`);
    }

    const statusCode = parseInt(match[1], 16);
    const responseData = match[2] || "";

    return [statusCode, responseData];
  }

  async getVersion(): Promise<string> {
    const [status, data] = await this.executeCommand("$v");
    if (status !== DPUControlStatus.SUCCESS) {
      throw new Error(`Get version failed with status: ${status.toString(16)}`);
    }
    return data;
  }

  async getRealTimeMode(): Promise<number> {
    const [status, data] = await this.executeCommand("$m");
    if (status !== DPUControlStatus.SUCCESS) {
      throw new Error(
        `Get real-time mode failed with status: ${status.toString(16)}`
      );
    }
    return parseInt(data);
  }

  async setRealTimeMode(mode: 0 | 1): Promise<void> {
    const [status] = await this.executeCommand("$M", mode.toString());
    if (status !== DPUControlStatus.SUCCESS) {
      if (status === 0x10) {
        throw new Error("Invalid mode");
      }
      throw new Error(
        `Set real-time mode failed with status: ${status.toString(16)}`
      );
    }
  }

  async getActiveConfigIndex(): Promise<number> {
    const [status, data] = await this.executeCommand("$i");
    if (status !== DPUControlStatus.SUCCESS) {
      throw new Error(
        `Get active config index failed with status: ${status.toString(16)}`
      );
    }
    return parseInt(data);
  }

  async setActiveConfigIndex(index: number): Promise<void> {
    const [status] = await this.executeCommand("$I", index.toString());
    if (status !== DPUControlStatus.SUCCESS) {
      if (status === 0x10) {
        throw new Error(
          "Configuration not available or required devices not connected"
        );
      }
      throw new Error(
        `Set active config index failed with status: ${status.toString(16)}`
      );
    }
  }

  async getConfigurationsChunk(
    chunkIndex: number
  ): Promise<{ chunksCount: number; jsonData: string }> {
    const [status, data] = await this.executeCommand(
      "$c",
      chunkIndex.toString()
    );
    if (status !== DPUControlStatus.SUCCESS) {
      if (status === 0x10) {
        throw new Error("ChunkIndex not parseable");
      } else if (status === 0x11) {
        throw new Error("ChunkIndex out of range");
      }
      throw new Error(
        `Get configurations chunk failed with status: ${status.toString(16)}`
      );
    }

    const parts = data.split(" ");
    const base64Json = parts[1];
    const jsonChunkString = decodeBase64Json(base64Json);
    if (jsonChunkString === null) {
      throw new Error("Failed to decode base64 JSON data");
    }
    return {
      chunksCount: parseInt(parts[0]),
      jsonData: jsonChunkString || "",
    };
  }

  async setConfigurationsChunk(
    chunkIndex: number,
    jsonData: string
  ): Promise<void> {
    const [status] = await this.executeCommand(
      "$C",
      `${chunkIndex} ${jsonData}`
    );
    if (status !== DPUControlStatus.SUCCESS) {
      if (status === 0x10) {
        throw new Error("ChunkIndex not parseable");
      } else if (status === 0x11) {
        throw new Error("ChunkIndex out of range");
      } else if (status === 0x12) {
        throw new Error("Chunk not cleared beforehand");
      } else if (status === 0x13) {
        throw new Error("Flash access error");
      }
      throw new Error(
        `Set configurations chunk failed with status: ${status.toString(16)}`
      );
    }
  }

  async reloadConfigurations(): Promise<void> {
    const [status] = await this.executeCommand("$R");
    if (status !== DPUControlStatus.SUCCESS) {
      if (status === 0x10) {
        throw new Error("Configuration file is invalid");
      }
      throw new Error(
        `Reload configurations failed with status: ${status.toString(16)}`
      );
    }
  }

  async getConfigurationsChecksum(): Promise<string> {
    const [status, data] = await this.executeCommand("$cc");
    if (status !== DPUControlStatus.SUCCESS) {
      throw new Error(
        `Get configurations checksum failed with status: ${status.toString(16)}`
      );
    }
    return data;
  }

  async getFirmwareChecksum(): Promise<string> {
    const [status, data] = await this.executeCommand("$fc");
    if (status !== DPUControlStatus.SUCCESS) {
      throw new Error(
        `Get firmware checksum failed with status: ${status.toString(16)}`
      );
    }
    return data;
  }

  async getBatteryState(): Promise<{ capacity: number; charging: boolean }> {
    const [status, data] = await this.executeCommand("$b");
    if (status !== DPUControlStatus.SUCCESS) {
      throw new Error(
        `Get battery state failed with status: ${status.toString(16)}`
      );
    }

    const [capacityStr, chargingStr] = data.split(" ");
    return {
      capacity: parseInt(capacityStr),
      charging: chargingStr === "1",
    };
  }

  async getFirmwareVersion(): Promise<string> {
    const [status, data] = await this.executeCommand("$fv");
    if (status !== DPUControlStatus.SUCCESS) {
      throw new Error(
        `Get firmware version failed with status: ${status.toString(16)}`
      );
    }
    return data;
  }

  async listConnectedDevices(
    deviceIndex: number
  ): Promise<{ devicesCount: number; jsonData: string; devicesHash: string }> {
    const [status, data] = await this.executeCommand(
      "$d",
      deviceIndex.toString()
    );
    if (status !== DPUControlStatus.SUCCESS) {
      if (status === 0x10) {
        throw new Error("DeviceIndex not parseable");
      } else if (status === 0x11) {
        throw new Error("DeviceIndex out of range");
      }
      throw new Error(
        `List connected devices failed with status: ${status.toString(16)}`
      );
    }

    const parts = data.split(" ");
    const devicesDescription = decodeBase64Json(parts[2]);

    return {
      devicesCount: parseInt(parts[0]),
      jsonData: devicesDescription || "",
      devicesHash: parts[1],
    };
  }

  async destroy(): Promise<void> {
    await this.characteristic.stopNotifications();
    this.characteristic.removeEventListener(
      "characteristicvaluechanged",
      this.handleResponse.bind(this)
    );
  }
}

export class MyoMod {
  private poseHelper: Partial<MyoModHandPose> = {};
  private oldCounters: {
    pose: number;
    rawEmg: number;
    filteredEmg: number;
  } = {
    pose: -1,
    rawEmg: -1,
    filteredEmg: -1,
  };
  private _dpuControl: DPUControlProtocol | null = null;

  constructor(
    private readonly device: BluetoothDevice,
    private readonly handPoseCharacteristic: BluetoothRemoteGATTCharacteristic,
    private readonly emgDataCharacteristic: BluetoothRemoteGATTCharacteristic,
    private readonly filteredEmgCharacteristic: BluetoothRemoteGATTCharacteristic,
    private readonly asyncCtrlCharacteristic: BluetoothRemoteGATTCharacteristic
  ) {}

  get dpuControl(): DPUControlProtocol {
    if (!this._dpuControl) {
      this._dpuControl = new DPUControlProtocol(this.asyncCtrlCharacteristic);
    }
    return this._dpuControl;
  }

  checkCounter(counter: number, oldCounter: number, name: string): void {
    if (counter != (oldCounter + 1) % 256 && oldCounter != -1) {
      console.warn(
        `MyoMod: ${name} counter mismatch! Expected ${
          (oldCounter + 1) % 256
        } but got ${counter}`
      );
    }
  }

  async subscribeCharacteristic(
    characteristic: BluetoothRemoteGATTCharacteristic,
    callback: (e: Event) => void,
    name: string
  ): Promise<() => void> {
    characteristic.addEventListener("characteristicvaluechanged", callback);

    return characteristic
      .startNotifications()
      .then(() => {
        return () => {
          console.log(`MyoMod: Stopping notifications for ${name}...`);
          characteristic.stopNotifications().then(() => {
            console.log(`MyoMod: Stopped notifications for ${name}`);
            characteristic.removeEventListener(
              "characteristicvaluechanged",
              callback
            );
          });
        };
      })
      .catch((error) => {
        console.error("Error starting notifications for Hand Pose:", error);
        throw error;
      });
  }

  subscribeHandPose(
    callback: (data: Readonly<MyoModHandPose>, raw: DataView) => void
  ): Promise<() => void> {
    const listener = (e: Event) => {
      const { value } = e.target as unknown as { value: DataView };
      this.poseHelper.thumbFlex = value.getUint8(0) / 255;
      this.poseHelper.thumbOposition = value.getUint8(1) / 255;
      this.poseHelper.indexFlex = value.getUint8(2) / 255;
      this.poseHelper.middleFlex = value.getUint8(3) / 255;
      this.poseHelper.ringFlex = value.getUint8(4) / 255;
      this.poseHelper.pinkyFlex = value.getUint8(5) / 255;
      this.poseHelper.wristFlex = value.getUint8(6) / 255;
      this.poseHelper.wristRotation = value.getUint8(7) / 255;
      const valueCounter = value.getUint8(8);
      this.poseHelper.counter = valueCounter / 255;

      // Check if the counter is correct
      if (this.oldCounters.pose != -1) {
        this.checkCounter(valueCounter, this.oldCounters.pose, "Hand Pose");
      }
      this.oldCounters.pose = valueCounter;

      callback(this.poseHelper as Readonly<MyoModHandPose>, value);
    };
    return this.subscribeCharacteristic(
      this.handPoseCharacteristic,
      listener,
      "Hand Pose"
    );
  }

  subscribeEmgData(
    callback: (
      data: Readonly<MyoModEmgData>,
      counter: number,
      raw: DataView
    ) => void
  ): Promise<() => void> {
    const emgHelper: MyoModEmgData = {
      chnA: new Float32Array(15),
      chnB: new Float32Array(15),
      chnC: new Float32Array(15),
      chnD: new Float32Array(15),
      chnE: new Float32Array(15),
      chnF: new Float32Array(15),
    };

    const listener = (e: Event) => {
      const { value } = e.target as unknown as { value: DataView };

      // The last byte is a one-byte counter
      const counter = value.getUint8(value.byteLength - 1);

      const dataSize = 15;
      const numChannels = 6;

      for (let ch = 0; ch < numChannels; ch++) {
        const channelArray =
          ch === 0
            ? emgHelper.chnA
            : ch === 1
            ? emgHelper.chnB
            : ch === 2
            ? emgHelper.chnC
            : ch === 3
            ? emgHelper.chnD
            : ch === 4
            ? emgHelper.chnE
            : emgHelper.chnF;

        for (let i = 0; i < dataSize; i++) {
          const byteOffset = (ch * dataSize + i) * 4;
          channelArray[i] = value.getFloat32(byteOffset, true);
        }
      }

      // Check if the counter is correct
      if (this.oldCounters.rawEmg != -1) {
        this.checkCounter(counter, this.oldCounters.rawEmg, "Raw EMG");
      }
      this.oldCounters.rawEmg = counter;

      callback(emgHelper as Readonly<MyoModEmgData>, counter, value);
    };

    return this.subscribeCharacteristic(
      this.emgDataCharacteristic,
      listener,
      "Raw EMG"
    );
  }

  subscribeFilteredEmgData(
    callback: (
      data: Readonly<MyoModFilteredEmgData>,
      counter: number,
      raw: DataView
    ) => void
  ): Promise<() => void> {
    const emgHelper: MyoModFilteredEmgData = {
      data: new Float32Array(6),
      state: 0,
    };

    const listener = (e: Event) => {
      const { value } = e.target as unknown as { value: DataView };

      const counter = value.getUint8(value.byteLength - 1);

      const numChannels = 6;

      for (let i = 0; i < numChannels; i++) {
        const byteOffset = i * 4;
        emgHelper.data[i] = value.getFloat32(byteOffset, true);
      }
      emgHelper.state = value.getFloat32(4 * 6, true);

      // Check if the counter is correct
      if (this.oldCounters.filteredEmg != -1) {
        this.checkCounter(
          counter,
          this.oldCounters.filteredEmg,
          "Filtered EMG"
        );
      }
      this.oldCounters.filteredEmg = counter;

      callback(emgHelper as Readonly<MyoModFilteredEmgData>, counter, value);
    };

    return this.subscribeCharacteristic(
      this.filteredEmgCharacteristic,
      listener,
      "Filtered EMG"
    );
  }

  destroy(): void {
    if (this._dpuControl) {
      this._dpuControl.destroy();
      this._dpuControl = null;
    }
    this.device.gatt?.disconnect();
  }
}
