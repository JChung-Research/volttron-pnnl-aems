import os
from typing import Any, Dict, List, Tuple
from utils.general_utils import (strip_markers, kebab_case, ensure_section_header,
                             load_lines, write_lines, update_kv_lines,
                             write_json)
from utils.constants import QUOTED_CONF_KEYS

"""VOLTTRON configuration writers: INI-style config updates and agent artifacts
(JSON configs and upgrade scripts). No runtime behavior is changed here.
"""

def format_conf_value(key: str, v: Any) -> str:
    """Format a value for the INI-like volttron 'config' file."""

    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, (int, float)) or v is None: return "" if v is None else str(v)
    s = str(v); return f"\"{s}\"" if key in QUOTED_CONF_KEYS else s

def update_volttron_config(vt: dict, yaml_dir: str, overrides: Dict[Tuple[str, ...], str]) -> str | None:
    """
    Apply flat key updates to 'volttron/volttron_config/config'.

    Skips nested sections and 'config directory' selectors.
    Returns the path to the written config file, or None if no updates.
    """

    if not isinstance(vt, dict) or not vt:
        return None
    out_dir = os.path.abspath(os.path.join(yaml_dir, (vt.get(next((k for k in vt if strip_markers(k).lower().startswith("config directory path")), ""), "./"))))
    base_dir = os.path.join(out_dir, "volttron")
    config_dir = os.path.join(base_dir, "volttron_config")
    os.makedirs(config_dir, exist_ok=True)
    cfg_path = os.path.join(config_dir, "config")

    lines = ensure_section_header(load_lines(cfg_path), "volttron")
    updates: Dict[str, str] = {}
    for human_key, val in vt.items():
        if isinstance(val, dict):  # handled elsewhere
            continue
        if strip_markers(human_key).lower().startswith("config directory"):
            continue
        conf_key = overrides.get(("volttron", human_key)) or overrides.get(("volttron", strip_markers(human_key))) or kebab_case(human_key)
        if conf_key:
            updates[conf_key] = format_conf_value(conf_key, val)

    if updates:
        new_lines = update_kv_lines(lines, updates)
        write_lines(cfg_path, new_lines)
        return cfg_path
    return None

# ----- Agent configs -----
def render_interface_json(agent_id: str, agent: Dict[str, Any]) -> dict:
    """Build InterfaceAgent JSON config for a given agent manager + metadata."""

    topic_base = f"devices/{agent.get('building', '')}/{agent_id}"
    dp = {}
    for name, meta in (agent.get("data_point") or {}).items():
        meta = meta or {}
        dp[name] = {"type": str(meta.get("type", "")),
                    "units": str(meta.get("units", "")),
                    "tz": str(meta.get("timezone", ""))}
    return {
        "url": agent.get("url", ""),
        "module": "app_agents.client",
        "class": agent.get("class", ""),
        "topic": f"{topic_base}/all",
        "heartbeat_period": int(agent.get("heartbeat_period", 30)),
        "inputs": {"topic": f"{topic_base}/control"},
        "data_point": dp,
    }

def render_recv_json(agent_id: str, agent: Dict[str, Any]) -> dict:
    """Build RecvAgent JSON config for a given agent manager + metadata."""

    topic_base = f"devices/{agent.get('building', '')}/{agent_id}"
    return {"inputs": {"topic": f"{topic_base}/all"},
            "module": "app_agents.client",
            "topic": f"{topic_base}/control",
            "class": "UI"}

def render_upgrade_interface_bash(agent_id: str) -> str:
    """Create bash script content to install/start an InterfaceAgent."""

    return (
        "#!/usr/bin/env bash\n"
        "python ./scripts/install-agent.py \\\n"
        "    -s app_agents/InterfaceAgent \\\n"
        f"    -i interface_{agent_id} \\\n"
        f"    --tag interface_{agent_id} \\\n"
        f"    --config config/interface_config_{agent_id} \\\n"
        "    --start \\\n"
        "    --force\n"
    )

def render_upgrade_recv_bash(agent_id: str) -> str:
    """Create bash script content to install/start a RecvAgent."""

    return (
        "#!/usr/bin/env bash\n"
        "python ./scripts/install-agent.py \\\n"
        "    -s app_agents/RecvAgent \\\n"
        f"    -i rec_{agent_id} \\\n"
        f"    --tag rec_{agent_id} \\\n"
        f"    --config config/recv_config_{agent_id} \\\n"
        "    --start \\\n"
        "    --force\n"
    )

def write_agent_artifacts(vt: dict, yaml_dir: str, agents: Dict[str, Dict[str, Any]]) -> List[str]:
    """
    Write per-agent JSON configs and upgrade scripts under 'volttron/'.

    Returns:
        List of absolute file paths written.
    """

    out_dir = os.path.abspath(os.path.join(yaml_dir, (vt.get(next((k for k in vt if strip_markers(k).lower().startswith("config directory path")), ""), "./"))))
    base_dir = os.path.join(out_dir, "volttron")
    paths: List[str] = []
    for agent_id, agent in agents.items():
        iface_path = os.path.join(base_dir, f"config/interface_config_{agent_id}")
        recv_path  = os.path.join(base_dir, f"config/recv_config_{agent_id}")
        up_i_path  = os.path.join(base_dir, f"scripts/upgrade_interface_{agent_id}")
        up_r_path  = os.path.join(base_dir, f"scripts/upgrade_rec_{agent_id}")
        write_json(iface_path, render_interface_json(agent_id, agent))
        write_json(recv_path,  render_recv_json(agent_id, agent))
        os.makedirs(os.path.dirname(up_i_path), exist_ok=True)
        with open(up_i_path, "w", encoding="utf-8") as f: f.write(render_upgrade_interface_bash(agent_id))
        os.makedirs(os.path.dirname(up_r_path), exist_ok=True)
        with open(up_r_path, "w", encoding="utf-8") as f: f.write(render_upgrade_recv_bash(agent_id))
        paths.extend([iface_path, recv_path, up_i_path, up_r_path])
    return paths