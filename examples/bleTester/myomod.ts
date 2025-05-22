import { call } from "three/webgpu";

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

  constructor(
    private readonly device: BluetoothDevice,
    private readonly handPoseCharacteristic: BluetoothRemoteGATTCharacteristic,
    private readonly emgDataCharacteristic: BluetoothRemoteGATTCharacteristic,
    private readonly filteredEmgCharacteristic: BluetoothRemoteGATTCharacteristic,
    private readonly asyncCtrlCharacteristic: BluetoothRemoteGATTCharacteristic
  ) {}

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
    this.device.gatt?.disconnect();
  }
}
