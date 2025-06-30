import random
from flask import Flask, request, jsonify

app = Flask(__name__)

# Global simulation state
test_cases = ['bestest_air', 'bestest_hydronic']
# Testcase IDs should be multiple consdering scalability
current_test_ids = {}
# u object for each testcase ID should be updated whenever AEMS apps send control inputs
current_test_u = {}
step = 300
sim_time = 0
scenario_period = 'peak_heat_day'
scenario_pricing = 'dynamic'

def randomize (value):
    return value * round(random.uniform(0.95, 1.05), 4)

@app.route('/testcases', methods=['GET'])
def list_testcases():
    return jsonify({
        'status': 200,
        'message': 'Success',
        'payload': test_cases
    })

@app.route('/testcases/<string:name>/select', methods=['POST'])
def select_testcase(name):
    global current_test_ids
    if name in test_cases:
        current_test_ids[f'testid_{name}'] = name
        current_test_u[f'testid_{name}'] = {}

        return jsonify({'testid': f'testid_{name}'})
    else:
        return jsonify({'status': 404, 'message': 'Test case not found', 'payload': {}}), 404

@app.route('/initialize/<string:testid>', methods=['PUT'])
def initialize(testid):
    return jsonify({'status': 200, 'message': 'Initialized', 'payload': {}})

@app.route('/scenario/<string:testid>', methods=['GET'])
def get_scenario(testid):
    return jsonify({'status': 200, 'message': 'OK', 'payload': {'time_period': scenario_period, 'electricity_price': scenario_pricing}})

@app.route('/scenario/<string:testid>', methods=['PUT'])
def set_scenario(testid):
    global scenario_period, scenario_pricing
    scenario_period = request.json.get('time_period', 'peak_heat_day')
    scenario_pricing = request.json.get('electricity_price', 'dynamic')
    return jsonify({'status': 200, 'message': 'Scenario set', 'payload': {'time_period': scenario_period, 'electricity_price': scenario_pricing}})

@app.route('/step/<string:testid>', methods=['GET'])
def get_step(testid):
    return jsonify({'status': 200, 'message': 'OK', 'payload': step})

@app.route('/step/<string:testid>', methods=['PUT'])
def set_step_value(testid):
    global step
    step = request.json.get('step', 300)
    return jsonify({'status': 200, 'message': 'Step set', 'payload': step})

@app.route('/inputs/<string:testid>', methods=['GET'])
def get_inputs(testid):
    return jsonify({'status': 200, 'message': 'Inputs listed', 'payload': {'con_oveTSetCoo_u': 278.15}})

@app.route('/measurements/<string:testid>', methods=['GET'])
def get_measurements(testid):
    return jsonify({'status': 200, 'message': 'Measurements returned', 'payload': {'zon_reaTRooAir_y': 292.84}})

@app.route('/advance/<string:testid>', methods=['POST'])
def advance(testid):
    global sim_time
    sim_time += step

    data = request.get_json()
    print("Inputs for BOPTEST advance: ", data)

    # If the testcase is 'bestest_air'
    if current_test_ids[testid] == 'bestest_air':
        payload = {
            'fcu_oveTSup_u': 294.15,
            'fcu_oveFan_u': 1,
            'con_oveTSetCoo_u': 278.15,
            'con_oveTSetHea_u': 288.15,
            'fcu_reaFloSup_y': 0.55,
            'zon_reaCO2RooAir_y': 316.0569045066186,
            'zon_reaTRooAir_y': 292.84001603352203,
            'fcu_reaPFan_y': 173.05008447568497,
            'fcu_reaPCoo_y': 0,
            'fcu_reaPHea_y': 811.0584278278242
        }

    # If the testcase is 'bestest_hydronic'
    elif current_test_ids[testid] == 'bestest_hydronic':
        payload = {
            'oveTSetSup_u': 294.15,
            'ovePum_u': 1,           
            'oveTSetCoo_u': 278.15,
            'oveTSetHea_u': 288.15,
            'reaCO2RooAir_y': 316.0569045066186,
            'reaTRoo_y': 292.84001603352203,
            'reaPPum_y': 173.05008447568497,
            'reaQHea_y': 811.0584278278242
        }
        
    return jsonify({'status': 200, 'message': 'Advanced', 'payload': payload})

@app.route('/kpi/<string:testid>', methods=['GET'])
def get_kpi(testid):
    return jsonify({
        'status': 200,
        'message': 'KPI returned',
        'payload': {
            'energy': 1234.56,
            'comfort_violation': 0.01,
            'cost': 10.5
        }
    })

@app.route('/forecast_points/<string:testid>', methods=['GET'])
def get_forecast_points(testid):
    return jsonify({'status': 200, 'message': 'Forecast points', 'payload': ['weather.TOut']})

@app.route('/forecast/<string:testid>', methods=['PUT'])
def get_forecast(testid):
    return jsonify({'status': 200, 'message': 'Forecast data', 'payload': {'weather.TOut': [280.0, 281.0]}})

@app.route('/results/<string:testid>', methods=['PUT'])
def get_results(testid):
    return jsonify({'status': 200, 'message': 'Results data', 'payload': {'zon_reaTRooAir_y': [292.8, 292.9]}})

if __name__ == '__main__':
    app.run(port=5000)
