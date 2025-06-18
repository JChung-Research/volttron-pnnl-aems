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

# ----------------- FLASKAPI APP INIT -----------------
app_volttron = Flask(__name__)
api_volttron = Api(app_volttron)

app_aems = Flask(__name__)
api_aems = Api(app_aems)

VALID_USERNAME = "admin"
VALID_PASSWORD = "admin"

u = {}
y = {}

building_control_url = "http://127.0.0.1:5000"

# ----------------- DATA CONVERSION TOOL -----------------

data_mapping = {
    'T_OA': {
        "name": "OutdoorTemperature",
        "label": "Outdoor air temperature",
        "type": "enviroment",
        "unit": "°F"
    },
    'Flowrate_RTU': {
        "name": "SupplyAirflowRateRTU",
        "label": "Supply air mass flow rate of RTU unit",
        "type": "enviroment",
        "unit": "CFM"
    },
    'Flowrate_VAV': {
        "name": "SupplyAirflowRateVAV",
        "label": "Supply air mass flow rate of VAV unit",
        "type": "enviroment",
        "unit": "CFM"
    },
    'T_inlet': {
        "name": "SupplyAirTemperatureInlet",
        "label": "Inlet supply air temperature",
        "type": "enviroment",
        "unit": "°F"
    },
    'T_outlet_VAV': {
        "name": "SupplyAirTemperatureVAV",
        "label": "Outlet supply air temperature",
        "type": "enviroment",
        "unit": "°F"
    },
    'W_inlet': {
        "name": "HumidityInlet",
        "label": "Inlet air humidity",
        "type": "enviroment",
        "unit": "%"
    },
    'T_zone': {
        "name": "ZoneAirTemperature",
        "label": "Zone air temperature",
        "type": "enviroment",
        "unit": "°F"
    },
    'W_zone': {
        "name": "HumidityZone",
        "label": "Zone air humidity",
        "type": "enviroment",
        "unit": "%"
    },
    "SupplyFanSpeed": {
        "name": "SupplyFanSpeed",
        "label": "Supply fan Speed",
        "type": "control",
        "unit": "[0-1]"
    },
    "SupplyAirSetpoint": {
        "name": "SupplyAirSetpoint",
        "label": "Supply air temperature setpoint",
        "type": "control",
        "unit": "°F"
    },
    "ZoneAirCoolingSetpoint": {
        "name": "ZoneAirCoolingSetpoint",
        "label": "Zone temperature setpoint for cooling",
        "type": "control",
        "unit": "°F"
    },
    "ZoneAirHeatingSetpoint": {
        "name": "ZoneAirHeatingSetpoint",
        "label": "Zone temperature setpoint for heating",
        "type": "control",
        "unit": "°F"
    },
    "SupplyHeaterSetpoint": {
        "name": "SupplyHeaterSetpoint",
        "label": "Supply setpoint of the heater",
        "type": "control",
        "unit": "°F"
    },
    "ControlStagePump": {
        "name": "ControlStagePump",
        "label": "Control signal to control pump stage",
        "type": "control",
        "unit": "on/off"
    },
    "ZoneOperativeCoolingSetpoint": {
        "name": "ZoneOperativeCoolingSetpoint",
        "label": "Zone temperature setpoint for cooling",
        "type": "control",
        "unit": "°F"
    },
    "ZoneOperativeHeatingSetpoint": {
        "name": "ZoneOperativeHeatingSetpoint",
        "label": "Zone temperature setpoint for heating",
        "type": "control",
        "unit": "°F"
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
        for key, value in sensors.items():
            if key in data_mapping:
                entry = data_mapping[key].copy()
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
        if key in data_mapping and data_mapping[key].get("type") == "control":
            entry = {
                "name": data_mapping[key]["name"],
                "label": data_mapping[key]["label"],
                "type": data_mapping[key]["type"],
                "value": value,
                "unit": data_mapping[key]["unit"]
            }
            output.append(entry)
    
    return output

# ----------------- UPDATE Y VARIABLE -----------------

def update_zone_environment(y_, y_env_data):
    """
    Updates the 'enviroment' entries for each system (zone) in the global 'y' dictionary.ovided enviroment data.

    Args:
        y_ (dict): The existing y variable (global zone data).
        y_env_data (dict): New environmental data structured by system ID.

    Returns:
        dict: The updated y dictionary.
    """
    
    for system_id, new_env_list in y_env_data.items():
        if system_id in y_:
            # Retain only existing control entries
            control_entries = [entry for entry in y_[system_id] if entry.get("type") == "control"]
            y_[system_id] = new_env_list + control_entries
        else:
            # Zone doesn't exist — create with new environmental data
            y_[system_id] = new_env_list.copy()

    return y_

def update_zone_controls(y_, system_id, control_data):
    """
    Updates the 'control' entries for a given system (zone) in the 'y' dictionary.
    
    Args:
        y_ (dict): The existing y variable (global zone data).
        system_id (str): Zone key in the format 'manager.zone-{system_id}'.
        control_data (list): List of control entries from AEMS.
        
    Returns:
        dict: The updated y dictionary.
    """

    if system_id in y_:
        # Keep only environment entries
        env_entries = [entry for entry in y_[system_id] if entry.get("type") != "control"]
        y_[system_id] = env_entries + control_data
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

# ----------------- DUMMY SENSOR DATA GENERATOR -----------------
def get_temperature_setpoints(y_, system_id):

    """
    Simulates control setpoints and environmental readings for different BOPTEST test cases.
    Used as a placeholder for VOLTTRON/BOPTEST integration.

    Args:
        system_id (str): ID of VOLTTRON Manager Agents that manages building systems (used as JSON-RPC ID)
    
    Returns:
        list[dict]: Emulated or actual sensor readings / control signals for that system
    """
    
    return y_[system_id]

# ----------------- DUMMY VOLTTRON DEVICE CONTROLLER -----------------
def set_temperature_setpoints(system_id, control_signals): #(y_, control_signals):
    """`    
    Updates control data in 'y' and sends control signals to the physical/emulated backend (e.g., BOPTEST).

    Args:
        y_ (dict): Current global y dictionary (zone data)
        system_id (str): System ID like 'manager.zone-102'
        control_signals (dict): Control setpoints as flat dictionary (e.g., {"SupplyFanSpeed": 0.8})
    
    Returns:
        tuple: (response dict, updated y dict)
    """

    control_data = restructure_control_data(control_signals)
    # y_ = update_zone_controls(y_, system_id, control_data)

    print("control_signals: ", control_signals)
    print("control_data: ", control_data)
    
    json_object = json.dumps({
                                "id": control_signals,
                                "data": control_data
                                }, default=str) 
    
    try:        
        result = requests.put('{0}/set_point'.format(building_control_url),
                                                headers={"Content-type":"application/json"},
                                                data=json_object).json()
        if result['status'] == 200:
            return result #, y_
    except: 
        return {'status':400, 'message':'Unexpected Input', 'payload':None} #, y_


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
            body = request.get_json() 
            y_env = restructure_sensor_data_by_zone(body)
            y = update_zone_environment(y, y_env)
        except:
            return {'status':400, 'message':'Unexpected Input', 'payload':None}
        return {'status':200, 'message':'Success', 'payload':u}
        

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
            # global y
            if req.method == "get_temperature_setpoints":
                payload = get_temperature_setpoints(y, req.id) if (len(y) > 0) else None
            elif req.method == "set_temperature_setpoints":
                payload = set_temperature_setpoints(req.id, req.params.data) # (y, req.id, req.params.data)
                # y = y_
            else:
                return {'status': 400, 'message': f"Method '{req.method}' not implemented", 'payload': None}
        else:
            return {'status': 401, 'message': 'Unauthorized', 'payload': None}

        return {
            'status': 200,
            'message': 'Success',            
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
    

"""
[BOPTEST variable name]: [AEMS variable name]

testCaseAirInputs = {
    "fcu_oveTSup_u": "SupplyAirSetpoint",
    "fcu_oveFan_u": "SupplyFanSpeed",
    "con_oveTSetCoo_u": "ZoneAirCoolingSetpoint",
    "con_oveTSetHea_u": "ZoneAirHeatingSetpoint"
}

testCaseAirOutputs = {
    "fcu_reaFloSup_y": "SupplyAirflowRate",
    "zon_reaCO2RooAir_y": "ZoneCo2Concentration",
    "zon_reaTRooAir_y": "ZoneAirTemperature",
    "fcu_reaPFan_y": "SupplyFanPowerConsumption",
    "fcu_reaPCoo_y": "CoolingPowerConsumption",
    "fcu_reaPHea_y": "HeatingPowerConsumption"
}
"""