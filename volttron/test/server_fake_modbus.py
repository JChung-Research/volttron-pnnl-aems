from datetime import datetime
import random
from time import gmtime, strftime
from flask import Flask
from flask_restful import Resource, Api

numb_circuit_1stFloor = [1, 2, 5, 6, 9, 10, 13, 14, 17, 18, 21, 22, 25, 26, 29, 30, 33, 34, 37, 38, 43, 46, 47, 50, 54, 58, 62]
numb_circuit_2ndFloor = [1, 2, 5, 6, 9, 10, 13, 14, 17, 18, 21, 22, 25, 26, 29, 30, 33, 34, 37, 38, 44, 45, 49, 50, 56, 60]

Floor1_room_mapping = {
    1: "Room 123", 2: "Room 108", 5: "Room 124", 6: "Room 112", 9: "Room 125",
    10: "Room 111", 13: "Room 126", 14: "Room 110", 17: "Room 127", 18: "Room 109",
    21: "Room 128", 22: "Room 107", 25: "Room 117", 26: "Room 106", 29: "Room 118",
    30: "Room 105", 33: "Room 122", 34: "Room 104", 37: "Room 102", 38: "Room 103",
    43: "Room 100 Wall Heater", 46: "Room 121", 47: "Room 115 Wall Heater",
    50: "Room 120", 54: "AC 3 Blower", 58: "Room 116 Wall Heater", 62: "Room 119"
}

Floor2_room_mapping = {
    1: "Room 222", 2: "Room 212", 5: "Room 223", 6: "Room 211", 9: "Room 224",
    10: "Room 210", 13: "Room 225", 14: "Room 209", 17: "Room 226", 18: "Room 208",
    21: "Room 227", 22: "Room 207", 25: "Room 216", 26: "Room 206", 29: "Room 217",
    30: "Room 205", 33: "Room 202", 34: "Room 204", 37: "Room 221", 38: "Room 203",
    44: "RTU 1st Floor", 45: "Room 218", 49: "Room 219", 50: "RTU 2nd Floor",
    56: "Room 220", 60: "Conference Room"
}

def randomize (value):
    return round(value * random.uniform(0.95, 1.05), 4)

# ------------------------------------------------------------
# Main Job
# ------------------------------------------------------------
def read_floor_data(client, circuit_list, room_mapping, floor_name):
    floor_data = {}
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    for circuit_id in circuit_list:
        try:
            # Randomize the output values for testing (Get 95% to 105% of the actual vales)
            power_value = randomize(20)
            voltage_value = randomize(10)
            current_value = randomize(2)
            pf_value = randomize(0.1)

            room = room_mapping.get(circuit_id, f"Unknown {floor_name} Circuit {circuit_id}")
            floor_data[room] = {
                "time": timestamp,
                "power": power_value,
                "voltage": voltage_value,
                "current": current_value,
                "power_factor": pf_value
            }

        except Exception as e:
            print(f"⚠️ Error reading circuit {circuit_id} on {floor_name}: {e}")

    return floor_data


class building_data(Resource):
    '''Interface to get the energy data from Modbus devices.''' 
    def get(self):
        now = strftime("%Y-%m-%d-%H-%M-%S", gmtime())
        output = {}

        # Collect energy data for both 1st and 2nd floors using read_floor_data function
        output.update(read_floor_data(None, numb_circuit_1stFloor, Floor1_room_mapping, "1st Floor"))
        output.update(read_floor_data(None, numb_circuit_2ndFloor, Floor2_room_mapping, "2nd Floor"))

        print("Output from Modbus API: ", output)        

        return {'status': 200, 'message': None, 'payload': {'output': output, 'time': now}}


# ------------------------------------------------------------
# API Configuration
# ------------------------------------------------------------
app = Flask(__name__)
api = Api(app)

api.add_resource(building_data, '/get_point')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5008, debug=False)