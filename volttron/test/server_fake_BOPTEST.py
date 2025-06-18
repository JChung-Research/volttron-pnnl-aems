import json
import time, random
from flask import Flask, jsonify, request
from flask_restful import Resource, Api, reqparse
import pandas as pd
from time import gmtime, strftime


app = Flask(__name__)
api = Api(app)
actuation = False

def randomize (value):
    return value * round(random.uniform(0.95, 1.05), 4)

class building_data(Resource):
    '''Interface to get the operation information from FRP.''' 
    def get(self):
        now = strftime("%Y-%m-%d-%H-%M-%S", gmtime())
        data = {
                '102': {'T_OA': randomize(52.7507), 'Flowrate_RTU': randomize(2735.565),'Flowrate_VAV':randomize(120), 'T_inlet': randomize(56.07055), 'T_outlet_VAV': randomize(57.07055),'W_inlet': randomize(57.62672), 'T_zone': randomize(69.86182), 'W_zone': randomize(35.98026), 'ZoneAirCoolingSetpoint': randomize(80), 'ZoneAirHeatingSetpoint': randomize(60), 'SupplyFanSpeed': randomize(0.5), 'SupplyAirSetpoint': randomize(70)},
                '103': {'T_OA': randomize(52.7507), 'Flowrate_RTU': randomize(2735.565),'Flowrate_VAV':randomize(120), 'T_inlet': randomize(56.07055), 'T_outlet_VAV': randomize(57.07055),'W_inlet': randomize(57.62672), 'T_zone': randomize(69.86182), 'W_zone': randomize(35.98026), 'ZoneAirCoolingSetpoint': randomize(80), 'ZoneAirHeatingSetpoint': randomize(60), 'SupplyFanSpeed': randomize(0.5), 'SupplyAirSetpoint': randomize(70)},
                '105': {'T_OA': randomize(52.7507), 'Flowrate_RTU': randomize(2735.565),'Flowrate_VAV':randomize(120), 'T_inlet': randomize(56.07055), 'T_outlet_VAV': randomize(57.07055),'W_inlet': randomize(57.62672), 'T_zone': randomize(69.86182), 'W_zone': randomize(35.98026), 'ZoneAirCoolingSetpoint': randomize(80), 'ZoneAirHeatingSetpoint': randomize(60), 'SupplyFanSpeed': randomize(0.5), 'SupplyAirSetpoint': randomize(70)}, 
                '106': {'T_OA': randomize(52.7507), 'Flowrate_RTU': randomize(2735.565),'Flowrate_VAV':randomize(120), 'T_inlet': randomize(56.07055), 'T_outlet_VAV': randomize(57.07055),'W_inlet': randomize(57.62672), 'T_zone': randomize(69.86182), 'W_zone': randomize(35.98026), 'ZoneAirCoolingSetpoint': randomize(80), 'ZoneAirHeatingSetpoint': randomize(60), 'SupplyFanSpeed': randomize(0.5), 'SupplyAirSetpoint': randomize(70)},
                '202': {'T_OA': randomize(52.7507), 'Flowrate_RTU': randomize(2735.565),'Flowrate_VAV':randomize(120), 'T_inlet': randomize(56.07055), 'T_outlet_VAV': randomize(57.07055),'W_inlet': randomize(57.62672), 'T_zone': randomize(69.86182), 'W_zone': randomize(35.98026), 'ZoneAirCoolingSetpoint': randomize(80), 'ZoneAirHeatingSetpoint': randomize(60), 'SupplyFanSpeed': randomize(0.5), 'SupplyAirSetpoint': randomize(70)},
                '203': {'T_OA': randomize(52.7507), 'Flowrate_RTU': randomize(2735.565),'Flowrate_VAV':randomize(120), 'T_inlet': randomize(56.07055), 'T_outlet_VAV': randomize(57.07055),'W_inlet': randomize(57.62672), 'T_zone': randomize(69.86182), 'W_zone': randomize(35.98026), 'ZoneAirCoolingSetpoint': randomize(80), 'ZoneAirHeatingSetpoint': randomize(60), 'SupplyFanSpeed': randomize(0.5), 'SupplyAirSetpoint': randomize(70)},
                '204': {'T_OA': randomize(52.7507), 'Flowrate_RTU': randomize(2735.565),'Flowrate_VAV':randomize(120), 'T_inlet': randomize(56.07055), 'T_outlet_VAV': randomize(57.07055),'W_inlet': randomize(57.62672), 'T_zone': randomize(69.86182), 'W_zone': randomize(35.98026), 'ZoneAirCoolingSetpoint': randomize(80), 'ZoneAirHeatingSetpoint': randomize(60), 'SupplyFanSpeed': randomize(0.5), 'SupplyAirSetpoint': randomize(70)},
                '205': {'T_OA': randomize(52.7507), 'Flowrate_RTU': randomize(2735.565),'Flowrate_VAV':randomize(120), 'T_inlet': randomize(56.07055), 'T_outlet_VAV': randomize(57.07055),'W_inlet': randomize(57.62672), 'T_zone': randomize(69.86182), 'W_zone': randomize(35.98026), 'ZoneAirCoolingSetpoint': randomize(80), 'ZoneAirHeatingSetpoint': randomize(60), 'SupplyFanSpeed': randomize(0.5), 'SupplyAirSetpoint': randomize(70)},
                '206': {'T_OA': randomize(52.7507), 'Flowrate_RTU': randomize(2735.565),'Flowrate_VAV':randomize(120), 'T_inlet': randomize(56.07055), 'T_outlet_VAV': randomize(57.07055),'W_inlet': randomize(57.62672), 'T_zone': randomize(69.86182), 'W_zone': randomize(35.98026), 'ZoneAirCoolingSetpoint': randomize(80), 'ZoneAirHeatingSetpoint': randomize(60), 'SupplyFanSpeed': randomize(0.5), 'SupplyAirSetpoint': randomize(70)}
                }
        print({'status':200, 'message':'Success', 'payload':{'output':data,'time':now}})
        return {'status':200, 'message':'Success', 'payload':{'output':data,'time':now}}

class building_control(Resource):
    '''Interface to update the control of FRP.''' 
    def put(self):
        now = strftime("%Y-%m-%d-%H-%M-%S", gmtime())
        try:
            data = request.get_json() 
        except:
            return {'status':400, 'message':'Unexpected Input', 'payload':None}    
        print({'status':200, 'message':'Success', 'payload':{'input':data,'time':now}})   
        return {'status':200, 'message':'Success', 'payload':{'input':data,'time':now}}

api.add_resource(building_data, '/get_point')
api.add_resource(building_control, '/set_point')

if __name__ == '__main__':
    app.run(host='0.0.0.0',debug=False)
