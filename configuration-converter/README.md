# YAML to Multi-Config Converter for AEMS


## Overview
A single, unified, natural language-friendly YAML config file drives all the system-specific configuration required for AEMS deployment. This tool parses a YAML file and generates the essential artifacts for each component—web client, web server, middleware (VOLTTRON), and building unit config—so non-expert users don't have to manually maintain multiple scattered configs. 

## Project Background
In small/medium commercial building (SMCB) deployments, operators are often asked to edit multiple configs in different folders, each with its own syntax and key naming (e.g., JSON and .ENV formats). That is fragile and time-consuming and requires technical knowledge. This converter consolidates the inputs, ensure data consistency, and writes the outputs in the formats required for each subsystem. This configuration automation enables users to reduce setup effort and avoid human errors (e.g., ports, IDs, credentials).

## Key features
- Single YAML file in → many config files out
    - `<client_dir>/.env` (for web client)
    - `<server_dir>/.env` (for web server)
    - `config_<campus>-<building>-<system>.config` (building unit JSON)
    - `<volttron_dir>/volttron_config/config` (VOLTTRON INI-style)
    - `<volttron_dir>/config/*` + `volttron/scripts/*` (agent JSON + "upgrade" Python command-line scripts)
- Consistent mapping of natural, human keys (e.g., “application title”) to machine keys (e.g., `REACT_APP_TITLE`)
- Defaults & validation: missing values are filled from sane defaults; required fields are checked
- Schedule & chart normalization: minutes → `H:MM`, flexible “variable 1” → `var_1` handling
- Semantic building model ingestion (optional): parse a Brick Schema model (in TTL) to auto-generate building unit configs

## What the YAML includes

Each section below is optional, but include the ones you need.

### 1) `building unit`
- **Two modes**:
  - **Manual configs**: define `system 1`, `system 2`, … with campus/building/system IDs, points, schedules, etc.
  - **Brick import**: set `brick schema file path: <your_model.ttl>` to auto-generate systems from a Brick model.
- **Required per system** (keys with mark `*` in YAML to assert required):
  - `campus`, `building`, `system`, and `zone_point_names`
- **Normalization**:
  - Schedules: minutes → `"H:MM"` per day (`Monday`…`Sunday`)
  - Chart configs: `variable 1`, `var 1`, `var_1` → `"var_1"`
- **Output**: one JSON per system:
  ```
  config_<campus>-<building>-<system>.config
  ```

> When using Brick, the converter recognizes `brick:Site`, `brick:Building`, `brick:HVAC_Zone`, `brick:hasPart`, and collects zone points via equipment `brick:hasPoint` relationships. It automatically generates essential information (e.g,. campus/building/system IDs, zone point names).

### 2) `web client`
- Natural keys (e.g., `application title`) are mapped to `REACT_APP_*` keys.
- **Output**: `.env_client`

### 3) `web server`
- Natural keys (e.g., `server port`, `database url`) map to server environment variables.
- **Output**: `.env_server`
- **Auto-link** to building unit configs: the converter fills
  ```
  SETUP_FILES=config/<campus>-<building>-<system>.config,...
  ```
  based on files it just generated (paths are relative to the server section’s `config directory path`).

### 4) `volttron`
- Flat keys are written into INI-style `volttron/volttron_config/config`.
- `agent info` (if present) emits:
  - `volttron/config/interface_config_<agent_id>`
  - `volttron/config/recv_config_<agent_id>`
  - `volttron/scripts/upgrade_interface_<agent_id>`
  - `volttron/scripts/upgrade_rec_<agent_id>`

## Example YAML Config File
The following example represents the designed structure of the unified YAML configuration file:
```
building unit:
    config directory path: ./config
    system 1:
        campus*: campus01
        building*: building6000
        system*: zone6101
        ...

        zone point names*:
            zoneaircoolingsetpoint: ZoneAirCoolingSetpoint
            zoneairheatingsetpoint: ZoneAirHeatingSetpoint
            ...
        default setpoints:
            HVACMode: auto
            ZoneAirHeatingSetpoint: 65
            ZoneAirCoolingSetpoint: 78
            ...
        schedule:
            monday:
                start: 8:00
                end: 18:00
            ...
        ...
    system 2:
        ...
    ...

web client:
    config directory path: ./client
    application title: AEMS Dashboard
    application login: true
    port: 2000
    ...

web server:
    config directory path: ./server
    project name: AEMS
    port: 5000
    database url: postgresql://user:pass@localhost:5432/aems
    ...

    system users:
    user 1:
        name: Test Admin
        email: test-admin@bems.com
        password: password
        role: admin
    user 2:
        ...
    ...

volttron:
    config directory path: ./volttron
    vip-address: tcp://127.0.0.1:23921
    ...

    agent info:
    agent 1:
        campus: campus01
        id: interface-01
        url: http://localhost:5000        
        ...
        data point:
            fcu_oveTSup_u:
                type: float
                units: K
                timezone: UTC
            ...
    agent 2:
        ...
    ...
```
For a complete exampl of both configuration modes (manual configs and brick import), see the provided examples:
- `example_YAML-config.yml` — Manual definition of building units, web client/server, and VOLTTRON configs.
- `example_YAML-brick-config.yml` — Semantic model–based definition, where building units are auto-generated from a Brick Schema model (TTL).
- `example_brick.ttl` — A Brick Schema model to generate building unit configuration for demonstration.

Example output configuration files are available in the `test` folder. Additionally, translated building configuration files from an [industrial Brick Schema model](https://brickschema.org/ttl/mortar/bldg27.ttl) can be found in `test/brick_output_bldg27`.


## YAML Template for Quick Start
A ready-to-use YAML template (`template_YAML-config.yml`) is provided for beginners. This template gives you a starting point to quickly set up each section (`building unit`, `web client`, `web server`, `volttron`) without worrying about syntax, schema, or required keys. Users can easily copy this template , fill in only the values relevant to the deployment, and run the converter. The tool will handle defaults and validate required fields automatically.

The template covers all sections:
- `building unit` (manual and Brick-based system configuration)
- `web client` (UI application settings)
- `web server` (server application settings)
- `volttron` (middleware backend and agents)


## About `config directory path`
The converter is designed to generate each output file in the designated directory within this `volttron-pnnl-aems` GitHub repository. If users prefer, aach YAML section can specify a `config directory path`. This key does not appear in the generated outputs. Instead, it controls where the converter writes the corresponding files. For instance:
```
building unit:
    config directory path: ./outputs/unit
```
→ All `config_<campus>-<building>-<system>.config` files are written into `./outputs/unit`.
This separation lets you organize outputs per component without editing paths manually.


## Repository layout
```
.
├─ main.py                  # CLI entrypoint
└─ utils/
   ├─ constants.py          # defaults, key maps, known env names
   ├─ general_tools.py      # shared I/O and string/YAML helpers
   ├─ building_config.py    # Key transforms, schedule/chart normalization
   ├─ brick_parser.py       # Brick TTL → building unit config files
   ├─ web_client.py         # .env_client writer
   ├─ web_server.py         # .env_server writer + system-user JSON (if present)
   └─ volttron.py           # VOLTTRON config + agent artifacts
```

## Installation
```
# Python 3.10+
python -m venv .venv && source .venv/bin/activate   # (Windows: .venv\Scripts\activate)
pip install -U pyyaml rdflib
```

## Quick start
1. Create your YAML with the sections you need:
- `building unit`
- `web client`
- `web server`
- `volttron`
2. (Optional) In any section, set `config directory path` to choose where outputs land.
3. Run the converter:
```
python main.py -i path/to/config.yml
```
- `-i, --input` — path to the unified YAML file (required)
- The script prints the list of files it wrote, one per line

## Extending

- Add new human→machine key mappings in `constants.py` (e.g., for additional env vars).
- Customize defaults in `DEFAULTS`.
- Introduce a new output writer by following the pattern in `web_client.py`/`web_server.py` and calling it from `main.py`.