import json
import time
from flask import Flask, jsonify, request
from flask_restful import Resource, Api, reqparse
import pandas as pd
from time import gmtime, strftime


app = Flask(__name__)
api = Api(app)
actuation = False

data = {'102': {'T_OA': 52.7507, 'Flowrate_RTU': 2735.565,'Flowrate_VAV':120, 'T_inlet': 56.07055, 'T_outlet_VAV': 57.07055,'W_inlet': 57.62672, 'T_zone': 69.86182, 'W_zone': 35.98026},
'103': {'T_OA': 52.7507, 'Flowrate_RTU': 2735.565,'Flowrate_VAV':120, 'T_inlet': 56.07055, 'T_outlet_VAV': 57.07055, 'W_inlet': 57.62672, 'T_zone': 70.17014, 'W_zone': 32.85426}, 
'105': {'T_OA': 52.7507, 'Flowrate_RTU': 2735.565,'Flowrate_VAV':370, 'T_inlet': 56.07055, 'T_outlet_VAV': 58.07055, 'W_inlet': 57.62672, 'T_zone': 71.98448, 'W_zone': 30.0906}, 
'106': {'T_OA': 52.7507, 'Flowrate_RTU': 2724.094,'Flowrate_VAV':370, 'T_inlet': 53.76114, 'T_outlet_VAV': 58.07055, 'W_inlet': 63.48672, 'T_zone': 71.46864, 'W_zone': 31.64536}, 
'202': {'T_OA': 52.63218, 'Flowrate_RTU': 2724.094,'Flowrate_VAV':210, 'T_inlet': 53.76114, 'T_outlet_VAV': 58.07055, 'W_inlet': 63.48672, 'T_zone': 69.63652, 'W_zone': 34.17844}, 
'203': {'T_OA': 52.63218, 'Flowrate_RTU': 2724.094,'Flowrate_VAV':150, 'T_inlet': 53.76114, 'T_outlet_VAV': 58.07055, 'W_inlet': 63.48672, 'T_zone': 67.81034, 'W_zone': 36.1252}, 
'204': {'T_OA': 52.63218, 'Flowrate_RTU': 2724.094,'Flowrate_VAV':370, 'T_inlet': 53.76114, 'T_outlet_VAV': 59.07055, 'W_inlet': 63.48672, 'T_zone': 70.26502, 'W_zone': 33.73376}, 
'205': {'T_OA': 52.63218, 'Flowrate_RTU': 2715.832,'Flowrate_VAV':370, 'T_inlet': 52.15812, 'T_outlet_VAV': 58.07055, 'W_inlet': 67.45494, 'T_zone': 72.89267, 'W_zone': 31.11861}, 
'206': {'T_OA': 52.63218, 'Flowrate_RTU': 2715.832,'Flowrate_VAV':370, 'T_inlet': 52.1581, 'T_outlet_VAV': 53.07055, 'W_inlet': 67.45494, 'T_zone': 71.6653, 'W_zone': 33.3849}}


class building_data(Resource):
    '''Interface to get the operation information from FRP.''' 
    def get(self):
        now = strftime("%Y-%m-%d-%H-%M-%S", gmtime())
        print({'status':200, 'message':None, 'payload':{'output':data,'time':now}})
        return {'status':200, 'message':None, 'payload':{'output':data,'time':now}}

class building_control(Resource):
    '''Interface to update the control of FRP.''' 
    def put(self):
        try:
            inputs = request.get_json() 
        except:
            return {'status':400, 'message':'Unexpected Input', 'payload':None}    
        print(inputs)   
        return {'status':200, 'message':None, 'payload':'ok'}

api.add_resource(building_data, '/get_point')
api.add_resource(building_control, '/set_point')

if __name__ == '__main__':
    app.run(host='0.0.0.0',debug=False)
