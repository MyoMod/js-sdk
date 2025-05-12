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

### BLE Bridge (`BLE Bridge`)

**Description:** The BLE-Bridge is a MyoMod device on the MyoMod bracelet that transfers real-time data between the host and the DPU.

#### Inputs

| Index | Type | Name | Description | Range |
| ----- | ---- | ---- | ----------- | ----- |
| 0-7 | uint8 | Pose Data | Transmits pose classification data to the host | - |
| 8-13 | float32[15] | Raw EMG Data | Transmits raw EMG channel data to the host | - |
| 14-19 | float32 | Filtered EMG Data | Transmits filtered EMG data to the host | - |

#### Example

```json
{
  "type": "BLE Bridge",
  "ID": "Bridge 001"
}
```

---



 ## Embedded Device Nodes
Devices are directly embedded into the DPU and therefore don't need the MyoMod bus. They use te same type+id system for identification as the normal devices nodes do.
### IMU (`Embed' IMU`)

**Description:** Inertial Measurement Unit providing motion tracking capabilities

#### Outputs

| Index | Type | Name | Description | Range |
| ----- | ---- | ---- | ----------- | ----- |
| 0-2 | float32 | Accelerometer | Acceleration data in m/s² for X, Y, and Z axes | -16 to 16 |
| 3-5 | float32 | Gyroscope | Rotational velocity in degrees/s for X, Y, and Z axes | -2000 to 2000 |

#### Example

```json
{
  "type": "Embed' IMU",
  "ID": "OnboardIMU"
}
```

---

### LED (`Embed' LED`)

**Description:** Onboard RGB LED component for visual feedback

#### Inputs

| Index | Type | Name | Description | Range |
| ----- | ---- | ---- | ----------- | ----- |
| 0 | float32 | Red | Red channel intensity | 0.0 to 1.0 |
| 1 | float32 | Green | Green channel intensity | 0.0 to 1.0 |
| 2 | float32 | Blue | Blue channel intensity | 0.0 to 1.0 |

#### Options

| Name | Type | Description | Values/Range | Default |
| ---- | ---- | ----------- | ------------ | ------- |
| brightness | float32 | Global brightness multiplier for all channels | 0.0 to 1.0 | 0.1 |

#### Example

```json
{
  "type": "Embed' LED",
  "ID": "OnboardLED",
  "brightness": 0.1
}
```

---

### EMG (`Embed' EMG`)

**Description:** Embedded EMG sensor for capturing muscle electrical activity

#### Outputs

| Index | Type | Name | Description | Range |
| ----- | ---- | ---- | ----------- | ----- |
| 0-5 | float32[15] | EMG Channels | EMG data from electrode channels with sequential time samples | -5.0 to 5.0 |

#### Options

| Name | Type | Description | Values/Range | Default |
| ---- | ---- | ----------- | ------------ | ------- |
| amplification | float32 | Signal strength multiplier applied to all channels | 0.1 to 10.0 | 1.0 |

#### Example

```json
{
  "type": "Embed' EMG",
  "ID": "OnboardEMG",
  "amplification": 1
}
```

---



 ## Algorithmic Nodes
Processing components that manipulate data:
### LinearFuncNode (`LinearFuncNode`)

**Description:** Applies a linear transformation (y = ax + b) to input data

#### Inputs

| Index | Type | Name | Description | Range |
| ----- | ---- | ---- | ----------- | ----- |
| 0 | dynamic | Input | Input value to be transformed | - |

#### Outputs

| Index | Type | Name | Description | Range |
| ----- | ---- | ---- | ----------- | ----- |
| 0 | dynamic | Output | Transformed output value | - |

#### Options

| Name | Type | Description | Values/Range | Default |
| ---- | ---- | ----------- | ------------ | ------- |
| dataType | enum | Data type for input and output ports | `float`, `int32`, `uint32`, `int8`, `uint8` | float |
| a | float32 | Multiplier coefficient | - | 0.1 |
| b | float32 | Offset value | - | 0 |

#### Example

```json
{
  "type": "LinearFuncNode",
  "dataType": "float",
  "a": 0.1,
  "b": 0
}
```

---

### AdaptiveEMGFiltNode (`AdaptiveEMGFiltNode`)

**Description:** Specialized filtering for EMG signals with adaptive parameters

#### Inputs

| Index | Type | Name | Description | Range |
| ----- | ---- | ---- | ----------- | ----- |
| 0-5 | float32[15] | Raw EMG | Raw EMG data channels for filtering | - |

#### Outputs

| Index | Type | Name | Description | Range |
| ----- | ---- | ---- | ----------- | ----- |
| 0-5 | float32 | Filtered EMG | Processed and filtered EMG signal | - |

#### Example

```json
{
  "type": "AdaptiveEMGFiltNode"
}
```

---


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
