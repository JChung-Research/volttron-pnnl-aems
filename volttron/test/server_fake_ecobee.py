import json
from time import gmtime, strftime
from flask import Flask, jsonify, request
from flask_restful import Resource, Api, reqparse

app = Flask(__name__)
api = Api(app)

# Fake response for '/get_point' 
get_point_response = {
    "531617873113": {
        "ZoneTemperature": 73.6,
        "Setpoint": {
            "desiredHeat": 68,
            "desiredCool": 68
        },
        "HVACMode": "heat"
    },
    "531631453672": {
        "ZoneTemperature": 72.1,
        "Setpoint": {
            "desiredCool": 72,
            "desiredHeat": 66
        },
        "HVACMode": "auto"
    },
    "531678996237": {
        "ZoneTemperature": 74.8,
        "Setpoint": {
            "desiredHeat": 74,
            "desiredCool": 74
        },
        "HVACMode": "cool"
    },
    "531653961395": {
        "ZoneTemperature": 72.9,
        "Setpoint": {
            "desiredHeat": 73,
            "desiredCool": 73
        },
        "HVACMode": "cool"
    },
    "531623356246": {
        "ZoneTemperature": 71.9,
        "Setpoint": {
            "desiredHeat": 72,
            "desiredCool": 72
        },
        "HVACMode": "cool"
    },
    "531634335805": {
        "ZoneTemperature": 73.3,
        "Setpoint": {
            "desiredHeat": 75,
            "desiredCool": 75
        },
        "HVACMode": "cool"
    },
    "531633893168": {
        "ZoneTemperature": 73.6,
        "Setpoint": {
            "desiredHeat": 76,
            "desiredCool": 76
        },
        "HVACMode": "cool"
    },
    "531621915562": {
        "ZoneTemperature": 75.6,
        "Setpoint": {
            "desiredHeat": 76,
            "desiredCool": 76
        },
        "HVACMode": "cool"
    },
    "531638117506": {
        "ZoneTemperature": 75.3,
        "Setpoint": {
            "desiredHeat": 75,
            "desiredCool": 75
        },
        "HVACMode": "cool"
    },
    "531642430080": {
        "ZoneTemperature": 75.3,
        "Setpoint": {
            "desiredHeat": 76,
            "desiredCool": 76
        },
        "HVACMode": "cool"
    },
    "531614088343": {
        "ZoneTemperature": 75.7,
        "Setpoint": {
            "desiredHeat": 75,
            "desiredCool": 75
        },
        "HVACMode": "cool"
    },
    "531606617452": {
        "ZoneTemperature": 66.9,
        "Setpoint": {
            "desiredHeat": 67,
            "desiredCool": 67
        },
        "HVACMode": "cool"
    },
    "531626050297": {
        "ZoneTemperature": 70.3,
        "Setpoint": {
            "desiredHeat": 70,
            "desiredCool": 70
        },
        "HVACMode": "cool"
    },
    "531696621601": {
        "ZoneTemperature": 72.6,
        "Setpoint": {
            "desiredHeat": 72,
            "desiredCool": 72
        },
        "HVACMode": "cool"
    },
    "531638394950": {
        "ZoneTemperature": 74.5,
        "Setpoint": {
            "desiredHeat": 75,
            "desiredCool": 75
        },
        "HVACMode": "cool"
    },
    "531612640107": {
        "ZoneTemperature": 75.5,
        "Setpoint": {
            "desiredHeat": 75,
            "desiredCool": 75
        },
        "HVACMode": "cool"
    },
    "531697433113": {
        "ZoneTemperature": 71.5,
        "Setpoint": {
            "desiredHeat": 72,
            "desiredCool": 72
        },
        "HVACMode": "cool"
    },
    "531607424446": {
        "ZoneTemperature": 74.8,
        "Setpoint": {
            "desiredHeat": 75,
            "desiredCool": 75
        },
        "HVACMode": "cool"
    },
    "522600853681": {
        "ZoneTemperature": 76.4,
        "Setpoint": {
            "desiredHeat": 78,
            "desiredCool": 78
        },
        "HVACMode": "cool"
    },
    "531643601340": {
        "ZoneTemperature": 75,
        "Setpoint": {
            "desiredCool": 75,
            "desiredHeat": 68
        },
        "HVACMode": "auto"
    },
    "531629395319": {
        "ZoneTemperature": 74.3,
        "Setpoint": {
            "desiredHeat": 75,
            "desiredCool": 75
        },
        "HVACMode": "cool"
    },
    "531670338244": {
        "ZoneTemperature": 71.8,
        "Setpoint": {
            "desiredHeat": 72,
            "desiredCool": 72
        },
        "HVACMode": "cool"
    },
    "522645860143": {
        "ZoneTemperature": 75.6,
        "Setpoint": {
            "desiredHeat": 75,
            "desiredCool": 75
        },
        "HVACMode": "cool"
    },
    "531699140206": {
        "ZoneTemperature": 73.9,
        "Setpoint": {
            "desiredHeat": 74,
            "desiredCool": 74
        },
        "HVACMode": "cool"
    },
    "531695360657": {
        "ZoneTemperature": 74.6,
        "Setpoint": {
            "desiredHeat": 75,
            "desiredCool": 75
        },
        "HVACMode": "cool"
    },
    "531690681449": {
        "ZoneTemperature": 76.3,
        "Setpoint": {
            "desiredHeat": 78,
            "desiredCool": 78
        },
        "HVACMode": "cool"
    },
    "531607887416": {
        "ZoneTemperature": 73.3,
        "Setpoint": {
            "desiredHeat": 73,
            "desiredCool": 73
        },
        "HVACMode": "cool"
    },
    "531623263393": {
        "ZoneTemperature": 73.4,
        "Setpoint": {
            "desiredHeat": 77,
            "desiredCool": 77
        },
        "HVACMode": "cool"
    },
    "531679522033": {
        "ZoneTemperature": 74.1,
        "Setpoint": {
            "desiredHeat": 75,
            "desiredCool": 75
        },
        "HVACMode": "cool"
    },
    "531642348884": {
        "ZoneTemperature": 73.3,
        "Setpoint": {
            "desiredHeat": 73,
            "desiredCool": 73
        },
        "HVACMode": "cool"
    },
    "531629931287": {
        "ZoneTemperature": 73.4,
        "Setpoint": {
            "desiredHeat": 72,
            "desiredCool": 72
        },
        "HVACMode": "cool"
    },
    "531618131430": {
        "ZoneTemperature": 74.8,
        "Setpoint": {
            "desiredHeat": 75,
            "desiredCool": 75
        },
        "HVACMode": "cool"
    },
    "531605808668": {
        "ZoneTemperature": 73.5,
        "Setpoint": {
            "desiredHeat": 73,
            "desiredCool": 73
        },
        "HVACMode": "cool"
    },
    "531661334040": {
        "ZoneTemperature": 69.5,
        "Setpoint": {
            "desiredHeat": 70,
            "desiredCool": 70
        },
        "HVACMode": "cool"
    },
    "531620653041": {
        "ZoneTemperature": 75.3,
        "Setpoint": {
            "desiredCool": 75,
            "desiredHeat": 68
        },
        "HVACMode": "auto"
    },
    "531697345977": {
        "ZoneTemperature": 72.8,
        "Setpoint": {
            "desiredHeat": 75,
            "desiredCool": 75
        },
        "HVACMode": "cool"
    },
    "531678990404": {
        "ZoneTemperature": 74.9,
        "Setpoint": {
            "desiredCool": 75,
            "desiredHeat": 68
        },
        "HVACMode": "auto"
    },
    "531697529531": {
        "ZoneTemperature": 72.3,
        "Setpoint": {
            "desiredCool": 72,
            "desiredHeat": 68
        },
        "HVACMode": "auto"
    },
    "531672860035": {
        "ZoneTemperature": 75.7,
        "Setpoint": {},
        "HVACMode": "off"
    },
    "531690950576": {
        "ZoneTemperature": 74.3,
        "Setpoint": {
            "desiredHeat": 75,
            "desiredCool": 75
        },
        "HVACMode": "cool"
    },
    "531629483834": {
        "ZoneTemperature": 71.4,
        "Setpoint": {
            "desiredCool": 72,
            "desiredHeat": 68
        },
        "HVACMode": "auto"
    },
    "531639745823": {
        "ZoneTemperature": 77.5,
        "Setpoint": {},
        "HVACMode": "off"
    },
    "531630731854": {
        "ZoneTemperature": 72,
        "Setpoint": {
            "desiredHeat": 72,
            "desiredCool": 72
        },
        "HVACMode": "cool"
    },
    "531684292349": {
        "ZoneTemperature": 74.3,
        "Setpoint": {
            "desiredHeat": 74,
            "desiredCool": 74
        },
        "HVACMode": "cool"
    },
    "531652339856": {
        "ZoneTemperature": 77.7,
        "Setpoint": {
            "desiredHeat": 77,
            "desiredCool": 77
        },
        "HVACMode": "cool"
    },
    "531666019919": {
        "ZoneTemperature": 74.8,
        "Setpoint": {
            "desiredHeat": 75,
            "desiredCool": 75
        },
        "HVACMode": "cool"
    },
    "531662870189": {
        "ZoneTemperature": 78.9,
        "Setpoint": {
            "desiredHeat": 80,
            "desiredCool": 80
        },
        "HVACMode": "cool"
    },
    "531635785922": {
        "ZoneTemperature": 71.8,
        "Setpoint": {
            "desiredCool": 72.5,
            "desiredHeat": 67.5
        },
        "HVACMode": "auto"
    },
    "531661339739": {
        "ZoneTemperature": 70.9,
        "Setpoint": {
            "desiredHeat": 73,
            "desiredCool": 73
        },
        "HVACMode": "cool"
    },
    "531658550918": {
        "ZoneTemperature": 70.5,
        "Setpoint": {
            "desiredHeat": 70,
            "desiredCool": 70
        },
        "HVACMode": "cool"
    }
}

class building_data(Resource):
    '''Interface to get the operation information from 3147.''' 
    def get(self):
        now = strftime("%Y-%m-%d-%H-%M-%S", gmtime())
        return {'status':200, 'message':None, 'payload':{'output':get_point_response,'time':now}}

class building_control(Resource):
    '''Interface to set the operation information from 3147.''' 
    def put(self):
        now = strftime("%Y-%m-%d-%H-%M-%S", gmtime())
        try:            
            inputs = request.get_json()
            
            if isinstance(inputs, str):
                inputs = json.loads(inputs)
            print("Inputs from VOLTTRON: ", inputs)
        except:
            return {'status':400, 'message':'Unexpected Input', 'payload':{'output':None,'time':now}}    
        for key in inputs.keys():
            new_setpoint = inputs[key]['TSet']
            r_status = {'status': 'success', 'data': {'HVACMode': 'heat'}}
            r_cool = {'status': 'success', 'data': {'type': 'nextTransition', 'desiredTemperature': new_setpoint}}

            if r_status['data']['HVACMode'] == 'heat':
                get_point_response[key]['Setpoint']['desiredHeat'] = new_setpoint
            elif r_status['data']['HVACMode'] == 'cool':
                get_point_response[key]['Setpoint']['desiredCool'] = new_setpoint

            print('{}: Set thermostat status result:'.format(now))
            print(r_status)
            print('{}: Set thermostat cool result:'.format(now))
            print(r_cool)

        return {'status':200, 'message':None, 'payload':{'output':None,'time':now}}


api.add_resource(building_data, '/get_point')
api.add_resource(building_control, '/set_point')

if __name__ == '__main__':
    app.run(host='0.0.0.0',port = 5005, debug=False)
