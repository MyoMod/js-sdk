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
  const [handPoseCharacteristic, emgDataCharacteristic] = await Promise.all([
    service.getCharacteristic("5782a59c-fca9-4213-909f-0f88517c8fae"),
    service.getCharacteristic("9c54ed76-847e-4d51-84be-7cf02794de53"),
  ]);

  return new MyoMod(device, handPoseCharacteristic, emgDataCharacteristic);
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

export class MyoMod {
  private poseHelper: Partial<MyoModHandPose> = {};
  private oldCounter: number = -1;

  constructor(
    private readonly device: BluetoothDevice,
    private readonly handPoseCharacteristic: BluetoothRemoteGATTCharacteristic,
    private readonly emgDataCharacteristic: BluetoothRemoteGATTCharacteristic
  ) {}

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

      // Get the EMG data (excluding the counter byte)
      const dataSize = 15; // 15 samples per channel
      const numChannels = 6; // 6 channels (A-F)
      
      for (let ch = 0; ch < numChannels; ch++) {
        const channelArray = ch === 0 ? emgHelper.chnA :
                            ch === 1 ? emgHelper.chnB :
                            ch === 2 ? emgHelper.chnC :
                            ch === 3 ? emgHelper.chnD :
                            ch === 4 ? emgHelper.chnE : emgHelper.chnF;
                            
        for (let i = 0; i < dataSize; i++) {
          const byteOffset = (ch * dataSize + i) * 4; // 4 bytes per float
          channelArray[i] = value.getFloat32(byteOffset, true); // true for little endian
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

  destroy(): void {
    this.device.gatt?.disconnect();
  }
}
