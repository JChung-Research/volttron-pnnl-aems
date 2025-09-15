import os, re
from typing import Any, Dict, List, Tuple, Set
from rdflib import Graph, Namespace, RDF, RDFS, URIRef
from utils.general_utils import write_json, strip_markers
from utils.constants import DEFAULTS

"""
Parse a Brick (TTL) model and emit per-zone system config JSON files.

Each output file contains campus/building/system identifiers, a map of
normalized zone point names, and default setpoints.
"""

BRICK = Namespace("https://brickschema.org/schema/Brick#")

def _label_or_local(g: Graph, node: URIRef) -> str:
    """Prefer rdfs:label; otherwise use the trailing URI segment."""

    for lbl in g.objects(node, RDFS.label):
        s = str(lbl).strip()
        if s:
            return s
    s = str(node)
    if "#" in s: return s.rsplit("#", 1)[-1]
    return s.rstrip("/").rsplit("/", 1)[-1]

def _alnum_lower(s: str) -> str:
    """Normalize a string to a compact, lowercase, alphanumeric key."""

    import re as _re
    return _re.sub(r"[^0-9A-Za-z]+", "", str(s)).lower()

POINT_CLASS_TO_CANON = {
    str(BRICK.Supply_Air_Temperature_Setpoint): "SupplyAirSetpoint",
    str(BRICK.Fan_Speed_Command): "SupplyFanSpeed",
    str(BRICK.Cooling_Zone_Air_Temperature_Setpoint): "ZoneAirCoolingSetpoint",
    str(BRICK.Heating_Zone_Air_Temperature_Setpoint): "ZoneAirHeatingSetpoint",
    str(BRICK.Damper_Position_Setpoint): "ZoneDamperPosition",
    str(BRICK.Pump_Command): "ControlStagePump",
    str(BRICK.Heating_Command): "HvacMode",
}

_GENERIC_ZONE_TEMP = str(BRICK.Zone_Air_Temperature_Setpoint)
_GENERIC_ZONE_TEMP_EXPANSION = ("ZoneAirCoolingSetpoint", "ZoneAirHeatingSetpoint")

def _canon_for_point(g: Graph, point: URIRef):
    """Return canonical name(s) for a point. May return a str or a tuple[str, ...]."""
    types = [str(t) for t in g.objects(point, RDF.type)]
    for t in types:
        if t == _GENERIC_ZONE_TEMP:
            return _GENERIC_ZONE_TEMP_EXPANSION
        if t in POINT_CLASS_TO_CANON:
            return POINT_CLASS_TO_CANON[t]
    # return _label_or_local(g, point)


def _collect_feeders(g: Graph, zone: URIRef) -> Set[URIRef]:
    """Collect all equipment that feeds the given zone."""

    feeders, frontier, seen = set(), {zone}, {zone}
    while frontier:
        nxt = set()
        for obj in frontier:
            for src in g.subjects(BRICK.feeds, obj):
                if src not in seen:
                    feeders.add(src); seen.add(src); nxt.add(src)
        frontier = nxt
    return feeders

def generate_configs_from_brick(brick_path: str, out_dir: str) -> List[str]:
    """
    Parse TTL and write per-zone 'config_<campus>-<building>-<zone>.config'.

    Returns:
        List of absolute paths for the JSON files written.
    """

    g = Graph(); g.parse(brick_path, format="turtle")
    outputs: List[str] = []
    sites = list(g.subjects(RDF.type, BRICK.Site))
    buildings = list(g.subjects(RDF.type, BRICK.Building))
    zones = list(g.subjects(RDF.type, BRICK.HVAC_Zone))
    site_parts = {s: set(g.objects(s, BRICK.hasPart)) for s in sites}

    for b in buildings:
        campus = next((s for s, parts in site_parts.items() if b in parts), None)
        campus_name = _label_or_local(g, campus) if campus else "Campus"
        building_name = _label_or_local(g, b)
        building_zones = list(g.objects(b, BRICK.hasPart)) or zones

        for z in building_zones:
            if (z, RDF.type, BRICK.HVAC_Zone) not in g:
                continue
            zone_name = _label_or_local(g, z)
            equip = _collect_feeders(g, z)
            points = {p for e in equip for p in g.objects(e, BRICK.hasPoint)}

            zpn: Dict[str, str] = {}
            for p in points:
                canon = _canon_for_point(g, p)
                if not canon:
                    continue
                if isinstance(canon, (tuple, list, set)):
                    for name in canon:
                        if not name:
                            continue
                        key = _alnum_lower(name)
                        if key:
                            zpn[key] = name
                else:
                    key = _alnum_lower(canon)
                    if key:
                        zpn[key] = canon

            sys_machine = {
                "campus": campus_name,
                "building": building_name,
                "system": zone_name,
                "zone_point_names": zpn
            }

            fname = f"config_{campus_name}-{building_name}-{zone_name}.config"
            out_path = os.path.join(out_dir, fname)
            write_json(out_path, sys_machine)
            outputs.append(out_path)
    return outputs