#!/usr/bin/env python3

import json
import os

def generate_markdown_from_nodes(node_definitions):
    """Generate markdown documentation from node definitions."""
    markdown = """# MyoMod Protocol Definition

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
Both type and id are always exactly 10 characters long.\n\n"""
    
    # Process device nodes
    for node in node_definitions.get("deviceNodes", []):
        markdown += generate_node_markdown(node)

    markdown += """\n\n ## Embedded Device Nodes
Devices are directly embedded into the DPU and therefore don't need the MyoMod bus. They use te same type+id system for identification as the normal devices nodes do.
"""
    
    # Process embedded device nodes
    for node in node_definitions.get("embeddedDeviceNodes", []):
        markdown += generate_node_markdown(node)

    markdown += """\n\n ## Algorithmic Nodes
Processing components that manipulate data:
"""
    
    # Process algorithmic nodes
    for node in node_definitions.get("algorithmicNodes", []):
        markdown += generate_node_markdown(node)
    
    markdown += """
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
"""

    return markdown

def generate_node_markdown(node):
    """Generate markdown for a single node."""
    md = f"### {node['name']} (`{node['type']}`)\n\n"
    
    md += f"**Description:** {node['description']}\n\n"
    
    # Inputs
    if node["inputs"]:
        md += "#### Inputs\n\n"
        md += "| Index | Type | Name | Description | Range |\n"
        md += "| ----- | ---- | ---- | ----------- | ----- |\n"
        for input_port in node["inputs"]:
            range_info = input_port.get("range", "-")
            md += f"| {input_port['index']} | {input_port['type']} | {input_port['name']} | {input_port['description']} | {range_info} |\n"
        md += "\n"
    
    # Outputs
    if node["outputs"]:
        md += "#### Outputs\n\n"
        md += "| Index | Type | Name | Description | Range |\n"
        md += "| ----- | ---- | ---- | ----------- | ----- |\n"
        for output_port in node["outputs"]:
            range_info = output_port.get("range", "-")
            md += f"| {output_port['index']} | {output_port['type']} | {output_port['name']} | {output_port['description']} | {range_info} |\n"
        md += "\n"
    
    # Options
    if node["options"]:
        md += "#### Options\n\n"
        md += "| Name | Type | Description | Values/Range | Default |\n"
        md += "| ---- | ---- | ----------- | ------------ | ------- |\n"
        
        for option_name, option in node["options"].items():
            # Handle enum type with values
            if option["type"] == "enum" and "values" in option:
                values_str = ", ".join([f"`{val}`" for val in option["values"]])
            else:
                values_str = option.get("range", "-")
                
            default = option.get("default", "-")
            md += f"| {option_name} | {option['type']} | {option['description']} | {values_str} | {default} |\n"
        md += "\n"

    # Example
    # Example
    if "example" in node:
        md += "#### Example\n\n"
        md += "```json\n"
        md += json.dumps(node["example"], indent=2)
        md += "\n```\n\n"
    else:
        # Generate a simple example based on node properties
        example = {
            "type": node["type"],
            "id": f"{node['type'][0:7]}001"  # Generate a sample ID
        }
        
        # Add options with default values if available
        if node["options"]:
            example["options"] = {}
            for option_name, option_data in node["options"].items():
                if "default" in option_data:
                    example["options"][option_name] = option_data["default"]
        
        md += "#### Example\n\n"
        md += "```json\n"
        md += json.dumps(example, indent=2)
        md += "\n```\n\n"
    
    md += "---\n\n"
    return md

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    definitions_path = os.path.join(script_dir, "node_definitions.json")
    output_path = os.path.join(script_dir, "configuration_definition.md")
    
    # Read node definitions
    with open(definitions_path, 'r') as file:
        node_definitions = json.load(file)
    
    # Generate markdown
    markdown_content = generate_markdown_from_nodes(node_definitions)
    
    # Write markdown to file
    with open(output_path, 'w') as file:
        file.write(markdown_content)
    
    print(f"Documentation successfully generated at: {output_path}")

if __name__ == "__main__":
    main()
