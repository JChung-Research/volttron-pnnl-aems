import os, re, json, yaml
from typing import Any, Dict, List, Tuple

"""
General utilities for string normalization, YAML parsing with inline
key overrides, .env reading/writing, and generic config helpers.

"""

# ---------- String helpers ----------
def strip_markers(s: str) -> str:
    """Remove trailing '*' markers used to denote 'required' human keys."""

    return re.sub(r"\s*\*\s*$", "", (s or "")).strip()

def is_required_key(s: str) -> bool:
    """Return True if a human key is marked required via a trailing '*'."""

    return bool(re.search(r"\s*\*\s*$", s or ""))

def snake_case(s: str) -> str:
    """Convert to snake_case unless the token is already Mixed/CamelCase."""

    s = strip_markers(s)
    if len(s) > 1 and re.search(r"[A-Z]", s[1:]):  # keep Camel/MixedCase
        return s
    s = re.sub(r"[\s\-]+", "_", s)
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s)
    return s.lower()

def upper_snake(s: str) -> str:
    """Convert to UPPER_SNAKE_CASE (non-alnum collapsed to underscores)."""

    s = strip_markers(s)
    s = re.sub(r"[^A-Za-z0-9]+", "_", s.strip())
    return s.strip("_").upper()

def kebab_case(s: str) -> str:
    """Convert to kebab-case (non-alnum collapsed to hyphens)."""

    s = strip_markers(s)
    s = re.sub(r"[^A-Za-z0-9]+", "-", s)
    return s.strip("-").lower()

# ---------- YAML helpers ----------
def parse_inline_key_map(yaml_text: str) -> Dict[Tuple[str, ...], str]:
    """
    Recover inline '# machine_key' annotations that PyYAML drops.

    Returns:
        Mapping from a tuple path of human keys -> explicit machine key.
    """

    path_stack: List[Tuple[int, str]] = []
    mapping: Dict[Tuple[str, ...], str] = {}
    for raw in yaml_text.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        line = raw.rstrip()
        m = re.match(
            r"^\s*([^:#\n]+?):(?:\s*[^#\n]*)?(?:\s*#\s*([A-Za-z_][A-Za-z0-9_\-]*))?\s*$",
            line,
        )
        if not m:
            continue
        human_key_raw, machine_key = m.groups()
        human_key_clean = strip_markers(human_key_raw)
        while path_stack and indent <= path_stack[-1][0]:
            path_stack.pop()
        path_stack.append((indent, human_key_clean))
        if machine_key:
            mapping[tuple(k for _, k in path_stack)] = machine_key
    return mapping

def read_yaml_with_overrides(yaml_path: str):
    """
    Load YAML and derive inline override map + base directory.

    Returns:
        (data, overrides, yaml_dir)
    """

    yaml_text = open(yaml_path, "r", encoding="utf-8").read()
    overrides = {
        k: v
        for k, v in parse_inline_key_map(yaml_text).items()
        if isinstance(v, str) and v.strip()
    }
    data = yaml.safe_load(yaml_text) or {}
    yaml_dir = os.path.dirname(os.path.abspath(yaml_path))
    return data, overrides, yaml_dir

# ---------- Files & ENV helpers ----------
def load_env_to_pairs(path: str) -> List[Tuple[str, str]]:
    """
    Read a .ENV file into ordered (key, value) pairs; preserve comments.

    Non 'key=value' lines are returned with key=="", enabling pass-through.
    """

    pairs: List[Tuple[str, str]] = []
    if not os.path.exists(path):
        return pairs
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if "=" not in line or line.strip().startswith("#"):
                pairs.append(("", line.rstrip("\n")))
                continue
            k, v = line.split("=", 1)
            pairs.append((k.strip(), v.strip()))
    return pairs

def dump_env_pairs(path: str, pairs: List[Tuple[str, str]]) -> None:
    """Write ordered (key, value) pairs back to a .env file (idempotent)."""

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for k, v in pairs:
            f.write((v if k == "" else f"{k}={v}") + "\n")

def _norm_env_key_for_match(k: str) -> str:
    """Normalize env keys to allow relaxed matching (drop common prefixes)."""

    k = k.strip()
    return re.sub(r"^(REACT_|REACT_APP_|APP_|DATABASE_)", "", k)

def upsert_env_pairs(pairs: List[Tuple[str, str]], updates: Dict[str, str]) -> List[Tuple[str, str]]:
    """Replace existing env keys or append if missing; preserve order/comments."""

    exact = {k: i for i, (k, _) in enumerate(pairs) if k}
    relaxed = {}
    for i, (k, _) in enumerate(pairs):
        if k:
            relaxed.setdefault(_norm_env_key_for_match(k), i)
    for want_k, want_v in updates.items():
        if want_k in exact:
            i = exact[want_k]; pairs[i] = (pairs[i][0], want_v); continue
        rk = _norm_env_key_for_match(want_k)
        if rk in relaxed:
            i = relaxed[rk]; pairs[i] = (pairs[i][0], want_v); continue
        pairs.append((want_k, want_v))
    return pairs

def load_lines(path: str) -> List[str]:
    """Load a generic config file as a list of lines; return [] if not found."""

    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return f.read().splitlines()

def write_lines(path: str, lines: List[str]) -> None:
    """Write lines to a file, ensuring parent directory exists."""

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

def update_kv_lines(lines: List[str], updates: Dict[str, str]) -> List[str]:
    """Update 'key = value' lines while preserving whitespace and order."""

    seen = set(); out = []
    for ln in lines:
        m = re.match(r"^(\s*)([^=]+?)(\s*)=(\s*)(.*)$", ln)
        if not m:
            out.append(ln); continue
        pre, key_raw, sp_l, sp_r, _ = m.groups()
        key = key_raw.strip()
        if key in updates:
            out.append(f"{pre}{key}{sp_l}={sp_r}{updates[key]}"); seen.add(key)
        else:
            out.append(ln)
    for k, v in updates.items():
        if k not in seen:
            out.append(f"{k}={v}")
    return out

def to_env_value(v: Any) -> str:
    """Coerce Python scalars to .env string representation."""

    if isinstance(v, bool):
        return "true" if v else "false"
    if v is None:
        return ""
    return str(v)

def ensure_section_header(lines: List[str], section: str = "volttron") -> List[str]:
    """Ensure an INI section header exists at the top; return updated lines."""

    header = f"[{section}]"
    for ln in lines:
        if ln.strip().lower() == header.lower():
            return lines
    return [header] + ([""] if lines else []) + lines

def write_json(path: str, obj: dict) -> None:
    """Write a JSON object to 'path' with pretty indentation."""

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=4)

# ---------- Common section helpers ----------
def section_outdir(yaml_dir: str, section: dict, default: str = "./") -> str:
    """Resolve a section's 'config directory path' relative to the YAML folder.

    Creates the directory if needed and returns the absolute path.
    """

    key = next(
        (k for k in (section or {}) if strip_markers(k).lower().startswith("config directory path")),
        None,
    )
    cfg_dir = (section or {}).get(key) if key else default
    out_dir = os.path.abspath(os.path.join(yaml_dir, cfg_dir))
    os.makedirs(out_dir, exist_ok=True)
    return out_dir