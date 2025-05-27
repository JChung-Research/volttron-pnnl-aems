"""
Filename: start_server_virtual.py
Updated: 2025-05-26
Author: Jihoon Chung
Description:
    This virtual server enables JSON-RPC communication between the AEMS web application and virtual VOLTTRON/BOPTEST-based backend agents.
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
def get_temperature_setpoints(systemId):

    """
    Simulates control setpoints and environmental readings for different BOPTEST test cases.
    Used as a placeholder for VOLTTRON/BOPTEST integration.

    Args:
        systemId (str): ID of VOLTTRON Manager Agents that manages building systems (used as JSON-RPC ID)
    
    Returns:
        list[dict]: Emulated or actual sensor readings / control signals for that system
    """
    payload = []    

    match systemId:
        
        # Three example of VOLTTRON Manager Agents with the BOPTEST 'bestest_air' testcase
        case "manager.four-pipe-fcu-1" | "manager.four-pipe-fcu-2" | "manager.four-pipe-fcu-3": 
            payload =  [
                    { "name": "con_oveTSetCoo_u", "label": "Zone temperature setpoint for cooling", "type": "control", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "con_oveTSetHea_u", "label": "Zone temperature setpoint for heating", "type": "control", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "fcu_oveFan_u", "label": "Supply fan Speed", "type": "control", "value": round(random.uniform(0, 1), 1), "unit": "[0,1]"},
                    { "name": "fcu_oveTSup_u", "label": "Supply air temperature setpoint", "type": "control", "value": round(random.uniform(41, 95), 1), "unit": "°F"},

                    { "name": "fcu_reaFloSup_y", "label": "Supply air mass flow rate", "type": "enviroment", "value": round(random.uniform(0, 1), 1), "unit": "kg/s"},
                    { "name": "zon_reaCO2RooAir_y", "label": "Zone air CO2 concentration", "type": "enviroment", "value": round(random.uniform(400, 1200), 1), "unit": "ppm"},
                    { "name": "zon_reaTRooAir_y", "label": "Zone air temperature", "type": "enviroment", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "fcu_reaPFan_y", "label": "Supply fan power consumption", "type": "enviroment", "value": round(random.uniform(0, 600), 1), "unit": "W"},
                    { "name": "fcu_reaPCoo_y", "label": "Cooling power consumption", "type": "enviroment", "value": round(random.uniform(0, 600), 1), "unit": "W"},
                    { "name": "fcu_reaPHea_y", "label": "Heating power consumption", "type": "enviroment", "value": round(random.uniform(0, 600), 1), "unit": "W"}
                ]
            
        # Three example of VOLTTRON Manager Agents with the BOPTEST 'bestest_hydronic' testcase
        case "manager.single-radiator-1" | "manager.single-radiator-2" | "manager.single-radiator-3": 
            payload =  [
                    { "name": "oveTSetSup_u", "label": "Supply setpoint of the heater", "type": "control", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "oveTSetHea_u", "label": "Zone temperature setpoint for heating", "type": "control", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "oveTSetCoo_u", "label": "Zone temperature setpoint for cooling", "type": "control", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "ovePum_u", "label": "Control signal to control pump stage", "type": "control", "value": round(random.uniform(0, 1), 0), "unit": "on/off"},

                    { "name": "reaCO2RooAir_y", "label": "CO2 concentration in the zone", "type": "enviroment", "value": round(random.uniform(400, 1200), 1), "unit": "ppm"},
                    { "name": "reaTRoo_y", "label": "Operative zone temperature", "type": "enviroment", "value": round(random.uniform(41, 95), 1), "unit": "°F"},
                    { "name": "reaPPum_y", "label": "Pump power consumption", "type": "enviroment", "value": round(random.uniform(0, 600), 1), "unit": "W"},
                    { "name": "reaQHea_y", "label": "Heating power consumption", "type": "enviroment", "value": round(random.uniform(0, 600), 1), "unit": "W"}
                ]
    
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
    - get_temperature_setpoints: Retrieve mock data (simulating VOLTTRON/BOPTEST)
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
            # Retrieve sensor/control data from the VOLTTRON platform / BOPTEST API
            payload = get_temperature_setpoints(request.id)
        elif request.method == "set_temperature_setpoints":
            # Placeholder for logic to forward control signals to the VOLTTRON platform / BOPTEST API (e.g., request.params.data={'SupplyFanSpeed': 0.8, 'SupplyAirSetpoint': 71, 'ZoneAirCoolingSetpoint': 78, 'ZoneAirHeatingSetpoint': 65})
            print("From VOLTTRON: 'The control signals are processed!'")
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
Mappings for Control Inputs:
----------------------------
testCaseAirInputs = {
    "supplyAirSetpoint": "fcu_oveTSup_u",
    "supplyFanSpeed": "fcu_oveFan_u",
    "zoneAirCoolingSetpoint": "con_oveTSetCoo_u",
    "zoneAirHeatingSetpoint": "con_oveTSetHea_u"
}

testCaseHydronicInputs = {
    "supplyHeaterSetpoint": "oveTSetSup_u",
    "controlStagePump": "ovePum_u",
    "zoneOperativeCoolingSetpoint": "oveTSetCoo_u",
    "zoneOperativeHeatingSetpoint": "oveTSetHea_u"
}
"""