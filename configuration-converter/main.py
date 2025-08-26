import os, re, json
import argparse, sys
from typing import Any, Dict, List, Tuple

from utils.general_utils import read_yaml_with_overrides, section_outdir, write_json
from utils.constants import DEFAULTS, SYSTEM_REQUIRED
from utils.building_config import transform_keys, required_machine_keys, normalize_schedule, normalize_chart_configs
from utils.brick_parser import generate_configs_from_brick
from utils.web_server import update_server_env, update_system_users_json
from utils.web_client import update_client_env
from utils.volttron import update_volttron_config, write_agent_artifacts

def _apply_defaults(section: Dict[str, Any]) -> None:
    for k, v in DEFAULTS.items():
        if k not in section:
            section[k] = v.copy() if isinstance(v, dict) else v

def _collect_setup_rel_paths(cfg_dir: str, outputs: List[str]) -> List[str]:
    out = []
    for p in outputs:
        fname = os.path.basename(p)
        rel = os.path.normpath(os.path.join(cfg_dir, fname)).replace(os.sep, "/")
        out.append(rel)
    return out

def _iter_system_blocks(bu: dict):
    for k, v in (bu or {}).items():
        if re.match(r"system\s+\d+", str(k), flags=re.I):
            yield k, v

def process_yaml_and_update_configs(yaml_path: str) -> List[str]:
    data, overrides, yaml_dir = read_yaml_with_overrides(yaml_path)
    outputs: List[str] = []
    setup_files_rel: List[str] = []

    # ------- PART 1: Building unit -> .config files -------
    bu = data.get("building unit", {}) or {}
    out_dir_bu = section_outdir(yaml_dir, bu, default="./")
    brick_path = bu.get("brick schema file path")

    if brick_path:
        brick_outputs = generate_configs_from_brick(brick_path, out_dir_bu)
        outputs.extend(brick_outputs)
        setup_files_rel.extend(_collect_setup_rel_paths(bu.get("config directory path", "./"), brick_outputs))
    else:
        for sys_key, sys_human in _iter_system_blocks(bu):
            sys_machine = transform_keys(sys_human, ("building unit", sys_key), overrides)
            req = required_machine_keys(sys_human) or SYSTEM_REQUIRED
            missing = [rk for rk in req if rk not in sys_machine or sys_machine.get(rk) in (None, "", {})]
            if missing:
                raise ValueError(f"Missing required fields in {sys_key}: {missing}")

            _apply_defaults(sys_machine)
            if isinstance(sys_machine.get("schedule"), dict):
                sys_machine["schedule"] = normalize_schedule(sys_machine["schedule"])
            if isinstance(sys_machine.get("chart_configs"), dict):
                sys_machine["chart_configs"] = normalize_chart_configs(sys_machine["chart_configs"])

            fname = f"config_{sys_machine.get('campus')}-{sys_machine.get('building')}-{sys_machine.get('system')}.config"
            out_path = os.path.join(out_dir_bu, fname)
            write_json(out_path, sys_machine)
            outputs.append(out_path)
            setup_files_rel.append(os.path.normpath(os.path.join(bu.get("config directory path", "./"), fname)).replace(os.sep, "/"))

    # ------- PART 2: Web server env + system users -------
    ws = data.get("web server", {}) or {}
    env_server_path = update_server_env(ws, yaml_dir, setup_files_rel)
    outputs.append(env_server_path)
    sys_users_path = update_system_users_json(ws, yaml_dir)
    if sys_users_path: outputs.append(sys_users_path)

    # ------- PART 3: Web client env -------
    wc = data.get("web client", {}) or {}
    env_client_path = update_client_env(wc, yaml_dir)
    outputs.append(env_client_path)

    # ------- PART 4: VOLTTRON config + agents -------
    vt = data.get("volttron", {}) or {}
    vt_cfg_path = update_volttron_config(vt, yaml_dir, overrides)
    if vt_cfg_path: outputs.append(vt_cfg_path)

    # agent info (machine-key transform via transform_keys to reuse overrides)
    agent_info_key = next((k for k in vt if str(k).lower().startswith("agent info")), None)
    agent_info = vt.get(agent_info_key) if agent_info_key else None
    if isinstance(agent_info, dict) and agent_info:
        agents_machine: Dict[str, Dict[str, Any]] = {}
        for human_agent_key, human_agent_block in agent_info.items():
            if not isinstance(human_agent_block, dict): continue
            agent_machine = transform_keys(human_agent_block, ("volttron","agent info",human_agent_key), overrides)
            agent_id = agent_machine.get("id")
            if not agent_id: raise ValueError(f"Missing 'id' for {human_agent_key} under volttron -> agent info")
            agents_machine[str(agent_id)] = agent_machine
        outputs.extend(write_agent_artifacts(vt, yaml_dir, agents_machine))

    return outputs

if __name__ == "__main__":
    """
    Run the YAML → JSON/.ENV config converter for running a building energy management system.

    Example:
        python main.py -i path/to/config.yml
    """
    
    parser = argparse.ArgumentParser(description="YAML → Multiple JSON/.ENV config translator for building energy management system")
    parser.add_argument("-i", "--input", required=True, help="Path to the YAML config file")
    args = parser.parse_args()

    try:
        out = process_yaml_and_update_configs(args.input)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    print("\n".join(out))
