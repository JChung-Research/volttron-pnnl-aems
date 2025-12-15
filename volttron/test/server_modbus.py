from datetime import datetime
from pymodbus.client import ModbusTcpClient
from time import gmtime, strftime
from flask import Flask
from flask_restful import Resource, Api

# ------------------------------------------------------------
# Modbus Configuration
# ------------------------------------------------------------
MODBUS_SERVER_IP_1stFloor = '127.0.0.1'  # Update the device IP address for your project
MODBUS_SERVER_IP_2ndFloor = '127.0.0.1'  # Update the device IP address for your project
MODBUS_PORT = 502

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

file_name = "3147_power_data.json"

# ------------------------------------------------------------
# Utility Functions
# ------------------------------------------------------------

def convert_measurement(measurement_reading):
    if not measurement_reading.isError():
        value = measurement_reading.registers[0]
        if value > 32768:
            value -= 65536
        return value
    else:
        print(f"Error reading: {measurement_reading}")
        return None

# ------------------------------------------------------------
# Main Job
# ------------------------------------------------------------
def read_floor_data(client, circuit_list, room_mapping, floor_name):
    floor_data = {}
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    for circuit_id in circuit_list:
        power_address = circuit_id * 10 + 5
        voltage_address = circuit_id * 10
        current_address = circuit_id * 10 + 2
        pf_address = circuit_id * 10 + 4

        try:
            power_value = convert_measurement(client.read_holding_registers(address=power_address, count=2))
            voltage_value = convert_measurement(client.read_holding_registers(address=voltage_address, count=2)) * 0.1
            current_value = convert_measurement(client.read_holding_registers(address=current_address, count=2)) * 0.01
            pf_value = convert_measurement(client.read_holding_registers(address=pf_address, count=2)) * 0.001

            room = room_mapping.get(circuit_id, f"Unknown {floor_name} Circuit {circuit_id}")
            floor_data[room] = {
                "time": timestamp,
                "power": power_value,
                "voltage": voltage_value,
                "current": current_value,
                "power_factor": pf_value
            }

            print(f"{floor_name} - {room}: P={power_value}, V={voltage_value}, I={current_value}, PF={pf_value}")

        except Exception as e:
            print(f"⚠️ Error reading circuit {circuit_id} on {floor_name}: {e}")

    return floor_data

class building_data(Resource):
    '''Interface to get the energy data from Modbus devices.''' 
    def get(self):
        now = strftime("%Y-%m-%d-%H-%M-%S", gmtime())
        output = {}

        # Collect energy data for both 1st and 2nd floors using read_floor_data function

        # 1st floor
        client1 = ModbusTcpClient(MODBUS_SERVER_IP_1stFloor, port=MODBUS_PORT)
        if client1.connect():
            output.update(read_floor_data(client1, numb_circuit_1stFloor, Floor1_room_mapping, "1st Floor"))
            client1.close()
        else:
            print("❌ Failed to connect to 1st floor meter.")

        # 2nd floor
        client2 = ModbusTcpClient(MODBUS_SERVER_IP_2ndFloor, port=MODBUS_PORT)
        if client2.connect():
            output.update(read_floor_data(client2, numb_circuit_2ndFloor, Floor2_room_mapping, "2nd Floor"))
            client2.close()
        else:
            print(" Failed to connect to 2nd floor meter.")

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