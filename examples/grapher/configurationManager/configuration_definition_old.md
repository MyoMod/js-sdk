# MyoMod Protocol Definition

This document outlines the protocol structure for MyoMod configurations, detailing the components and their connections.

## Configuration Structure

A configuration is represented as a JSON array containing one or more configuration objects. Each configuration has the following top-level properties:

| Property | Type | Description |
|----------|------|-------------|
| name | string | Name identifier for the configuration |
| color | number | Color identifier (decimal representation of hex color) |
| deviceNodes | array | List of external device nodes |
| embeddedDeviceNodes | array | List of embedded device components |
| algorithmicNodes | array | List of algorithmic processing nodes |
| links | object | Connection map between nodes |

## Node Types

### Device Nodes
Device nodes are nodes that are connected to the DPU via the MyoMod Bus. They transmit and receive realtime data from the DPU in a cyclic manner and can be configured on configuration activation.

Device nodes do always have a type and a ID field. The type filed defines the exact type (and therefore also the interface) of the device and the ID identifies the device. The combination of type and ID need to be unique.
Both type and id are always exactly 10 characters long.

#### BLE Bridge

The BLE-Bridge is a MyoMod device on the MyoMod bracelet that transfers real-time data between the host (for example a WebApp showing live-Graphs with the measured Data) and the DPU.

The first 8 input ports are of type uint8 and are used to transmit Pose data to the host.

Input ports 8 to 13 transmit the raw emg-data to the host and are of type float32[15].

Input ports 14 to 19 transmit the already filtered emg data to the host and are of type float32.

```json
{
  "type": "BLE Bridge",
  "ID": "Bridge 001"
}
```

### Embedded Device Nodes

Devices are directly embedded into the DPU and therefore don't need the MyoMod bus. They use te same type+id system for identification as the normal devices nodes do.

#### IMU (Inertial Measurement Unit)
The IMU (Inertial Measurement Unit) component provides motion tracking capabilities with 6 degrees of freedom - 3 axes of acceleration and 3 axes of rotation:

- Output ports 0-2: Acceleration data (in m/s²) for X, Y, and Z axes respectively, type float32
- Output ports 3-5: Gyroscope data (in degrees/s) for X, Y, and Z axes respectively, type float32


```json
{
  "type": "Embed' IMU",
  "ID": "OnboardIMU"
}
```

#### LED
#### LED
The onboard RGB LED component allows for color control via three independent channels:

- Input port 0: Red channel intensity (float32, range 0.0-1.0)
- Input port 1: Green channel intensity (float32, range 0.0-1.0)
- Input port 2: Blue channel intensity (float32, range 0.0-1.0)

The brightness parameter serves as a global multiplier for all channels.

```json
{
  "type": "Embed' LED",
  "ID": "OnboardLED",
  "brightness": 0.1  // Range: 0.0-1.0
}
```

#### EMG (Electromyography)
#### EMG (Electromyography)
The onboard EMG sensor captures muscle electrical activity across 6 channels:

- Output ports 0-5: EMG data channels, each providing an array of 15 float32 values
    - Each channel represents electrode measurements from different muscle areas
    - The 15 float values per channel contain the time-sequenced electrical potential readings

The amplification parameter controls the analog signal strength multiplier applied to all channels.


```json
{
  "type": "Embed' EMG",
  "ID": "OnboardEMG",
  "amplification": 1  // Amplification factor
}
```

### Algorithmic Nodes

Processing components that manipulate data:

#### LinearFuncNode
Applies a linear transformation (y = ax + b) to input data.

Has one input and one output port, both are of the type defined by dataType. dataType may have the following values: float, int32, uint32, int8 and uint8.

```json
{
  "type": "LinearFuncNode",
  "dataType": "float",
  "a": 0.1,  // Multiplier
  "b": 0     // Offset
}
```

#### AdaptiveEMGFiltNode
Specialized filtering node designed for processing EMG signals with adaptive parameters:

- Input ports 0-5: Raw EMG data channels, each accepting an array of 15 float32 values
    - Each input channel corresponds to one electrode channel from the EMG sensor
    - The 15 values represent sequential time samples of the muscle electrical activity
- Output ports 0-5: Filtered EMG data, each providing a single float32 value
    - Each output represents the processed signal strength for the corresponding channel
    - The adaptive filtering automatically adjusts to varying signal conditions and noise levels

The node implements specialized digital signal processing algorithms optimized for extracting muscle activation patterns from electrical signals.

```json
{
  "type": "AdaptiveEMGFiltNode"
}
```

## Link Protocol

The `links` object defines connections between nodes using a source-destination format:

```
"destinationNodeIndex:outputPort": "sourceNodeIndex:inputPort"
```

Syntax breakdown:
- Node indexes are prefixed with a single letter indicating node type:
  - `d`: Device node
  - `e`: Embedded device node
  - `a`: Algorithmic node
- The number after the letter represents the index in the respective array
- After the colon is the port number

Example:
```
"a0:0": "e0:0"  // Connects input 0 of algorithmic node 0 to output 0 of embedded device 0
```

## Implementation Notes

1. Node arrays should be ordered correctly as the indexes in links depend on array positions
2. Multiple connections can be established from a single output port
3. Device indexes are zero-based within their respective arrays
4. Port numbering is specific to each node type and its capabilities
5. The type of the input and output port must match, otherwise the configuration cannot be enabled
