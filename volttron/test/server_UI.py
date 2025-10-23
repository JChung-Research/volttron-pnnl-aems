import argparse
import threading
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Any, Dict, List, Optional

import pandas as pd
from flask import Flask, request
from flask_restful import Api, Resource
from pandas.tseries.holiday import AbstractHolidayCalendar, Holiday

# --- AEMS / manager modules ---
import sys, os
sys.path.append(os.getenv("AEMS_MANAGER_PATH", "/app/aems-edge/Manager/manager"))
# Reuse the holiday and observance objects from the 'aems-edge' folder
from holiday_utils import ALL_HOLIDAYS, OBSERVANCE
from influxdb_historian.influxdb_utils import *

# ----------------- FLASK APPS -----------------
app_volttron = Flask(__name__)
api_volttron = Api(app_volttron)

app_aems = Flask(__name__)
api_aems = Api(app_aems)

# ----------------- AUTH INFO -----------------
VALID_USERNAME = "admin"
VALID_PASSWORD = "admin"

# ----------------- GLOBAL STATE -----------------
u = {} # Control values for forwarding to the VOLTTRON backend
y = {} # Environmental and control values from VOLTTRON to the AEMS applications
t = {} # Control values for schedules, holidays, occupancy override
u_uo = {} # Control values for unoccuppied zone temperature setpoints
u_o = {} # Control values for occupied zone temperature setpoints
o = {} # Occupancy values for each building system / zone

# u: Control values for forwarding to the VOLTTRON backend
# y: Environmental and control values from VOLTTRON to the AEMS applications
# t: Control values for schedules, holidays, occupancy override
# u_o/u_uo: Control values for occupied/unoccupied zone temperature setpoints
# o: occupancy state per system_id ("occupied"/"unoccupied")
u: Dict[str, Dict[str, Any]] = {}
y: Dict[str, List[Dict[str, Any]]] = {}
t: Dict[str, Dict[str, Any]] = {}
u_uo: Dict[str, Dict[str, Any]] = {}
u_o: Dict[str, Dict[str, Any]] = {}
o: Dict[str, str] = {}

# logical clock used for schedule/holiday checks
timestamp = datetime.now(timezone.utc)
time_accelerator = False # Accelerate the time step to 5 min (same as the time step of the BOPTEST emulation), otherwise the time step is 5 second

# ----------------- DATA CONVERSION TOOL -----------------

data_mapping: Dict[str, Dict[str, Any]] = {
    # --- FRP2 (sensor) ---
    'T_OA': {
        "building": "FRP2",
        "name": "OutdoorTemperature",
        "label": "Outdoor air temperature",
        "type": "sensor",
        "unit": "°F"
    },
    'Flowrate_RTU': {
        "building": "FRP2",
        "name": "SupplyAirflowRateRTU",
        "label": "Supply air mass flow rate of RTU unit",
        "type": "sensor",
        "unit": "CFM"
    },
    'Flowrate_VAV': {
        "building": "FRP2",
        "name": "SupplyAirflowRateVAV",
        "label": "Supply air mass flow rate of VAV unit",
        "type": "sensor",
        "unit": "CFM"
    },
    'T_inlet': {
        "building": "FRP2",
        "name": "SupplyAirTemperatureInlet",
        "label": "Inlet supply air temperature",
        "type": "sensor",
        "unit": "°F"
    },
    'T_outlet_VAV': {
        "building": "FRP2",
        "name": "SupplyAirTemperatureVAV",
        "label": "Outlet supply air temperature",
        "type": "sensor",
        "unit": "°F"
    },
    'W_inlet': {
        "building": "FRP2",
        "name": "HumidityInlet",
        "label": "Inlet air humidity",
        "type": "sensor",
        "unit": "%"
    },
    'T_zone': {
        "building": "FRP2",
        "name": "ZoneAirTemperature",
        "label": "Zone air temperature",
        "type": "sensor",
        "unit": "°F"
    },
    'W_zone': {
        "building": "FRP2",
        "name": "HumidityZone",
        "label": "Zone air humidity",
        "type": "sensor",
        "unit": "%"
    },

    # --- bestest_air ---
    "fcu_oveFan_u": {
        "building": "bestest_air",
        "name": "SupplyFanSpeed",
        "label": "Supply fan Speed",
        "type": "control",
        "unit": "[0-1]"
    },
    "fcu_oveTSup_u": {
        "building": "bestest_air",
        "name": "SupplyAirSetpoint",
        "label": "Supply air temperature setpoint",
        "type": "control",
        "unit": "°F"
    },
    "con_oveTSetCoo_u": {
        "building": "bestest_air",
        "name": "ZoneAirCoolingSetpoint",
        "label": "Zone temperature setpoint for cooling",
        "type": "control",
        "unit": "°F"
    },
    "con_oveTSetHea_u": {
        "building": "bestest_air",
        "name": "ZoneAirHeatingSetpoint",
        "label": "Zone temperature setpoint for heating",
        "type": "control",
        "unit": "°F"
    },
    "fcu_reaFloSup_y": {
        "building": "bestest_air",
        "name": "SupplyAirflowRate",
        "label": "Supply air mass flow rate",
        "type": "sensor",
        "unit": "kg/s"
    },
    "zon_reaCO2RooAir_y": {
        "building": "bestest_air",
        "name": "ZoneCo2Concentration",
        "label": "Zone air CO2 concentration",
        "type": "sensor",
        "unit": "ppm"
    },
    "zon_reaTRooAir_y": {
        "building": "bestest_air",
        "name": "ZoneAirTemperature",
        "label": "Zone air temperature",
        "type": "sensor",
        "unit": "°F"
    },
    "fcu_reaPFan_y": {
        "building": "bestest_air",
        "name": "SupplyFanPowerConsumption",
        "label": "Supply fan power consumption",
        "type": "sensor",
        "unit": "W"
    },
    "fcu_reaPCoo_y": {
        "building": "bestest_air",
        "name": "CoolingPowerConsumption",
        "label": "Cooling power consumption",
        "type": "sensor",
        "unit": "W"
    },
    "fcu_reaPHea_y": {
        "building": "bestest_air",
        "name": "HeatingPowerConsumption",
        "label": "Heating power consumption",
        "type": "sensor",
        "unit": "W"
    },

    # --- bestest_hydronic ---
    "oveTSetSup_u": {
        "building": "bestest_hydronic",
        "name": "SupplyHeaterSetpoint",
        "label": "Supply setpoint of the heater",
        "type": "control",
        "unit": "°F"
    },
    "ovePum_u": {
        "building": "bestest_hydronic",
        "name": "ControlStagePump",
        "label": "Control signal to control pump stage",
        "type": "control",
        "unit": "on/off"
    },
    "oveTSetCoo_u": {
        "building": "bestest_hydronic",
        "name": "ZoneOperativeCoolingSetpoint",
        "label": "Zone temperature setpoint for cooling",
        "type": "control",
        "unit": "°F"
    },
    "oveTSetHea_u": {
        "building": "bestest_hydronic",
        "name": "ZoneOperativeHeatingSetpoint",
        "label": "Zone temperature setpoint for heating",
        "type": "control",
        "unit": "°F"
    },
    "reaCO2RooAir_y": {
        "building": "bestest_hydronic",
        "name": "ZoneCo2Concentration",
        "label": "CO2 concentration in the zone",
        "type": "sensor",
        "unit": "ppm"
    },
    "reaTRoo_y": {
        "building": "bestest_hydronic",
        "name": "ZoneOperativeTemperature",
        "label": "Operative zone temperature",
        "type": "sensor",
        "unit": "°F"
    },
    "reaPPum_y": {
        "building": "bestest_hydronic",
        "name": "PumpPowerConsumption",
        "label": "Pump power consumption",
        "type": "sensor",
        "unit": "W"
    },
    "reaQHea_y": {
        "building": "bestest_hydronic",
        "name": "HeatingPowerConsumption",
        "label": "Heating power consumption",
        "type": "sensor",
        "unit": "W"
    },

    # --- 3147 ---
    "ZoneTemperature": {
        "building": "3147",
        "name": "ZoneAirTemperature",
        "label": "Zone air temperature",
        "type": "sensor",
        "unit": "°F"
    },
    "desiredHeat": {
        "building": "3147",
        "name": "ZoneAirHeatingSetpoint",
        "label": "Zone temperature setpoint for heating",
        "type": "control",
        "unit": "°F"
    },
    "desiredCool": {
        "building": "3147",
        "name": "ZoneAirCoolingSetpoint",
        "label": "Zone temperature setpoint for cooling",
        "type": "control",
        "unit": "°F"
    },
    "HVACMode": {
        "building": "3147",
        "name": "HVACMode",
        "label": "HVAC mode",
        "type": "control",
        "unit": "bool"
    },
    "power_hvac1": {
        "building": "3147",
        "name": "PowerHVAC1",
        "label": "Electric Power of HVAC 1",
        "type": "sensor",
        "unit": "W"
    },
    "power_hvac2": {
        "building": "3147",
        "name": "PowerHVAC2",
        "label": "Electric Power of HVAC 2",
        "type": "sensor",
        "unit": "W"
    },
    "power_hvac3": {
        "building": "3147",
        "name": "PowerHVAC3",
        "label": "Electric Power of HVAC 3",
        "type": "sensor",
        "unit": "W"
    },
    "power": {
        "building": "3147",
        "name": "EquipmentPower",
        "label": "Electric Power of the Room Equipment",
        "type": "sensor",
        "unit": "W"
    },
    "voltage": {
        "building": "3147",
        "name": "EquipmentVoltage",
        "label": "Voltage of the Room Equipment",
        "type": "sensor",
        "unit": "V"
    },
    "current": {
        "building": "3147",
        "name": "EquipmentElectricCurrent",
        "label": "Electric Current of the Room Equipment",
        "type": "sensor",
        "unit": "A"
    },
    "power_factor": {
        "building": "3147",
        "name": "EquipmentPowerFactor",
        "label": "Electric Power Factor of the Room Equipment",
        "type": "sensor",
        "unit": "[0-1]"
    },
    # --- shared ---
    "occupancy": {
        "building": "all",
        "name": "Occupancy",
        "label": "Occuapncy",
        "type": "occupancy",
        "unit": "bool"
    }
}

def _write_influx_for_systems(sys_keys: list[str]):
    """Write the current y[] snapshot (plus Occupancy) for each system in system_data."""
    if not HISTORIAN_ENABLE or not influx_client or not INFLUXDB_DB:
        return

    all_points = []
    for key in sys_keys:
        system_id = f"manager.{key}"
        entries = y.get(system_id, [])

        # Append Occupancy as 1/0 for easy plotting
        occ = data_mapping['occupancy'].copy()
        occ['value'] = 1.0 if o.get(system_id, 'unoccupied') == 'occupied' else 0.0
        entries_with_occ = list(entries) + [occ]

        all_points += points_from_entries(system_id, entries_with_occ, timestamp)

    if all_points:
        try:
            print("all_points: ", all_points)
            ok = influx_client.write_points(points=all_points, time_precision='s', database=INFLUXDB_DB)
            if not ok:
                print(f"[WARN] Influx write unsuccessful. Points: {len(all_points)}")
        except Exception as ex:
            print(f"[WARN] Influx write failed: {ex}")


# ----------------- HELPERS -----------------
def building_of(system_id: str) -> str:
    """Return mapping tag for the given system_id."""
    sid = system_id.lower()
    if 'bestest_air' in sid: # Single-zone building
        return 'bestest_air'
    if 'bestest_hydronic' in sid: # Single-zone building
        return 'bestest_hydronic'
    return '3147'


# ----------------- AEMS STRUCTURERS -----------------
def restructure_sensor_data_by_zone(raw_zone_data: Dict[str, Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Convert raw sensor data by zone into structured AEMS-style list of dictionaries.
    
    Args:
        raw_zone_data (dict): Raw sensor data structured by zone ID.
        
    Returns:
        dict: Restructured data by zone, formatted as AEMS-style sensor entries.
    """

    output: Dict[str, List[Dict[str, Any]]] = {}
    
    for system_id, sensors in raw_zone_data.items():
        structured: List[Dict[str, Any]] = []
        for var, value in sensors.items():           
            meta = data_mapping.get(var)
            if not meta:  # skip unknown points defensively
                continue
            entry = meta.copy()
            entry["value"] = value
            structured.append(entry)
        # output[f"manager.zone-{system_id}"] = structured
        output[f"manager.{system_id}"] = structured

    return output


def restructure_control_data(control_dict: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Converts flat control input dictionary into AEMS-style structured list format.
    
    Args:
        control_dict (dict): Dictionary of control parameters and their values.
    
    Returns:
        list[dict]: AEMS-style list of structured control entries.
    """
    
    output: List[Dict[str, Any]] = []
    for key, value in control_dict.items():
        matched = next(
            (d for d in data_mapping.values() if d.get("type") == "control" and d.get("name") == key),
            None
        )

        if matched:
            output.append({
                "name": matched["name"],
                "label": matched["label"],
                "type": matched["type"],
                "value": value,
                "unit": matched["unit"]
            })

    return output

# ----------------- UPDATE Y VARIABLE -----------------
def update_zone_environment(y_: Dict[str, List[Dict[str, Any]]],
                            y_env_data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Updates the 'sensor' entries for each system (zone) in the global 'y' dictionary.

    Args:
        y_ (dict): The existing y variable (global zone data).
        y_env_data (dict): New environmental data structured by system ID.

    Returns:
        dict: The updated y dictionary.
    """

    y_env_manager_id = next(iter(y_env_data)).removeprefix("manager.")
    y_env_building = building_of(y_env_manager_id)

    for system_id, new_env_list in y_env_data.items():
        if system_id in y_:
            # For fast lookup: map existing sensor name to item dict
            env_name_object = {item['name']: item for item in y_[system_id] if item.get("type") == "sensor"}

            # Update existing sensor values or append as new if not found
            for entry in new_env_list:
                entry_name = entry.get("name")
                if entry_name in list(env_name_object.keys()):
                    env_name_object.get(entry_name)["value"] = entry.get("value")
                else:
                    y_[system_id].append(entry.copy())

        elif system_id.removeprefix("manager.") == 'bacnet':
            # Updates HVAC energy data of all zones within the same building as `y_env_building`
            new_values = {entry['name']: entry['value'] for entry in new_env_list}
            for y_system_id, entries in y_.items():
                # Skip zones not belonging to the target building                
                if building_of(y_system_id.removeprefix("manager.")) != y_env_building:
                    continue

                # Update matching sensor values
                for entry in entries:
                    if entry.get("type") == "sensor" and entry.get("name") in new_values:
                        entry['value'] = new_values[entry['name']]

                # Append any missing sensor entries
                existing_names = {entry["name"] for entry in entries if isinstance(entry, dict) and "name" in entry}
                to_add = [entry.copy() for entry in new_env_list
                        if entry.get("type") == "sensor" and entry["name"] not in existing_names]
                if to_add:
                    entries.extend(to_add)
        else:
            # If zone doesn't exist — create with new environmental data
            y_[system_id] = new_env_list.copy()

    return y_

def update_zone_controls(y_: Dict[str, List[Dict[str, Any]]],
                         system_id: str,
                         control_data: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Updates the 'control' entries for a given system (zone) in the 'y' dictionary.
    
    Args:
        y_ (dict): The existing y variable (global zone data).
        system_id (str): System ID like "manager.bestest_air".
        control_data (list): List of control entries from AEMS.
        
    Returns:
        dict: The updated y dictionary.
    """

    if system_id in y_:
        # Create a mapping from name to value in new_env_list
        new_values = {entry['name']: entry['value'] for entry in control_data if entry.get("type") == "control"}
        
        # Update values in existing list if the name matches
        for entry in y_[system_id]:
            if entry['name'] in new_values:
                entry['value'] = new_values[entry['name']]
        
        
    else:
        # Zone doesn't exist: create it with control entries
        y_[system_id] = control_data.copy()

    return y_

# ----------------- SCHEMA DEFINITIONS -----------------
class Params:
    def __init__(self, authentication=None, data=None, **kwargs):
        self.authentication = authentication
        self.data = data or {}

class JSONRPCRequest:
    def __init__(self, jsonrpc=None, _id=None, method=None, params=None, **kwargs):
        self.jsonrpc = jsonrpc
        self.id = _id                # Manager Agent ID (e.g., 'manager.four-pipe-fcu-1')
        self.method = method         # JSON-RPC method (e.g., 'get_temperature_setpoints')
        self.params = params         # Authentication flag and data payload (e.g., {authentication: token, data: data})

# ------------- READ SENSOR DATA FROM VOLTTRON -------------
def get_temperature_setpoints(system_id: str, time_range: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:

    """
    Simulates control setpoints and environmental readings for different BOPTEST test cases.
    Used as a placeholder for VOLTTRON/BOPTEST integration.

    Args:
        system_id (str): System ID like "manager.bestest_air".
        start_time (str | None): Start time in 'YYYY-MM-DD HH:MM:SS' (UTC).
        end_time (str | None): End time in 'YYYY-MM-DD HH:MM:SS' (UTC).
    
    Returns:
        list[dict]: Emulated or actual sensor readings / control signals for that system
    """
    try:
        if isinstance(time_range, dict):
            if time_range.get("start_time"):
                start_time = time_range["start_time"]
            if time_range.get("end_time"):
                end_time = time_range["end_time"]

        measurement = building_of(system_id)  # 'bestest_air' | 'bestest_hydronic' | '3147'
        # start_time = start_time or (timestamp - timedelta(hours=6)).strftime('%Y-%m-%d %H:%M:%S')
        # end_time = end_time or timestamp.strftime('%Y-%m-%d %H:%M:%S')
        # start_time = datetime(2025, 9, 21, 19, 00, 0, tzinfo=timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        # end_time = datetime(2025, 9, 22, 5, 59, 0, tzinfo=timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        start_rfc = to_rfc3339(start_time)
        end_rfc = to_rfc3339(end_time)
    except Exception as e:
        print(f"[WARN] : {e}")

    # Pull all points in the window for this system_id, grouped by signal name.
    q = (
        f'SELECT "value" FROM "{measurement}" '
        f'WHERE "system_id"=\'{system_id}\' AND time >= \'{start_rfc}\' AND time <= \'{end_rfc}\' '
        f'GROUP BY "name"'
    )    

    res = influx_client.query(q, database=INFLUXDB_DB)
    print("res: ", res)

    entries: List[Dict[str, Any]] = []
    for (_series_key, tags), points in res.items():
        if not points:
            continue

        name = (tags or {}).get("name", "")
        if not name:
            continue  # need 'name' to enrich from data_mapping

        # Enrich from data_mapping (label/type/unit not stored in Influx)
        meta = next((m for m in data_mapping.values() if m.get("name") == name), None)
        label = meta.get("label", name) if meta else name
        typ   = meta.get("type", "")     if meta else ""
        unit  = meta.get("unit", "")     if meta else ""

        history = [{"time": to_datetime_str(p.get("time")), "value": p.get("value")} for p in points if "value" in p]
        current_val = history[-1]["value"] if history else None

        if name == "Occupancy":
            current_val = "occupied" if float(current_val) == 1.0 else "unoccupied" if float(current_val) == 0.0 else current_val
            for h in history:
                v = h.get("value")
                h["value"] = "occupied" if float(v) == 1.0 else "unoccupied" if float(v) == 0.0 else v
        # elif name == "HVACMode":
        #     current_val = "occupied" if float(current_val) == 1.0 else "unoccupied" if float(current_val) == 0.0 else current_val
        #     for h in history:
        #         v = h.get("value")
        #         h["value"] = "occupied" if float(v) == 1.0 else "unoccupied" if float(v) == 0.0 else v          

        entries.append({
            "name": name,
            "label": label,
            "type": typ,
            "value": current_val,
            "unit": unit,
            "history": history
        })

    return entries

# ------------------ VOLTTRON AGENTS CONTROLLER ---------------
def set_temperature_setpoints(system_id: str, control_signals: Dict[str, Any]) -> Dict[str, Any]:
    """`    
    Updates control data in 'y' and sends control signals to the physical/emulated backend (e.g., BOPTEST).

    Args:
        y_ (dict): Current global y dictionary (zone data)
        system_id (str): System ID like "manager.bestest_air".
        control_signals (dict): Control setpoints as flat dictionary (e.g., {"SupplyFanSpeed": 0.8})
    
    Returns:
        tuple: (response dict, updated y dict)
    """    
    print("set_temperature_setpoints: ", control_signals)
    try:
        global u, u_o, u_uo, y

        # Update AEMS-structured y first
        control_data = restructure_control_data(control_signals)
        y = update_zone_controls(y, system_id, control_data)

        bldg = building_of(system_id)
        name_to_key = {
            v["name"]: k 
            for k, v in data_mapping.items()
            if v.get("type") == "control" and v.get("building") in (bldg, "all")
        }
        u[system_id] = {name_to_key[k]: v for k, v in control_signals.items() if k in name_to_key}
        u_o[system_id] = {k: v for k, v in control_signals.items() if k in ['ZoneAirCoolingSetpoint', 'ZoneAirHeatingSetpoint', 'ZoneOperativeCoolingSetpoint', 'ZoneOperativeHeatingSetpoint']}
        u_uo[system_id] = {k: v for k, v in control_signals.items() if k in ['UnoccupiedCoolingSetPoint', 'UnoccupiedHeatingSetPoint']}

    except Exception as e:
        return {'status': 400, 'message': f'Unexpected input: {str(e)}', 'payload': None}
    return {'status':200, 'message':'Success', 'payload':y}


# -------------- OCCUPANCY / HOLIDAY / SCHEDULE CONTROLLER --------------
def set_holidays(system_id: str, holidays: Dict[str, Dict[str, Any] | None]) -> Dict[str, Any]:

    """
    Set holiday schedule for a given system_id using static and custom holidays.

    Args:
        system_id (str): System ID like "manager.bestest_air".
        holidays (dict): {holiday_name: {} or {month, day, observance}}

    Returns:
        dict: Holiday list stored in `u[system_id]['holidays']`
    """
    try:
        global t
        t.setdefault(system_id, {'occupancies': {}, 'holidays': [], 'schedules': {}})

        year = datetime.today().year
        start_date = datetime(year, 1, 1)
        end_date = datetime(year, 12, 31)

        holiday_rules = []
        for name, params in holidays.items():
            if not params and name in ALL_HOLIDAYS:
                holiday_rules.append(ALL_HOLIDAYS[name])
            elif isinstance(params, dict):
                try:
                    month = int(params.get('month'))
                    day = int(params.get('day'))
                    obs_key = params.get('observance', '').lower().replace(" ", "_")
                    observance = OBSERVANCE.get(obs_key)
                    rule = Holiday(name, month=month, day=day, observance=observance)
                    holiday_rules.append(rule)
                except Exception as e:
                    print(f"[WARNING] Failed to create holiday '{name}': {e}")
            else:
                print(f"[WARNING] Skipped unrecognized holiday: {name}")

        # Create a temporary holiday calendar with these rules        
        TempCalendar = type("TempCalendar", (AbstractHolidayCalendar,), {"rules": holiday_rules})

        holiday_dates = pd.to_datetime(TempCalendar().holidays(start=start_date, end=end_date)).sort_values().unique()

        t[system_id]["holidays"] = [str(date.date()) for date in holiday_dates]
        print(f"\nSet holidays for {system_id}: {t[system_id]['holidays']}")
        
    except Exception as e:
        return {'status': 400, 'message': f'Unexpected input: {str(e)}', 'payload': None}
    return {'status': 200, 'message': 'Success', 'payload': t[system_id]}


def set_schedule(system_id: str, schedules: Dict[str, Any]) -> Dict[str, Any]:
    """
    Set a weekly schedule for the given system_id and store it in `t`.

    Args:
        system_id (str): System ID like "manager.bestest_air".
        schedule (dict): Weekly schedule with either time range or "always_off".

    Returns:
        dict: API-style response with stored schedule.
    """
    try:
        global t
        t.setdefault(system_id, {'occupancies': {}, 'holidays': [], 'schedules': {}})

        parsed_schedule: Dict[str, Any] = {}

        # Ensure keys like Monday, Tuesday... are normalized
        for day, value in schedules.items():
            day_cap = day.capitalize()
            if isinstance(value, dict):
                # Validate time strings
                _ = datetime.strptime(value["start"], "%H:%M")
                _ = datetime.strptime(value["end"], "%H:%M")
                parsed_schedule[day_cap] = {
                    "start": value["start"],
                    "end": value["end"]
                }
            elif value == "always_off":
                parsed_schedule[day_cap] = "always_off"
            elif value == "always_on":
                parsed_schedule[day_cap] = "always_oN"
            else:
                raise ValueError(f"Invalid value for {day}: {value}")

        t[system_id]["schedules"] = parsed_schedule
        print(f"\nSet schedules for {system_id}: {t[system_id]['schedules']}")

    except Exception as e:
        return {'status': 400, 'message': f'Unexpected input: {str(e)}', 'payload': None}
    return {'status': 200, 'message': 'Success', 'payload': t[system_id]['schedules']}


def set_occupancy_override(system_id: str, occupancies: Dict[str, List[Dict[str, str]]]) -> Dict[str, Any]:
    """
    Sets manual occupancy override schedules for a zone/system and stores it under `t`.

    Args:
        system_id (str): System ID like 'manager.bestest_air'
        occupancies (dict): Dict with dates as keys and list of {start, end} dicts as values.

    Returns:
        dict: Updated occupancy override info.
    """
    try:
        global t
        t.setdefault(system_id, {'occupancies': {}, 'holidays': [], 'schedules': {}})

        parsed_occupancies: Dict[str, List[Dict[str, str]]] = {}

        for day, value in occupancies.items():
            try:
                datetime.strptime(day, "%Y-%m-%d")  # Validate date format
            except ValueError:
                raise ValueError(f"Invalid date format: {day}. Expected YYYY-MM-DD.")

            parsed_periods = []
            for v in value:
                try:
                    # Validate time strings
                    datetime.strptime(v["start"], "%H:%M")
                    datetime.strptime(v["end"], "%H:%M")
                    parsed_periods.append({"start": v["start"], "end": v["end"]})
                except Exception as e:
                    raise ValueError(f"Invalid time format in date {day}: {e}")

            parsed_occupancies[day] = parsed_periods

        t[system_id]["occupancies"] = parsed_occupancies
        print(f"\nSet override occupancies for {system_id}: {t[system_id]['occupancies']}")

    except Exception as e:
        return {'status': 400, 'message': f'Unexpected input: {str(e)}', 'payload': None}
    return {'status': 200, 'message': 'Success', 'payload': t[system_id]["occupancies"]}


def get_current_occupancy_state(system_id: str, t_state: Dict[str, Any]) -> str:
    """
    Check current occupancy state based on occupancy overrides, holidays, and schedules.

    Args:
        system_id (str): System ID like "manager.bestest_air".

    Returns:
        str: "occupied" or "unoccupied"
    """

    ts = timestamp if getattr(timestamp, "tzinfo", None) else timestamp.replace(tzinfo=timezone.utc)
    est_ts = ts.astimezone(ZoneInfo("America/New_York"))

    today_str = est_ts.strftime("%Y-%m-%d")
    current_time = est_ts.time()

    # 1. Check manual occupancy overrides
    occupancies = t_state.get(system_id, {}).get("occupancies", {})
    for entry in occupancies.get(today_str, []):
        start = datetime.strptime(entry["start"], "%H:%M").time()
        end = datetime.strptime(entry["end"], "%H:%M").time()
        print("start, current, end: ", start, current_time, end)
        if start <= current_time <= end:
            return "occupied"

    # 2. Check holiday
    if today_str in t_state.get(system_id, {}).get("holidays", []):
        return "unoccupied"

    # 3. Check weekly schedule
    weekday = timestamp.strftime("%A")  # 'Monday', 'Tuesday', ...
    schedule = t_state.get(system_id, {}).get("schedules", {}).get(weekday)

    if schedule == "always_off":
        return "unoccupied"
    elif schedule == "always_on":
        return "occupied"

    if isinstance(schedule, dict):
        try:
            start = datetime.strptime(schedule["start"], "%H:%M").time()
            end = datetime.strptime(schedule["end"], "%H:%M").time()
            if start <= current_time <= end:
                return "occupied"
        except Exception as e:
            print(f"[WARNING] Invalid schedule format for {weekday}: {e}")

    # Default to unoccupied
    return "unoccupied"


# ----------------- AUTHENTICATION ENDPOINT -----------------
class auth(Resource):

    """
    Authenticates incoming AEMS clients prior to JSON-RPC interaction.

    Example code to access this endpoint (JavaScript):
    
    await fetch("https://localhost:8443/auth", {
        method: "POST",
        body: JSON.stringify({ username: "admin", password: "admin" }),
    });
    
    """
    def post(self):
        body = request.get_json()
        username = body.get("username")
        password = body.get("password")
        
        # It could be replaced with secure token-based authentication
        if username == VALID_USERNAME and password == VALID_PASSWORD:
            return {"access_token": True}
        else:
            return {"access_token": False}


# ----------------- BUILDING CONTROL (VOLTTRON -> UI) -----------------
class building_control(Resource):
    """
    Receives and processes environmental data updates from the building/emulation layer.
    """

    def put(self):        
        try:
            global y, u, u_uo, t, o, timestamp

            body = request.get_json()
            body_data = body[0]
            body_meta = body[1]

            print("body_data: ", body_data)
            print("body_meta: ", body_meta)
            first_key = next(iter(body_data))
            system_data = body_data.get(first_key) if first_key in ['ecobee', 'modbus'] else body_data
            print("system_data: ", system_data)

            # Update sensor entries in y
            y_env = restructure_sensor_data_by_zone(system_data)            
            y = update_zone_environment(y, y_env) 

            print("y_env: ", y_env)
            print("y: ", y)

            # Per-system updates (defaults, occupancy replacement, and mirrored y)
            for key in system_data.keys():
                if key == 'bacnet':
                    continue
                # system_id = f"manager.zone-{key}"
                system_id = f"manager.{key}"
                control_signals = system_data[key]

                # These default values will be replaced with the values from configuration files in the next updates
                u.setdefault(system_id, {key: value for key, value in control_signals.items() if data_mapping[key]["type"] == "control"})
                u_o.setdefault(system_id, {'ZoneOperativeCoolingSetpoint': 80, 'ZoneOperativeHeatingSetpoint': 60, 'ZoneAirCoolingSetpoint': 80, 'ZoneAirHeatingSetpoint': 60})
                u_uo.setdefault(system_id, {'UnoccupiedCoolingSetPoint': 80, 'UnoccupiedHeatingSetPoint': 60})
                t.setdefault(system_id, {'occupancies': {}, 'holidays': ['2025-01-01', '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-27', '2025-11-28', '2025-12-24', '2025-12-25'], 'schedules': {'Monday': {'start': '06:30', 'end': '18:00'}, 'Tuesday': {'start': '06:30', 'end': '18:00'}, 'Wednesday': {'start': '06:30', 'end': '18:00'}, 'Thursday': {'start': '06:30', 'end': '18:00'}, 'Friday': {'start': '06:30', 'end': '18:00'}, 'Saturday': 'always_off', 'Sunday': 'always_off'}})
                o.setdefault(system_id, 'unoccupied')

                # Check if holiday, schedule, and occupancy informaion is available.
                if system_id not in t or not all(k in t[system_id] for k in ["holidays", "schedules", "occupancies"]):
                    print("[INFO] Holiday, schedule, and occupancy information is currently unavailable.")
                
                else:                    
                    # Check an occupancy state at the current time
                    current_state = get_current_occupancy_state(system_id, t)
                    o[system_id] = current_state
                    print(f"[INFO] System '{system_id}' is currently: {current_state}")
                    
                    target_names = {
                        "ZoneAirCoolingSetpoint",
                        "ZoneAirHeatingSetpoint",
                        "ZoneOperativeCoolingSetpoint",
                        "ZoneOperativeHeatingSetpoint"
                    }

                    for key in u[system_id]:
                        setpoint_name = data_mapping[key]["name"]
                        if setpoint_name in target_names:
                            # Replace occupied temperature setpoints with unoccupied temperature setpoints within global u variable, vice versa
                            if current_state == "unoccupied":
                                if 'Cooling' in setpoint_name:
                                    u[system_id][key] = u_uo[system_id]['UnoccupiedCoolingSetPoint']
                                elif 'Heating' in setpoint_name:
                                    u[system_id][key] = u_uo[system_id]['UnoccupiedHeatingSetPoint']
                            else:
                                u[system_id][key] = u_o[system_id][setpoint_name]
            
                    # Update y controls from u (rename driver keys -> AEMS names)
                    renamed_data = {
                        data_mapping[key]["name"]: value
                        for key, value in u[system_id].items()
                    }

                    # Update global y variable
                    control_data = restructure_control_data(renamed_data)
                    y = update_zone_controls(y, system_id, control_data)


            if first_key in ['bacnet', 'modbus']: # Only update global environmental data and skip updating global control data
                updated_u = {} ; system_data = {}
            elif first_key == 'ecobee':
                # updated_u = {key: u[f"manager.zone-{key}"] for key in system_data.keys() if f"manager.zone-{key}" in u.keys()}
                updated_u = {key: u.get(f"manager.{key}") for key in system_data.keys() if f"manager.{key}" in u.keys()}
            else:
                # updated_u = next((v for k, v in u.items() if k in [f"manager.zone-{key}" for key in system_data.keys()]), None)
                updated_u = next((v for k, v in u.items() if k in [f"manager.{key}" for key in system_data.keys()]), None)

            if time_accelerator:  
                global timestamp               
                timestamp += timedelta(minutes=2.5)
            else:
                timestamp = datetime.now(timezone.utc)

            # Persist to InfluxDB (same version & pattern as Alfalfa)
            try:
                # print("body: ", body)
                # print("system_data: ", system_data)
                if system_data != {} : _write_influx_for_systems(list(system_data.keys())) 
            except Exception as e:
                print(f"[WARN] Influx logging skipped due to error: {e}")

        except Exception as e:
            return {'status': 400, 'message': f'Unexpected input: {str(e)}', 'payload': None}
        return {'status':200, 'message':'Success', 'payload': updated_u}
        

# ----------------- JSON-RPC INTERFACE -----------------
class ui_control(Resource):

    """
    Receives JSON-RPC requests from AEMS.

    Supported Methods:
    - get_temperature_setpoints: Returns current environmental + control values
    - set_temperature_setpoints: Updates control values and forwards them to backend

    Returns:
        JSON-RPC-compliant dict with result and metadata
    """

    jsonrpc_to_ignore = ["set_optimal_start", "set_location", "set_configurations"]

    def post(self):
        body = request.get_json()
        try:
            params = Params(**body["params"])
            req = JSONRPCRequest(
                jsonrpc=body.get("jsonrpc"),
                _id=body.get("id"),
                method=body.get("method"),
                params=params
            )
        except Exception as e:
            return {'status': 400, 'message': f'Invalid input: {str(e)}', 'payload': None}

        # currentTimestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        if not req.params or not req.params.authentication:
            return {'status': 401, 'message': 'Unauthorized', 'payload': None}

        try:
            print(f"req.id: {req.id}, req.method: {req.method}")
            print("req.params.data: ", req.params.data)
            if req.method == "get_temperature_setpoints":
                payload = get_temperature_setpoints(req.id, req.params.data)# if (len(y) > 0) elsaee None
            elif req.method == "set_temperature_setpoints":
                payload = set_temperature_setpoints(req.id, req.params.data)
            elif req.method == "set_holidays":
                payload = set_holidays(req.id, req.params.data)
            elif req.method == "set_schedule":
                payload = set_schedule(req.id, req.params.data)
            elif req.method == "set_occupancy_override":
                payload = set_occupancy_override(req.id, req.params.data)
            elif req.method in self.jsonrpc_to_ignore:
                payload = {}
            else:
                return {'status': 400, 'message': f'Unexpected input: {e}', 'payload': None}
        except Exception as e:
            return {'status': 401, 'message': 'Unauthorized', 'payload': None}

        return {
            'status': 200,
            "result": {"status": "success"},
            'jsonrpc': req.jsonrpc,
            'id': req.id,
            'method': req.method,
            'timestamp': timestamp.strftime("%Y-%m-%d %H:%M:%S"),# currentTimestamp,
            'payload': payload
        }

# ----------------- ROUTES -----------------
api_aems.add_resource(auth, '/auth')
api_aems.add_resource(ui_control, '/gs')
api_volttron.add_resource(building_control, '/set_point')

parser = argparse.ArgumentParser(description="Run UI server with SSL.")
parser.add_argument('--certfile', type=str, required=True, help='Path to SSL certificate file')
parser.add_argument('--keyfile', type=str, required=True, help='Path to SSL private key file')
args = parser.parse_args()


def run_volttron_server():
    print("[INFO] Starting VOLTTRON server on port 5100...")
    app_volttron.run(host='0.0.0.0', port=5100, threaded=True)

def run_aems_server():
    print("[INFO] Starting AEMS server on port 8443...")
    app_aems.run(host='0.0.0.0', port=8443, ssl_context=(args.certfile, args.keyfile), threaded=True)

if __name__ == '__main__':
    t1 = threading.Thread(target=run_volttron_server)
    t2 = threading.Thread(target=run_aems_server)
    t1.start(); t2.start()