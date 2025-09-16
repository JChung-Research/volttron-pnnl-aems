import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from influxdb import InfluxDBClient

# ---- Env & defaults (match your current setup) ----
HISTORIAN_ENABLE: bool = True #os.environ.get('HISTORIAN_ENABLE', 'true').lower() == 'true'
INFLUXDB_DB: Optional[str] = "bems" #os.environ.get('INFLUXDB_DB', 'bems')
INFLUXDB_HOST: str = "localhost", #os.environ.get('INFLUXDB_HOST', 'localhost')
INFLUXDB_ADMIN_USER: str = "admin", #os.environ.get('INFLUXDB_ADMIN_USER', 'admin')
INFLUXDB_ADMIN_PASSWORD: str = "admin", #os.environ.get('INFLUXDB_ADMIN_PASSWORD', 'admin')

# Build once, reuse everywhere
influx_client: Optional[InfluxDBClient] = None
if HISTORIAN_ENABLE:
    influx_client = InfluxDBClient(
        host=INFLUXDB_HOST,
        username=INFLUXDB_ADMIN_USER,
        password=INFLUXDB_ADMIN_PASSWORD,
    )

def _cast_field_value(v: Any) -> Optional[float | bool]:
    """Influx-friendly cast: keep numeric/bool; parse common strings; else None (skip)."""
    if isinstance(v, (int, float, bool)):
        return v
    if isinstance(v, str):
        s = v.strip().lower()
        if s in ('true', 'false'):
            return s == 'true'
        try:
            return float(v)
        except Exception:
            return None
    return None

def _measurement_for(system_id: str) -> str:
    """
    Use building tag as the measurement name to keep Grafana groupings neat.
    Mirrors server logic:
      - contains 'bestest_air'     -> 'bestest_air'
      - contains 'bestest_hydronic'-> 'bestest_hydronic'
      - otherwise                  -> '3147'
    """
    sid = system_id.lower()
    if 'bestest_air' in sid:
        return 'bestest_air'
    if 'bestest_hydronic' in sid:
        return 'bestest_hydronic'
    return '3147'

def points_from_entries(system_id: str,
                        entries: List[Dict[str, Any]],
                        when: datetime) -> List[Dict[str, Any]]:
    """
    Convert AEMS entries (environment+control) to Influx v1 JSON points.
    The entries already carry 'name'/'type'/'unit'—we tag with them.
    """
    meas = _measurement_for(system_id)
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
                "type": e.get("type", ""),
                "unit": e.get("unit", ""),
                "source": "aems-ui",
            },
            "fields": {"value": val},
        })
    return pts