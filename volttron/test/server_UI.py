import json
import time
from flask import Flask, jsonify, request
from flask_restful import Resource, Api, reqparse
import pandas as pd
from time import gmtime, strftime


app = Flask(__name__)
api = Api(app)
u = {}
y = {}


class building_control(Resource):
    '''Interface to update the control of FRP.''' 
    def put(self):
        try:
            y = request.get_json() 
        except:
            return {'status':400, 'message':'Unexpected Input', 'payload':None}     
        return {'status':200, 'message':None, 'payload':u}
        
class ui_control(Resource):
    '''Interface to update the control of FRP.''' 
    def post(self):
        try:
            inputs = request.get_json() 
        except:
            return {'status':400, 'message':'Unexpected Input', 'payload':None}     
        return {'status':200, 'message':None, 'payload':y}

api.add_resource(building_control, '/set_point')
api.add_resource(ui_control, '/gs')

if __name__ == '__main__':
    app.run(host='0.0.0.0',port=5100,debug=False)
