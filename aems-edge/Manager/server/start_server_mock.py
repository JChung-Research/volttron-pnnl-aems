"""
Filename: start_server_mock.py
Updated: 2025-05-26
Author: Jihoon Chung
Description:
    This mock server enables JSON-RPC communication between the AEMS web application and mock VOLTTRON/BOPTEST-based backend Manager Agents.
    It includes authentication and simulated control/sensor data handling.
"""

from fastapi import FastAPI, Request
from pydantic import BaseModel
from typing import Optional, Dict
import uvicorn
import argparse

import os
import random
from datetime import datetime

# ----------------- FASTAPI APP INIT -----------------
app = FastAPI()

# ----------------- BASIC AUTH CONFIG -----------------
VALID_USERNAME = "admin"
VALID_PASSWORD = "admin"

# ----------------- SCHEMA DEFINITIONS -----------------
class Params(BaseModel):
    authentication: Optional[bool]
    data: Optional[Dict] = {}

class JSONRPCRequest(BaseModel):
    jsonrpc: str
    id: str                     # Manager Agent ID (e.g., 'manager.four-pipe-fcu-1')
    method: str                 # JSON-RPC method (e.g., 'get_temperature_setpoints')
    params: Params              # Authentication flag and data payload (e.g., {authentication: token, data: data})

# ----------------- DUMMY SENSOR DATA GENERATOR -----------------
def get_temperature_setpoints(system_id):

    """
    Simulates control setpoints and environmental readings for different BOPTEST test cases.
    Used as a placeholder for VOLTTRON/BOPTEST integration.

    Args:
        system_id (str): ID of VOLTTRON Manager Agents that manages building systems (used as JSON-RPC ID)
    
    Returns:
        list[dict]: Emulated or actual sensor readings / control signals for that system
    """
    payload = []    

    match system_id:
        
        # Three example of VOLTTRON Manager Agents with the BOPTEST 'bestest_air' testcase
        case "manager.four-pipe-fcu-1" | "manager.four-pipe-fcu-2" | "manager.four-pipe-fcu-3": 
            payload =  [
                    { "name": "ZoneAirCoolingSetpoint", "label": "Zone temperature setpoint for cooling", "type": "control", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "ZoneAirHeatingSetpoint", "label": "Zone temperature setpoint for heating", "type": "control", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "SupplyFanSpeed", "label": "Supply fan Speed", "type": "control", "value": round(random.uniform(0, 1), 1), "unit": "[0,1]"},
                    { "name": "SupplyAirSetpoint", "label": "Supply air temperature setpoint", "type": "control", "value": round(random.uniform(41, 95), 1), "unit": "°F"},

                    { "name": "SupplyAirflowRate", "label": "Supply air mass flow rate", "type": "enviroment", "value": round(random.uniform(0, 1), 1), "unit": "kg/s"},
                    { "name": "ZoneCo2Concentration", "label": "Zone air CO2 concentration", "type": "enviroment", "value": round(random.uniform(400, 1200), 1), "unit": "ppm"},
                    { "name": "ZoneAirTemperature", "label": "Zone air temperature", "type": "enviroment", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "SupplyFanPowerConsumption", "label": "Supply fan power consumption", "type": "enviroment", "value": round(random.uniform(0, 600), 1), "unit": "W"},
                    { "name": "CoolingPowerConsumption", "label": "Cooling power consumption", "type": "enviroment", "value": round(random.uniform(0, 600), 1), "unit": "W"},
                    { "name": "HeatingPowerConsumption", "label": "Heating power consumption", "type": "enviroment", "value": round(random.uniform(0, 600), 1), "unit": "W"}
                ]
            
        # Three example of VOLTTRON Manager Agents with the BOPTEST 'bestest_hydronic' testcase
        case "manager.single-radiator-1" | "manager.single-radiator-2" | "manager.single-radiator-3": 
            payload =  [
                    { "name": "SupplyHeaterSetpoint", "label": "Supply setpoint of the heater", "type": "control", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "ZoneOperativeHeatingSetpoint", "label": "Zone temperature setpoint for heating", "type": "control", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "ZoneOperativeCoolingSetpoint", "label": "Zone temperature setpoint for cooling", "type": "control", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "ControlStagePump", "label": "Control signal to control pump stage", "type": "control", "value": round(random.uniform(0, 1), 0), "unit": "on/off"},

                    { "name": "ZoneCo2Concentration", "label": "CO2 concentration in the zone", "type": "enviroment", "value": round(random.uniform(400, 1200), 1), "unit": "ppm"},
                    { "name": "ZoneOperativeTemperature", "label": "Operative zone temperature", "type": "enviroment", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "PumpPowerConsumption", "label": "Pump power consumption", "type": "enviroment", "value": round(random.uniform(0, 600), 1), "unit": "W"},
                    { "name": "HeatingPowerConsumption", "label": "Heating power consumption", "type": "enviroment", "value": round(random.uniform(0, 600), 1), "unit": "W"}
                ]

        # Three example of VOLTTRON Manager Agents from real buildings
        case "manager.building-3147" | "manager.building-Yuma" | "manager.building-FRP": 
            payload =  [
                    { "name": "ZoneAirCoolingSetpoint", "label": "Zone temperature setpoint for cooling", "type": "control", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "ZoneAirHeatingSetpoint", "label": "Zone temperature setpoint for heating", "type": "control", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "SupplyAirSetpoint", "label": "Supply air temperature setpoint", "type": "control", "value": round(random.uniform(41, 95), 1), "unit": "°F"},

                    { "name": "ZoneAirTemperature", "label": "Zone air temperature", "type": "enviroment", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "CoolingPowerConsumption", "label": "Cooling power consumption", "type": "enviroment", "value": round(random.uniform(0, 600), 1), "unit": "W"},
                    { "name": "HeatingPowerConsumption", "label": "Heating power consumption", "type": "enviroment", "value": round(random.uniform(0, 600), 1), "unit": "W"}
                ]
    
    return payload

# ----------------- DUMMY VOLTTRON DEVICE CONTROLLER -----------------
def set_temperature_setpoints(system_id, control_signals):
    """
    Control VOLTTRON actuators or advance BOPTEST emulation
    Args:
        system_id (str): ID of VOLTTRON Manager Agents that manages building systems (used as JSON-RPC ID)
        control_signals (list[dict]): Actual control signals for that system or input parameters for advancing BOPTEST emulation
    
    Returns:
        str: playload with success or error message
    """
    payload = {}

    """
    Please add your codes here
    """

    return payload

# ----------------- AUTHENTICATION ENDPOINT -----------------
@app.post("/auth")
async def auth(request: Request):

    """
    Authenticates incoming AEMS clients prior to JSON-RPC interaction.

    Example code to access this endpoint (JavaScript):
    
    await fetch("https://localhost:8443/auth", {
        method: "POST",
        body: JSON.stringify({ username: "admin", password: "admin" }),
    });
    
    """
    body = await request.json()
    username = body.get("username")
    password = body.get("password")
    
    # It could be replaced with secure token-based authentication
    if username == VALID_USERNAME and password == VALID_PASSWORD:
        return {"access_token": True}
    else:
        return {"access_token": False}


# ----------------- JSON-RPC API ENTRY POINT -----------------
@app.post("/gs")
def gs(request: JSONRPCRequest):
    """
    Primary endpoint for processing JSON-RPC calls from the client
    
    Supports:
    - get_temperature_setpoints: Retrieve sensor and control data (simulating mock version of VOLTTRON/BOPTEST)
    - set_temperature_setpoints: Placeholder for control signal integration
    
    The client must include `params.authentication=True` to proceed.

    Example code to access this endpoint (JavaScript):
    await fetch("https://localhost:8443/gs", {
        method: "POST",
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: "manager.four-pipe-fcu-1",
            method: "get_temperature_setpoints",
            params: { 
                    authentication: true,
                    data: {
                        'SupplyFanSpeed': 0.8, 
                        'SupplyAirSetpoint': 71, 
                        'ZoneAirCoolingSetpoint': 78, 
                        'ZoneAirHeatingSetpoint': 65
                    } 
                }
        }),
    });

    """
    payload = {}
    currentTimestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if request.params.authentication:
        print(f"Received request:\nID: {request.id}\nMethod: {request.method}\nParams: {request.params}")
        
        if request.method == "get_temperature_setpoints":
            # Retrieve sensor/control data from the VOLTTRON web API or BOPTEST API
            system_id = request.id
            payload = get_temperature_setpoints(system_id)

        elif request.method == "set_temperature_setpoints":
            # Placeholder for logic to forward control signals to the VOLTTRON web API or BOPTEST API
            system_id = request.id
            control_signals = request.params.data # e.g., {'SupplyFanSpeed': 0.8, 'SupplyAirSetpoint': 71, 'ZoneAirCoolingSetpoint': 78, 'ZoneAirHeatingSetpoint': 65}     
            payload = set_temperature_setpoints(system_id, control_signals)
        else:
            payload = {"message": f"Method '{request.method}' not implemented"}

    # JSON-RPC response from the VOLTTRON Python server to the AEMS server
    return {
                "jsonrpc": request.jsonrpc, 
                "id": request.id, 
                "method": request.method, 
                "timestamp": currentTimestamp,
                "payload": payload
            }


# ----------------- SERVER ENTRY POINT -----------------
def main():
    """
    Starts the FastAPI server with TLS/SSL enabled.
    Requires command-line arguments for certfile and keyfile paths.
    """
    parser = argparse.ArgumentParser(description="Start the FastAPI server with SSL.")
    parser.add_argument('--certfile', type=str, required=True, help='Path to the SSL certificate file')
    parser.add_argument('--keyfile', type=str, required=True, help='Path to the SSL key file')
    parser.add_argument('--port', type=int, default=8443, help='Port to run the server on (default: 8443)')
    args = parser.parse_args()

    # Validate certfile and keyfile paths
    if not os.path.isfile(args.certfile):
        raise FileNotFoundError(f"Certificate file not found: {args.certfile}")
    if not os.path.isfile(args.keyfile):
        raise FileNotFoundError(f"Key file not found: {args.keyfile}")
    
    # Start the FastAPI server using Uvicorn with HTTPS
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=args.port,
        ssl_certfile=args.certfile,
        ssl_keyfile=args.keyfile
    )

if __name__ == "__main__":
    main()


"""
Mappings for Control Inputs and Environmental Outputs:
You may need this information to convert BOPTEST variable names to AEMS variable names
----------------------------

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

testCaseHydronicInputs = {
    "oveTSetSup_u": "SupplyHeaterSetpoint",
    "ovePum_u": "ControlStagePump",
    "oveTSetCoo_u": "ZoneOperativeCoolingSetpoint",
    "oveTSetHea_u": "ZoneOperativeHeatingSetpoint"
}

testCaseHydronicOutputs = {
    "reaCO2RooAir_y": "ZoneCo2Concentration",
    "reaTRoo_y": "ZoneOperativeTemperature",
    "reaPPum_y": "PumpPowerConsumption",
    "reaQHea_y": "HeatingPowerConsumption"
}
"""