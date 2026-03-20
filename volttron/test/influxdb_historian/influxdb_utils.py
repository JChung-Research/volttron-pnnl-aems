import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from influxdb import InfluxDBClient
from zoneinfo import ZoneInfo
import pandas as pd

# ---- Env & defaults (match your current setup) ----
HISTORIAN_ENABLE: bool = os.environ.get('HISTORIAN_ENABLE', 'true').lower() == 'true'
INFLUXDB_DB: Optional[str] = os.environ.get('INFLUXDB_DB', 'test')
INFLUXDB_HOST: str = os.environ.get('INFLUXDB_HOST', 'influxdb')
INFLUXDB_ADMIN_USER: str = os.environ.get('INFLUXDB_ADMIN_USER', 'admin')
INFLUXDB_ADMIN_PASSWORD: str = os.environ.get('INFLUXDB_ADMIN_PASSWORD', 'admin')

# Build once, reuse everywhere
_DB_HOST_MAP: Dict[str, str] = {}
for _pair in os.environ.get('INFLUXDB_DB_HOSTS', '').split(','):
    _pair = _pair.strip()
    if '=' in _pair:
        _db, _host = _pair.split('=', 1)
        _DB_HOST_MAP[_db.strip()] = _host.strip()

# Per-host credential overrides (Version-A compat: INFLUXDB_HOST_2 / _USER_2 / _PASSWORD_2)
_HOST_CREDS: Dict[str, tuple] = {}
_INFLUXDB_HOST_2     = os.environ.get('INFLUXDB_HOST_2', "10.158.174.56").strip()
_INFLUXDB_USER_2     = os.environ.get('INFLUXDB_ADMIN_USER_2', INFLUXDB_ADMIN_USER)
_INFLUXDB_PASSWORD_2 = os.environ.get('INFLUXDB_ADMIN_PASSWORD_2', INFLUXDB_ADMIN_PASSWORD)
if _INFLUXDB_HOST_2:
    _HOST_CREDS[_INFLUXDB_HOST_2] = (_INFLUXDB_USER_2, _INFLUXDB_PASSWORD_2)

_influx_clients: Dict[str, InfluxDBClient] = {}

def _get_or_create_client(host: str) -> InfluxDBClient:
    """Return (and cache) an InfluxDBClient for the given host."""
    if host not in _influx_clients:
        user, pw = _HOST_CREDS.get(host, (INFLUXDB_ADMIN_USER, INFLUXDB_ADMIN_PASSWORD))
        _influx_clients[host] = InfluxDBClient(
            host=host,
            username=user,
            password=pw,
        )
    return _influx_clients[host]

def get_influx_client(dbname: str) -> Optional[InfluxDBClient]:
    """Return the InfluxDBClient for *dbname*, respecting per-DB host overrides."""
    if not HISTORIAN_ENABLE:
        return None
    host = _DB_HOST_MAP.get(dbname, INFLUXDB_HOST)
    return _get_or_create_client(host)

# Legacy single-client alias (for any code that still references it directly)
influx_client: Optional[InfluxDBClient] = None
if HISTORIAN_ENABLE:
    influx_client = _get_or_create_client(INFLUXDB_HOST)

def _cast_field_value(v: Any) -> float:
    """Influx-friendly cast: keep numeric/bool; parse common strings; else None (skip)."""
    if isinstance(v, bool):
        return 1.0 if v else 0.0
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip().lower()
        if s in ('occupied', 'true', '1'):
            return 1.0
        if s in ('unoccupied', 'false', '0'):
            return 0.0
        try:
            return float(s)
        except Exception:
            return None
    return None

def points_from_entries(meas: str,
                        system_id: str,
                        entries: List[Dict[str, Any]],
                        when: datetime) -> List[Dict[str, Any]]:
    """
    Convert AEMS entries (environment+control) to Influx v1 JSON points.
    The entries already carry 'name'/'type'/'unit'—we tag with them.
    """
    pts: List[Dict[str, Any]] = []
    for e in entries:
        val = _cast_field_value(e.get('value'))
        if val is None:
            continue
        pts.append({
            "measurement": meas,
            "time": when,
            "tags": {
                "system_id": system_id,
                "name": e.get("name", ""),
                # "label": e.get("label", ""),
                # "type": e.get("type", ""),
                # "unit": e.get("unit", ""),
            },
            "fields": {"value": val},
        })
    return pts

def to_rfc3339(ts: str) -> str:
    dt = datetime.strptime(ts, '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')

def to_datetime_str(ts: any) -> str:
    dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # return dt.astimezone(ZoneInfo("America/New_York")).strftime('%Y-%m-%d %H:%M:%S')
    return dt.strftime('%Y-%m-%d %H:%M:%S')

def _auto_bucket_interval(start_rfc: str, end_rfc: str) -> str:
    """Choose group-by interval based on requested time range."""
    start_dt = pd.to_datetime(start_rfc, utc=True)
    end_dt = pd.to_datetime(end_rfc, utc=True)
    hours = (end_dt - start_dt).total_seconds() / 3600.0

    if hours <= 6:
        return "5m"
    elif hours <= 24:
        return "15m"
    elif hours <= 24 * 7:
        return "1h"
    else:
        return "2h"  # ~1 month and larger
    
# ----------------- INFLUX DB ROUTING -----------------

def _influx_db_for_measurement(measurement: str) -> str:
    """
    Map measurement/building -> InfluxDB database name.
    - '3147' is stored in DB 'building3147'
    - otherwise use measurement name as DB name (e.g., 'yuma' -> 'yuma')
    """
    m = (measurement or "").strip()
    if m.lower() == "3147":
        return "building3147"
    return m.lower()

def _ensure_influx_database(influx_client, dbname: str, created_dbs: set[str]) -> None:
    """
    Create DB if missing (safe to call repeatedly). Uses caller-provided cache set.
    """
    if not influx_client or not dbname:
        return
    if dbname in created_dbs:
        return

    try:
        influx_client.query(f'CREATE DATABASE "{dbname}"')
        created_dbs.add(dbname)
        print(f"[INFO] ensured InfluxDB database exists: {dbname}")
    except Exception as e:
        print(f"[WARN] could not ensure database '{dbname}': {e}")