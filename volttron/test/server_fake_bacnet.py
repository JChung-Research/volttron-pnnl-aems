import random
from time import gmtime, strftime
from flask import Flask
from flask_restful import Resource, Api

app = Flask(__name__)
api = Api(app)

def randomize (value):
    return round(value * random.uniform(0.95, 1.05), 4)

class building_data(Resource):
    '''Interface to get the operation information from BACnet devices.''' 
    def get(self):
        now = strftime("%Y-%m-%d-%H-%M-%S", gmtime())
        data = {
            "voltage l1": 10.0,
            "voltage l2": 1.0,
            "voltage l3": 2.0,
            "sensor s3": 0.8009964227676392,
            "sensor s2": 2.089770555496216,
            "sensor s1": 0.20827734470367432,
            "frequency l1": 0.0,
            "frequency l2": 0.0,
            "frequency l3": 0.0,
            "frequency s3": 1.0693128108978271,
            "frequency s2": 0.0,
            "frequency s1": 60.20947265625,
            "timestamp": 2672.084716796875,
            "oldval usage": 0.9291016459465027,
            "oldval l1 voltage": 543686592.0,
            "oldval l2 voltage": 8487799.0,
            "oldval l3 voltage": 8428707.0,
            "oldval internal temperature": 21916270592.0,
            "oldval internal humidity": 30523531264.0,
            "oldchg usage": 0.0,
            "oldchg l1 votage": 0.0,
            "oldchg l2 votage": 0.0,
            "oldchg l3 votage": 0.0,
            "oldchg internal temperature": 27.177000045776367,
            "oldchg internal humidity": 44.38399887084961,
            "mean voltage l1": -0.0,
            "mean voltage l2": -0.0,
            "mean voltage l3": -0.0,
            "mean sensor s3": 0.24315595626831055,
            "mean sensor s2": -2.0895583629608154,
            "mean sensor s1": 0.0,
            "regval l1 voltage": 543686592.0,
            "regval l2 voltage": 8487799.0,
            "regval l3 voltage": 8428707.0,
            "regval internal temperature": 21916270592.0,
            "regval internal humidity": 30523576320.0,
            "regchg l1 voltage": 0.0,
            "regchg l2 voltage": 0.0,
            "regchg l3 voltage": 0.0,
            "regchg internal temperature": 27.177000045776367,
            "regchg internal humidity": 44.38399887084961
        }

        # Extract only voltage and electric current data
        voltage_l1 = float(data.get("voltage l1", 0.0))
        voltage_l2 = float(data.get("voltage l2", 0.0))
        voltage_l3 = float(data.get("voltage l3", 0.0))
        current_s1 = float(data.get("sensor s1", 0.0))
        current_s2 = float(data.get("sensor s2", 0.0))
        current_s3 = float(data.get("sensor s3", 0.0))

        # Compute electric powers
        power_hvac1 = voltage_l1 * current_s1
        power_hvac2 = voltage_l2 * current_s2
        power_hvac3 = voltage_l3 * current_s3

        # Randomize the output values for testing (Get 95% to 105% of the actual vales)
        output = {
            "power_hvac1": randomize(power_hvac1),
            "power_hvac2": randomize(power_hvac2),
            "power_hvac3": randomize(power_hvac3)
        }

        print("Output from BACnet API: ", output)

        return {'status': 200, 'message': None, 'payload': {'output': output, 'time': now}}

api.add_resource(building_data, '/get_point')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5007, debug=False)
