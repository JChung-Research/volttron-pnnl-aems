import json
import requests
import time
import random
import argparse
from flask import Flask, jsonify, request
from flask_restful import Resource, Api, reqparse
import pandas as pd
from time import gmtime, strftime
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, Dict
import threading

import sys, os
sys.path.append('..\\aems-edge\Manager\manager')
# Reuse the holiday and observance objects from the 'aems-edge' folder
from holiday_utils import ALL_HOLIDAYS, OBSERVANCE
from pandas.tseries.holiday import Holiday, AbstractHolidayCalendar


# ----------------- FLASKAPI APP INIT -----------------
app_volttron = Flask(__name__)
api_volttron = Api(app_volttron)

app_aems = Flask(__name__)
api_aems = Api(app_aems)

VALID_USERNAME = "admin"
VALID_PASSWORD = "admin"

u = {} # Control values for forwarding to the VOLTTRON backend
y = {} # Environmental and control values for forwarding to the AEMS applications
t = {} # Control values for schedules, holidays, occupancy override
u_uo = {} # Control values for unoccuppied zone teperature setpoints

# ----------------- DATA CONVERSION TOOL -----------------

data_mapping = {
    'T_OA': {
        "name": "OutdoorTemperature",
        "label": "Outdoor air temperature",
        "type": "environment",
        "unit": "°F"
    },
    'Flowrate_RTU': {
        "name": "SupplyAirflowRateRTU",
        "label": "Supply air mass flow rate of RTU unit",
        "type": "environment",
        "unit": "CFM"
    },
    'Flowrate_VAV': {
        "name": "SupplyAirflowRateVAV",
        "label": "Supply air mass flow rate of VAV unit",
        "type": "environment",
        "unit": "CFM"
    },
    'T_inlet': {
        "name": "SupplyAirTemperatureInlet",
        "label": "Inlet supply air temperature",
        "type": "environment",
        "unit": "°F"
    },
    'T_outlet_VAV': {
        "name": "SupplyAirTemperatureVAV",
        "label": "Outlet supply air temperature",
        "type": "environment",
        "unit": "°F"
    },
    'W_inlet': {
        "name": "HumidityInlet",
        "label": "Inlet air humidity",
        "type": "environment",
        "unit": "%"
    },
    'T_zone': {
        "name": "ZoneAirTemperature",
        "label": "Zone air temperature",
        "type": "environment",
        "unit": "°F"
    },
    'W_zone': {
        "name": "HumidityZone",
        "label": "Zone air humidity",
        "type": "environment",
        "unit": "%"
    },
    "fcu_oveFan_u": {
        "name": "SupplyFanSpeed",
        "label": "Supply fan Speed",
        "type": "control",
        "unit": "[0-1]"
    },
    "fcu_oveTSup_u": {
        "name": "SupplyAirSetpoint",
        "label": "Supply air temperature setpoint",
        "type": "control",
        "unit": "°F"
    },
    "con_oveTSetCoo_u": {
        "name": "ZoneAirCoolingSetpoint",
        "label": "Zone temperature setpoint for cooling",
        "type": "control",
        "unit": "°F"
    },
    "con_oveTSetHea_u": {
        "name": "ZoneAirHeatingSetpoint",
        "label": "Zone temperature setpoint for heating",
        "type": "control",
        "unit": "°F"
    },
    "fcu_reaFloSup_y": {
        "name": "SupplyAirflowRate",
        "label": "Supply air mass flow rate",
        "type": "environment",
        "unit": "kg/s"
    },
    "zon_reaCO2RooAir_y": {
        "name": "ZoneCo2Concentration",
        "label": "Zone air CO2 concentration",
        "type": "environment",
        "unit": "ppm"
    },
    "zon_reaTRooAir_y": {
        "name": "ZoneAirTemperature",
        "label": "Zone air temperature",
        "type": "environment",
        "unit": "°F"
    },
    "fcu_reaPFan_y": {
        "name": "SupplyFanPowerConsumption",
        "label": "Supply fan power consumption",
        "type": "environment",
        "unit": "W"
    },
    "fcu_reaPCoo_y": {
        "name": "CoolingPowerConsumption",
        "label": "Cooling power consumption",
        "type": "environment",
        "unit": "W"
    },
    "fcu_reaPHea_y": {
        "name": "HeatingPowerConsumption",
        "label": "Heating power consumption",
        "type": "environment",
        "unit": "W"
    },
    "oveTSetSup_u": {
        "name": "SupplyHeaterSetpoint",
        "label": "Supply setpoint of the heater",
        "type": "control",
        "unit": "°F"
    },
    "ovePum_u": {
        "name": "ControlStagePump",
        "label": "Control signal to control pump stage",
        "type": "control",
        "unit": "on/off"
    },
    "oveTSetCoo_u": {
        "name": "ZoneOperativeCoolingSetpoint",
        "label": "Zone temperature setpoint for cooling",
        "type": "control",
        "unit": "°F"
    },
    "oveTSetHea_u": {
        "name": "ZoneOperativeHeatingSetpoint",
        "label": "Zone temperature setpoint for heating",
        "type": "control",
        "unit": "°F"
    },
    "reaCO2RooAir_y": {
        "name": "ZoneCo2Concentration",
        "label": "CO2 concentration in the zone",
        "type": "environment",
        "unit": "ppm"
    },
    "reaTRoo_y": {
        "name": "ZoneOperativeTemperature",
        "label": "Operative zone temperature",
        "type": "environment",
        "unit": "°F"
    },
    "reaPPum_y": {
        "name": "PumpPowerConsumption",
        "label": "Pump power consumption",
        "type": "environment",
        "unit": "W"
    },
    "reaQHea_y": {
        "name": "HeatingPowerConsumption",
        "label": "Heating power consumption",
        "type": "environment",
        "unit": "W"
    }
}

def restructure_sensor_data_by_zone(raw_zone_data):
    """
    Convert raw sensor data by zone into structured AEMS-style list of dictionaries.
    
    Args:
        raw_zone_data (dict): Raw sensor data structured by zone ID.
        
    Returns:
        dict: Restructured data by zone, formatted as AEMS-style sensor entries.
    """

    output = {}
    
    for system_id, sensors in raw_zone_data.items():
        structured_entries = []
        for boptest_var, value in sensors.items():           
            entry = data_mapping[boptest_var].copy()
            entry["value"] = value
            structured_entries.append(entry)
        output[f"manager.zone-{system_id}"] = structured_entries
    
    return output


def restructure_control_data(control_dict):
    """
    Converts flat control input dictionary into AEMS-style structured list format.
    
    Args:
        control_dict (dict): Dictionary of control parameters and their values.
    
    Returns:
        list[dict]: AEMS-style list of structured control entries.
    """
    
    output = []
    for key, value in control_dict.items():
        matched = next(
            (d for d in data_mapping.values() if d.get("type") == "control" and d.get("name") == key),
            None
        )

        if matched:
            entry = {
                "name": matched["name"],
                "label": matched["label"],
                "type": matched["type"],
                "value": value,
                "unit": matched["unit"]
            }
            output.append(entry)
    
    return output

# ----------------- UPDATE Y VARIABLE -----------------

def update_zone_environment(y_, y_env_data):
    """
    Updates the 'environment' entries for each system (zone) in the global 'y' dictionary.ovided environment data.

    Args:
        y_ (dict): The existing y variable (global zone data).
        y_env_data (dict): New environmental data structured by system ID.

    Returns:
        dict: The updated y dictionary.
    """

    for system_id, new_env_list in y_env_data.items():
        if system_id in y_:
            # Create a mapping from name to value in new_env_list
            new_values = {entry['name']: entry['value'] for entry in new_env_list if entry.get("type") == "environment"}
            # Update values in existing list if the name matches
            for entry in y_[system_id]:
                if entry['name'] in new_values:
                    entry['value'] = new_values[entry['name']]
        else:
            # If zone doesn't exist — create with new environmental data
            y_[system_id] = new_env_list.copy()

    return y_

def update_zone_controls(y_, system_id, control_data):
    """
    Updates the 'control' entries for a given system (zone) in the 'y' dictionary.
    
    Args:
        y_ (dict): The existing y variable (global zone data).
        system_id (str): System ID like "manager.zone-bestest_air".
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
def get_temperature_setpoints(y_, system_id):

    """
    Simulates control setpoints and environmental readings for different BOPTEST test cases.
    Used as a placeholder for VOLTTRON/BOPTEST integration.

    Args:
        system_id (str): System ID like "manager.zone-bestest_air".
    
    Returns:
        list[dict]: Emulated or actual sensor readings / control signals for that system
    """
    
    return y_[system_id]

# ------------------ VOLTTRON AGENTS CONTROLLER ---------------
def set_temperature_setpoints(system_id, control_signals): #(y_, control_signals):
    """`    
    Updates control data in 'y' and sends control signals to the physical/emulated backend (e.g., BOPTEST).

    Args:
        y_ (dict): Current global y dictionary (zone data)
        system_id (str): System ID like "manager.zone-bestest_air".
        control_signals (dict): Control setpoints as flat dictionary (e.g., {"SupplyFanSpeed": 0.8})
    
    Returns:
        tuple: (response dict, updated y dict)
    """    
    try:
        global u
        global u_uo
        global y

        control_data = restructure_control_data(control_signals)
        y = update_zone_controls(y, system_id, control_data)

        name_to_key = {v["name"]: k for k, v in data_mapping.items()}
        u[system_id] = {name_to_key[k]: v for k, v in control_signals.items() if k in name_to_key}
        u_uo[system_id] = {k: v for k, v in control_signals.items() if k in ['UnoccupiedCoolingSetPoint', 'UnoccupiedHeatingSetPoint']}        

    except Exception as e:
        return {'status': 400, 'message': f'Unexpected input: {str(e)}', 'payload': None}
    return {'status':200, 'message':'Success', 'payload':y}


# -------------- OCCUPANCY / HOLIDAY / SCHEDULE CONTROLLER --------------
def set_holidays(system_id, holidays):

    """
    Set holiday schedule for a given system_id using static and custom holidays.

    Args:
        system_id (str): System ID like "manager.zone-bestest_air".
        holidays (dict): {holiday_name: {} or {month, day, observance}}

    Returns:
        dict: Holiday list stored in `u[system_id]['holidays']`
    """
    try:
        global t
        t.setdefault(system_id, {'occupancies': {}, 'holidays': [], 'schedules': {}})

        start_date = datetime(datetime.today().year, 1, 1)
        end_date = datetime(datetime.today().year, 12, 31)

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

        # HERE: error:  name 'rules' is not defined!!!
        holiday_dates = pd.to_datetime(TempCalendar().holidays(start=start_date, end=end_date))
        holiday_dates = holiday_dates.sort_values().unique()

        
        t[system_id]["holidays"] = [str(date.date()) for date in holiday_dates]
        print(f"\nSet holidays for {system_id}: {t[system_id]['holidays']}")
        
    except Exception as e:
        return {'status': 400, 'message': f'Unexpected input: {str(e)}', 'payload': None}
    return {'status': 200, 'message': 'Success', 'payload': t[system_id]}


def set_schedule(system_id, schedules):
    """
    Set a weekly schedule for the given system_id and store it in `t`.

    Args:
        system_id (str): System ID like "manager.zone-bestest_air".
        schedule (dict): Weekly schedule with either time range or "always_off".

    Returns:
        dict: API-style response with stored schedule.
    """
    try:
        global t
        t.setdefault(system_id, {'occupancies': {}, 'holidays': [], 'schedules': {}})

        parsed_schedule = {}

        # Ensure keys like Monday, Tuesday... are normalized
        for day, value in schedules.items():
            day_cap = day.capitalize()
            if isinstance(value, dict):
                # Validate time strings
                try:
                    datetime.strptime(value["start"], "%H:%M")
                    datetime.strptime(value["end"], "%H:%M")
                except Exception as e:
                    raise ValueError(f"Invalid time format in {day}: {e}")
                parsed_schedule[day_cap] = {
                    "start": value["start"],
                    "end": value["end"]
                }
            elif value == "always_off":
                parsed_schedule[day_cap] = "always_off"
            else:
                raise ValueError(f"Invalid value for {day}: {value}")

        t[system_id]["schedules"] = parsed_schedule
        print(f"\nSet schedules for {system_id}: {t[system_id]['schedules']}")

    except Exception as e:
        return {'status': 400, 'message': f'Unexpected input: {str(e)}', 'payload': None}
    return {'status': 200, 'message': 'Success', 'payload': t[system_id]['schedules']}


def set_occupancy_override(system_id, occupancies):
    """
    Sets manual occupancy override schedules for a zone/system and stores it under `t`.

    Args:
        system_id (str): System ID like 'manager.zone-bestest_air'
        occupancies (dict): Dict with dates as keys and list of {start, end} dicts as values.

    Returns:
        dict: Updated occupancy override info.
    """
    try:
        global t
        t.setdefault(system_id, {'occupancies': {}, 'holidays': [], 'schedules': {}})

        parsed_occupancies = {}

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


def get_current_occupancy_state(system_id, t):
    """
    Check current occupancy state based on occupancy overrides, holidays, and schedules.

    Args:
        system_id (str): System ID like "manager.zone-bestest_air".

    Returns:
        str: "occupied" or "unoccupied"
    """
    
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    current_time = now.time()

    # 1. Check manual occupancy overrides
    occupancies = t[system_id].get("occupancies", {})
    if today_str in occupancies:
        for entry in occupancies[today_str]:
            start = datetime.strptime(entry["start"], "%H:%M").time()
            end = datetime.strptime(entry["end"], "%H:%M").time()
            if start <= current_time <= end:
                return "occupied"

    # 2. Check holiday
    holidays = t[system_id].get("holidays", [])
    if today_str in holidays:
        return "unoccupied"

    # 3. Check weekly schedule
    weekday = now.strftime("%A")  # 'Monday', 'Tuesday', ...
    schedule = t[system_id].get("schedules", {}).get(weekday)

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
            return "unoccupied"

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


# ----------------- BUILDING CONTROL -----------------
class building_control(Resource):
    """
    Receives and processes environmental data updates from the building/emulation layer.
    """

    def put(self):        
        try:
            global y
            global u
            global u_uo
            global t

            body = request.get_json()
            y_env = restructure_sensor_data_by_zone(body)
            y = update_zone_environment(y, y_env)
                         
            
            system_id = f"manager.zone-{next(iter(body.keys()))}"
            control_signals = next(iter(body.values()))

            # These default values will be replaced with the values from configuration files in the next updates
            u.setdefault(system_id, {key: value for key, value in control_signals.items() if data_mapping[key]["type"] == "control"})
            u_uo.setdefault(system_id, {'UnoccupiedCoolingSetPoint': 80, 'UnoccupiedHeatingSetPoint': 60})
            t.setdefault(system_id, {'occupancies': {}, 'holidays': ['2025-01-01', '2025-05-26', '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-27', '2025-11-28', '2025-12-24', '2025-12-25'], 'schedules': {'Monday': {'start': '06:30', 'end': '18:00'}, 'Tuesday': {'start': '06:30', 'end': '18:00'}, 'Wednesday': {'start': '06:30', 'end': '18:00'}, 'Thursday': {'start': '06:30', 'end': '18:00'}, 'Friday': {'start': '06:30', 'end': '18:00'}, 'Saturday': 'always_off', 'Sunday': 'always_off'}})
            
            # Check if holiday, schedule, and occupancy informaion is available.
            if system_id not in t or not all(k in t[system_id] for k in ["holidays", "schedules", "occupancies"]):
                print("[INFO] Holiday, schedule, and occupancy information is currently unavailable.")
            
            else:
                # Check an occupancy state at the current time
                current_state = get_current_occupancy_state(system_id, t)
                print(f"[INFO] System '{system_id}' is currently: {current_state}")
                
                if current_state == "unoccupied":                    
                    target_names = {
                        "ZoneAirCoolingSetpoint",
                        "ZoneAirHeatingSetpoint",
                        "ZoneOperativeCoolingSetpoint",
                        "ZoneOperativeHeatingSetpoint"
                    }

                    # Replace occupied temperature setpoints with unoccupied temperature setpoints within global u variable
                    for key in u[system_id]:
                        setpoint_name = data_mapping[key]["name"]
                        if setpoint_name in target_names:
                            if 'Cooling' in setpoint_name:
                                u[system_id][key] = u_uo[system_id]['UnoccupiedCoolingSetPoint']
                            elif 'Heating' in setpoint_name:
                                u[system_id][key] = u_uo[system_id]['UnoccupiedHeatingSetPoint']
                    
                    renamed_data = {
                        data_mapping[key]["name"]: value
                        for key, value in u[system_id].items()
                    }

                    # Update global y variable
                    control_data = restructure_control_data(renamed_data)
                    y = update_zone_controls(y, system_id, control_data)                               

        except Exception as e:
            return {'status': 400, 'message': f'Unexpected input: {str(e)}', 'payload': None}
        return {'status':200, 'message':'Success', 'payload': u[system_id]}
        

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

    def post(self):
        jsonrpc_to_ignore = ["set_optimal_start", "set_location", "set_configurations"]

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

        currentTimestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        payload = {}

        if req.params.authentication:
            if req.method == "get_temperature_setpoints":
                payload = get_temperature_setpoints(y, req.id) if (len(y) > 0) else None
                # print("\nPayload for get_temp", payload)
            elif req.method == "set_temperature_setpoints":
                payload = set_temperature_setpoints(req.id, req.params.data)
            elif req.method == "set_holidays":
                payload = set_holidays(req.id, req.params.data)
            elif req.method == "set_schedule":
                payload = set_schedule(req.id, req.params.data)
            elif req.method == "set_occupancy_override":
                # print("\nreq: ", {
                #             'id': req.id,
                #             'method': req.method,
                #             'params': req.params.data
                #         })
                payload = set_occupancy_override(req.id, req.params.data)
            elif req.method in jsonrpc_to_ignore:
                payload = {}
            else:
                return {'status': 400, 'message': f"Method '{req.method}' not implemented", 'payload': None}
        else:
            return {'status': 401, 'message': 'Unauthorized', 'payload': None}

        return {
            'status': 200,
            "result": {"status": "success"},
            'jsonrpc': req.jsonrpc,
            'id': req.id,
            'method': req.method,
            'timestamp': currentTimestamp,
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
    app_volttron.run(
        host='0.0.0.0',
        port=5100,
        threaded=True
    )

def run_aems_server():
    print("[INFO] Starting AEMS server on port 8443...")
    app_aems.run(
        host='0.0.0.0',
        port=8443,
        ssl_context=(args.certfile, args.keyfile),
        threaded=True
    )

if __name__ == '__main__':
    t1 = threading.Thread(target=run_volttron_server)
    t2 = threading.Thread(target=run_aems_server)
    t1.start()
    t2.start()