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
  const [handPoseCharacteristic, rawDataCharacteristic] = await Promise.all([
    service.getCharacteristic("5782a59c-fca9-4213-909f-0f88517c8fae"),
    service.getCharacteristic("9c54ed76-847e-4d51-84be-7cf02794de53"),
  ]);
  return new MyoMod(device, handPoseCharacteristic, rawDataCharacteristic);
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

export class MyoMod {
  private poseHelper: Partial<MyoModHandPose> = {};
  private oldCounter: number = 0;

  constructor(
    private readonly device: BluetoothDevice,
    private readonly handPoseCharacteristic: BluetoothRemoteGATTCharacteristic,
    private readonly rawDataCharacteristic: BluetoothRemoteGATTCharacteristic
  ) {}

  subscribeHandPose(fn: (data: Readonly<MyoModHandPose>, raw: DataView) => void): () => void {
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
      if (valueCounter != (this.oldCounter + 1) % 256) {
        console.warn(
          `MyoMod: Counter mismatch! Expected ${this.oldCounter + 1} but got ${valueCounter}`
        );
      }
      this.oldCounter = valueCounter;

      fn(this.poseHelper as Readonly<MyoModHandPose>, value);
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
  subscribeRawData(fn: (data: Readonly<Uint32Array>, raw: DataView) => void): () => void {
    const listener = (e: Event) => {
      const { value } = e.target as unknown as { value: DataView };
      fn(new Uint32Array(value.buffer), value);
    };
    this.rawDataCharacteristic.addEventListener(
      "characteristicvaluechanged",
      listener
    );
    this.rawDataCharacteristic.startNotifications();
    return () => {
      this.rawDataCharacteristic.stopNotifications();
      this.rawDataCharacteristic.removeEventListener(
        "characteristicvaluechanged",
        listener
      );
    };
  }
  destroy(): void {
    this.device.gatt?.disconnect();
  }
}
