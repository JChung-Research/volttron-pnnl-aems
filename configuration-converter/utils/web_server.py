import os, re, json
from typing import Dict, List
from utils.general_utils import (strip_markers, upper_snake, to_env_value,
                             load_env_to_pairs, dump_env_pairs, upsert_env_pairs,
                             section_outdir)
from utils.constants import SERVER_ENV_MAP

"""
Web server artifacts: .env_server updater and optional system-user JSON
rewriter, using values from the 'web server' YAML section.
"""

def update_server_env(ws: dict, yaml_dir: str, setup_files_rel: List[str]) -> str:
    """
    Update/create .env_server using the 'web server' YAML section.

    Also injects 'SETUP_FILES' with the list of generated config paths (relative).
    """

    out_dir = section_outdir(yaml_dir, ws, default="./")
    env_path = os.path.join(out_dir, ".env_server")
    pairs = load_env_to_pairs(env_path)

    updates: Dict[str, str] = {}
    for human_key, v in (ws or {}).items():
        if isinstance(v, dict):  # skip nested sections
            continue
        if strip_markers(human_key).lower().startswith("config directory path"):
            continue
        human_clean = strip_markers(human_key)
        human_any = re.sub(r"\s*\([^)]*\)\s*", "", human_key).strip()
        key_lc, key2_lc = human_clean.lower(), human_any.lower()
        env_key = SERVER_ENV_MAP.get(key_lc) or SERVER_ENV_MAP.get(key2_lc) or upper_snake(human_any or human_clean)
        updates[env_key] = to_env_value(v)

    if setup_files_rel:
        updates["SETUP_FILES"] = ",".join(setup_files_rel)

    pairs = upsert_env_pairs(pairs, updates)
    dump_env_pairs(env_path, pairs)
    return env_path

def update_system_users_json(ws: dict, yaml_dir: str) -> str | None:
    """
    Rewrite seeded system-user JSON if present; return path or None.

    Expected file name: '20211103151730-system-user.json' in the resolved
    server output directory. Entries are replaced, not merged.
    """

    if "system users" not in (ws or {}):
        return None
    out_dir = section_outdir(yaml_dir, ws, default="./")
    json_abs = os.path.join(out_dir, "20211103151730-system-user.json")
    if not os.path.exists(json_abs):
        return None
    with open(json_abs, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["data"] = []
    for _, u in (ws.get("system users") or {}).items():
        data["data"].append({
            "id": str(len(data["data"]) + 1),
            "name": u.get("name", ""),
            "email": u.get("email", ""),
            "password": u.get("password", ""),
            "role": u.get("role", ""),
            "preferences": {}
        })
    with open(json_abs, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)
    return json_abs