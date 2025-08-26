import re
from typing import Any, Dict, Tuple
from utils.general_utils import strip_markers, snake_case, is_required_key
from utils.constants import BUILDING_UNIT_MAP, DAYS_MAP

"""
Transform/normalize building-unit dictionaries from YAML into machine
keys, plus helpers to normalize schedules and chart configuration blocks.
"""

def _minutes_to_hhmm(m):
    """Convert minutes since midnight to 'H:MM' string; pass through otherwise."""

    try: m = int(m)
    except (TypeError, ValueError): return m
    return f"{m//60}:{m%60:02d}"

def normalize_schedule(sched):
    """Normalize schedule dict: fix weekday names and coerce minutes to 'H:MM'."""

    if not isinstance(sched, dict): return sched
    out = {}
    for day, val in sched.items():
        day_fixed = DAYS_MAP.get(str(day).strip().lower(), str(day))
        if isinstance(val, dict):
            start, end = val.get("start"), val.get("end")
            if isinstance(start, (int, float)) or isinstance(end, (int, float)):
                val = {"start": _minutes_to_hhmm(start), "end": _minutes_to_hhmm(end)}
        out[day_fixed] = val
    return out

def _var_to_canonical(d: dict) -> dict:
    """Map 'variable 1'/'var 1'/'var_1' → 'var_1' and leave others untouched."""

    out = {}
    for k, v in (d or {}).items():
        key = str(k).strip()
        m1 = re.match(r"variable\s+(\d+)$", key, flags=re.I)
        if m1: out[f"var_{m1.group(1)}"] = v; continue
        m2 = re.match(r"var(?:[_\s]+)?(\d+)$", key, flags=re.I)
        if m2: out[f"var_{m2.group(1)}"] = v; continue
        out[key] = v
    return out

def normalize_chart_configs(charts: dict) -> dict:
    """Canonicalize chart config dicts to {chartConfigType, chartSelectVars, chartVizSetting}."""

    if not isinstance(charts, dict): return charts
    norm = {}
    for k, chart in charts.items():
        if not isinstance(chart, dict):
            norm[k] = chart; continue
        ctype = chart.get("chartConfigType") or chart.get("chart_type")
        sel   = chart.get("chartSelectVars") or chart.get("selected_variables")
        viz   = chart.get("chartVizSetting") or chart.get("visualization_setting")
        if isinstance(sel, dict): sel = _var_to_canonical(sel)
        if isinstance(viz, dict): viz = _var_to_canonical(viz)
        norm[k] = {
            **{kk: vv for kk, vv in chart.items()
               if kk not in ("chart_type","selected_variables","visualization_setting",
                             "chartConfigType","chartSelectVars","chartVizSetting")},
            "chartConfigType": ctype,
            "chartSelectVars": sel or {},
            "chartVizSetting": viz or {},
        }
    return norm

def _map_bu_key(human: str) -> str | None:
    """Best-effort human→machine key map for 'building unit' sections."""

    base = strip_markers(human).lower()
    if base in BUILDING_UNIT_MAP: return BUILDING_UNIT_MAP[base]
    m = re.match(r"variable\s+(\d+)$", base)
    if m: return f"var_{m.group(1)}"
    return None

def transform_keys(obj: Any, path: Tuple[str, ...], overrides: Dict[Tuple[str, ...], str]) -> Any:
    """Recursively transform dict keys to machine-friendly names.

    Rules:
      • Use explicit inline '# machine_key' overrides when present.
      • Under 'building unit', map via BUILDING_UNIT_MAP first, then snake_case.
      • Preserve child keys under {'default_setpoints','zone_point_names','data_point'}.
    """

    PRESERVE = {"default_setpoints", "zone_point_names", "data_point"}

    def _machine_for(human_clean: str, new_path: Tuple[str, ...], parent_machine: str | None) -> str:
        if parent_machine in PRESERVE:
            return human_clean
        if path and path[0].lower() == "building unit":
            return _map_bu_key(human_clean) or snake_case(human_clean)
        return overrides.get(new_path) or snake_case(human_clean)

    if isinstance(obj, dict):
        out = {}
        for hk, v in obj.items():
            human_clean = strip_markers(hk)
            new_path = path + (human_clean,)
            parent_machine = overrides.get(path) if path else None
            out[_machine_for(human_clean, new_path, parent_machine)] = transform_keys(v, new_path, overrides)
        return out
    if isinstance(obj, list):
        return [transform_keys(v, path, overrides) for v in obj]
    return obj

def required_machine_keys(human_sys: Dict[str, Any]) -> set[str]:
    """Collect required machine keys from a human system block (marked with '*')."""

    req = set()
    for hk in (human_sys or {}):
        if is_required_key(hk):
            base = strip_markers(hk)
            req.add(_map_bu_key(base) or snake_case(base))
    return req