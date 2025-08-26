import os, re
from typing import Dict
from utils.general_utils import (strip_markers, upper_snake, to_env_value,
                             load_env_to_pairs, dump_env_pairs, upsert_env_pairs,
                             section_outdir)
from utils.constants import CLIENT_ENV_MAP

"""
Web client (.env_client) updater.

Translates human YAML fields to canonical client env keys and upserts them.
"""

def update_client_env(wc: dict, yaml_dir: str) -> str:
    """
    Update/create a .env_client file for the web client.

    Args:
        wc: The 'web client' YAML section (dict).
        yaml_dir: Absolute directory of the YAML file.

    Returns:
        Absolute path to the written .env_client file.
    """

    out_dir = section_outdir(yaml_dir, wc, default="./")
    env_path = os.path.join(out_dir, ".env_client")
    pairs = load_env_to_pairs(env_path)

    updates: Dict[str, str] = {}
    for human_key, v in (wc or {}).items():
        if isinstance(v, dict):  # skip nested sections
            continue
        if strip_markers(human_key).lower().startswith("config directory path"):
            continue
        human_clean = strip_markers(human_key)
        human_any = re.sub(r"\s*\([^)]*\)\s*", "", human_key).strip()
        key_lc, key2_lc = human_clean.lower(), human_any.lower()
        env_key = CLIENT_ENV_MAP.get(key_lc) or CLIENT_ENV_MAP.get(key2_lc) or upper_snake(human_any or human_clean)
        updates[env_key] = to_env_value(v)

    pairs = upsert_env_pairs(pairs, updates)
    dump_env_pairs(env_path, pairs)
    return env_path