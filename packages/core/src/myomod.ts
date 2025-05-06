export async function loadMyoMod(): Promise<MyoMod> {
  const device = await navigator.bluetooth.requestDevice({
    filters: [
      {
        namePrefix: "MyoMod",
      },
    ],
    optionalServices: ["f1f1d764-f9dc-4274-9f59-325fea6d631b"],
  });
  if (device.gatt == null) {
    throw new Error(``);
  }
  await device.gatt.connect();
  const service = await device.gatt.getPrimaryService(
    "f1f1d764-f9dc-4274-9f59-325fea6d631b"
  );
  const [handPoseCharacteristic, emgDataCharacteristic, filteredEmgCharacteristic, asyncCtrlCharacteristic] = await Promise.all([
    service.getCharacteristic("5782a59c-fca9-4213-909f-0f88517c8fae"),
    service.getCharacteristic("9c54ed76-847e-4d51-84be-7cf02794de53"),
    service.getCharacteristic("36845417-f01b-4167-afa1-81b322238fe1"),
    service.getCharacteristic("5f2d5b5b-2166-4d71-9b4a-ea719ce9777e"),
  ]);

  return new MyoMod(device, handPoseCharacteristic, emgDataCharacteristic, filteredEmgCharacteristic, asyncCtrlCharacteristic);
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

  return (crc >>> 0).toString(16).padStart(8, '0');
}

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
  private readonly decoder = new TextDecoder('utf-8');
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
    this.characteristic.addEventListener('characteristicvaluechanged', this.handleResponse.bind(this));
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
      throw new Error('A command is already in progress');
    }

    this.responsePromise = new Promise<string>((resolve, reject) => {
      this.resolveResponse = resolve;
      this.rejectResponse = reject;

      setTimeout(() => {
        if (this.rejectResponse) {
          this.rejectResponse(new Error('Command timed out'));
          this.resolveResponse = null;
          this.rejectResponse = null;
          this.responsePromise = null;
        }
      }, 5000);
    });

    const data = this.encoder.encode(command + '\n');
    await this.characteristic.writeValue(data);

    const response = await this.responsePromise;
    this.responsePromise = null;
    return response;
  }

  private async executeCommand(commandPrefix: string, data: string = ''): Promise<[number, string]> {
    // Create command with placeholder checksum (no validation)
    const commandWithoutCrc = `${commandPrefix}${data ? ' ' + data : ''}`;
    const fullCommand = `${commandWithoutCrc}`;

    const response = await this.sendCommand(fullCommand);
    const responseRegex = new RegExp(`^\\${commandPrefix} ([0-9a-f]{2}) ?([^\\s].*?)? \\s*$`);
    const match = response.match(responseRegex);

    if (!match) {
      throw new Error(`Invalid response format: ${response}`);
    }

    const statusCode = parseInt(match[1], 16);
    const responseData = match[2] || '';

    return [statusCode, responseData];
  }

  async getVersion(): Promise<string> {
    const [status, data] = await this.executeCommand('$v');
    if (status !== DPUControlStatus.SUCCESS) {
      throw new Error(`Get version failed with status: ${status.toString(16)}`);
    }
    return data;
  }

  async getRealTimeMode(): Promise<number> {
    const [status, data] = await this.executeCommand('$m');
    if (status !== DPUControlStatus.SUCCESS) {
      throw new Error(`Get real-time mode failed with status: ${status.toString(16)}`);
    }
    return parseInt(data);
  }

  async setRealTimeMode(mode: 0 | 1): Promise<void> {
    const [status] = await this.executeCommand('$M', mode.toString());
    if (status !== DPUControlStatus.SUCCESS) {
      if (status === 0x10) {
        throw new Error('Invalid mode');
      }
      throw new Error(`Set real-time mode failed with status: ${status.toString(16)}`);
    }
  }

  async getActiveConfigIndex(): Promise<number> {
    const [status, data] = await this.executeCommand('$i');
    if (status !== DPUControlStatus.SUCCESS) {
      throw new Error(`Get active config index failed with status: ${status.toString(16)}`);
    }
    return parseInt(data);
  }

  async setActiveConfigIndex(index: number): Promise<void> {
    const [status] = await this.executeCommand('$I', index.toString());
    if (status !== DPUControlStatus.SUCCESS) {
      if (status === 0x10) {
        throw new Error('Configuration not available or required devices not connected');
      }
      throw new Error(`Set active config index failed with status: ${status.toString(16)}`);
    }
  }

  async getConfigurationsChunk(chunkIndex: number): Promise<{chunksCount: number, jsonData: string}> {
    const [status, data] = await this.executeCommand('$c', chunkIndex.toString());
    if (status !== DPUControlStatus.SUCCESS) {
      if (status === 0x10) {
        throw new Error('ChunkIndex not parseable');
      } else if (status === 0x11) {
        throw new Error('ChunkIndex out of range');
      }
      throw new Error(`Get configurations chunk failed with status: ${status.toString(16)}`);
    }

    const parts = data.split(' ');
    return {
      chunksCount: parseInt(parts[0]),
      jsonData: parts[1] || ''
    };
  }

  async setConfigurationsChunk(chunkIndex: number, jsonData: string): Promise<void> {
    const [status] = await this.executeCommand('$C', `${chunkIndex} ${jsonData}`);
    if (status !== DPUControlStatus.SUCCESS) {
      if (status === 0x10) {
        throw new Error('ChunkIndex not parseable');
      } else if (status === 0x11) {
        throw new Error('ChunkIndex out of range');
      } else if (status === 0x12) {
        throw new Error('Chunk not cleared beforehand');
      } else if (status === 0x13) {
        throw new Error('Flash access error');
      }
      throw new Error(`Set configurations chunk failed with status: ${status.toString(16)}`);
    }
  }

  async reloadConfigurations(): Promise<void> {
    const [status] = await this.executeCommand('$R');
    if (status !== DPUControlStatus.SUCCESS) {
      if (status === 0x10) {
        throw new Error('Configuration file is invalid');
      }
      throw new Error(`Reload configurations failed with status: ${status.toString(16)}`);
    }
  }

  async getConfigurationsChecksum(): Promise<string> {
    const [status, data] = await this.executeCommand('$cc');
    if (status !== DPUControlStatus.SUCCESS) {
      throw new Error(`Get configurations checksum failed with status: ${status.toString(16)}`);
    }
    return data;
  }

  async getFirmwareChecksum(): Promise<string> {
    const [status, data] = await this.executeCommand('$fc');
    if (status !== DPUControlStatus.SUCCESS) {
      throw new Error(`Get firmware checksum failed with status: ${status.toString(16)}`);
    }
    return data;
  }

  async getBatteryState(): Promise<{capacity: number, charging: boolean}> {
    const [status, data] = await this.executeCommand('$b');
    if (status !== DPUControlStatus.SUCCESS) {
      throw new Error(`Get battery state failed with status: ${status.toString(16)}`);
    }

    const [capacityStr, chargingStr] = data.split(' ');
    return {
      capacity: parseInt(capacityStr),
      charging: chargingStr === '1'
    };
  }

  async getFirmwareVersion(): Promise<string> {
    const [status, data] = await this.executeCommand('$fv');
    if (status !== DPUControlStatus.SUCCESS) {
      throw new Error(`Get firmware version failed with status: ${status.toString(16)}`);
    }
    return data;
  }

  async listConnectedDevices(deviceIndex: number): Promise<{devicesCount: number, jsonData: string, devicesHash: string}> {
    const [status, data] = await this.executeCommand('$d', deviceIndex.toString());
    if (status !== DPUControlStatus.SUCCESS) {
      if (status === 0x10) {
        throw new Error('DeviceIndex not parseable');
      } else if (status === 0x11) {
        throw new Error('DeviceIndex out of range');
      }
      throw new Error(`List connected devices failed with status: ${status.toString(16)}`);
    }

    const parts = data.split(' ');
    return {
      devicesCount: parseInt(parts[0]),
      jsonData: parts[1],
      devicesHash: parts[2]
    };
  }

  async destroy(): Promise<void> {
    await this.characteristic.stopNotifications();
    this.characteristic.removeEventListener('characteristicvaluechanged', this.handleResponse.bind(this));
  }
}

export class MyoMod {
  private poseHelper: Partial<MyoModHandPose> = {};
  private oldCounter: number = -1;
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

  subscribeHandPose(callback: (data: Readonly<MyoModHandPose>, raw: DataView) => void): () => void {
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
      let valueCounter = value.getUint8(8);
      this.poseHelper.counter = valueCounter / 255;
      if (valueCounter != (this.oldCounter + 1) % 256 && this.oldCounter != -1) {
        console.warn(
          `MyoMod: Counter mismatch! Expected ${this.oldCounter + 1} but got ${valueCounter}`
        );
      }
      this.oldCounter = valueCounter;

      callback(this.poseHelper as Readonly<MyoModHandPose>, value);
    };
    this.handPoseCharacteristic.addEventListener(
      "characteristicvaluechanged",
      listener
    );
    this.handPoseCharacteristic.startNotifications();
    return () => {
      this.handPoseCharacteristic.stopNotifications();
      this.handPoseCharacteristic.removeEventListener(
        "characteristicvaluechanged",
        listener
      );
    };
  }

  subscribeEmgData(callback: (data: Readonly<MyoModEmgData>, counter: number, raw: DataView) => void): () => void {
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
        const channelArray = ch === 0 ? emgHelper.chnA :
                            ch === 1 ? emgHelper.chnB :
                            ch === 2 ? emgHelper.chnC :
                            ch === 3 ? emgHelper.chnD :
                            ch === 4 ? emgHelper.chnE : emgHelper.chnF;
                            
        for (let i = 0; i < dataSize; i++) {
          const byteOffset = (ch * dataSize + i) * 4;
          channelArray[i] = value.getFloat32(byteOffset, true);
        }
      }

      callback(emgHelper as Readonly<MyoModEmgData>, counter, value);
    };
    
    this.emgDataCharacteristic.addEventListener(
      "characteristicvaluechanged",
      listener
    );
    this.emgDataCharacteristic.startNotifications();
    return () => {
      this.emgDataCharacteristic.stopNotifications();
      this.emgDataCharacteristic.removeEventListener(
        "characteristicvaluechanged",
        listener
      );
    };
  }

  subscribeFilteredEmgData(callback: (data: Readonly<MyoModFilteredEmgData>, counter: number, raw: DataView) => void): () => void {
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
      emgHelper.state = value.getFloat32(4*6, true);
      

      callback(emgHelper as Readonly<MyoModFilteredEmgData>, counter, value);
    };
    
    this.filteredEmgCharacteristic.addEventListener(
      "characteristicvaluechanged",
      listener
    );
    this.filteredEmgCharacteristic.startNotifications();
    return () => {
      this.filteredEmgCharacteristic.stopNotifications();
      this.filteredEmgCharacteristic.removeEventListener(
        "characteristicvaluechanged",
        listener
      );
    };
  }

  destroy(): void {
    if (this._dpuControl) {
      this._dpuControl.destroy();
      this._dpuControl = null;
    }
    this.device.gatt?.disconnect();
  }
}
