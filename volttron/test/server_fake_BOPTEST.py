from flask import Flask, request, jsonify

app = Flask(__name__)

# Global simulation state
test_cases = ['bestest_air', 'bestest_hydronic']
current_test_id = None
step = 300
sim_time = 0

@app.route('/testcases', methods=['GET'])
def list_testcases():
    return jsonify({
        'status': 200,
        'message': 'Success',
        'payload': test_cases
    })

@app.route('/testcases/<string:name>/select', methods=['POST'])
def select_testcase(name):
    global current_test_id
    if name in test_cases:
        current_test_id = f'testid_{name}'
        return jsonify({'testid': current_test_id})
    else:
        return jsonify({'status': 404, 'message': 'Test case not found', 'payload': {}}), 404

@app.route('/initialize/<string:testid>', methods=['PUT'])
def initialize(testid):
    return jsonify({'status': 200, 'message': 'Initialized', 'payload': {}})

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

    payload = {
        'time': sim_time,
        'fcu_reaFloSup_y': 0.55,
        'fcu_reaPCoo_y': 0,
        'fcu_reaPFan_y': 173.05008447568497,
        'fcu_reaPHea_y': 811.0584278278242,
        'zon_reaCO2RooAir_y': 316.0569045066186,
        'zon_reaPLig_y': 56.64000000000001,
        'zon_reaPPlu_y': 25.92,
        'zon_reaTRooAir_y': 292.84001603352203,
        'zon_weaSta_reaWeaCeiHei_y': 77777,
        'zon_weaSta_reaWeaCloTim_y': sim_time,
        'zon_weaSta_reaWeaHDifHor_y': 0,
        'zon_weaSta_reaWeaHDirNor_y': 0,
        'zon_weaSta_reaWeaHGloHor_y': 0,
        'zon_weaSta_reaWeaHHorIR_y': 253,
        'zon_weaSta_reaWeaLat_y': 0.6939429105929453,
        'zon_weaSta_reaWeaLon_y': -1.830152253641254,
        'zon_weaSta_reaWeaNOpa_y': 0.3,
        'zon_weaSta_reaWeaNTot_y': 0.7,
        'zon_weaSta_reaWeaPAtm_y': 101325,
        'zon_weaSta_reaWeaRelHum_y': 0.57,
        'zon_weaSta_reaWeaSolAlt_y': -1.2117031187437468,
        'zon_weaSta_reaWeaSolDec_y': -0.40283294927680513,
        'zon_weaSta_reaWeaSolHouAng_y': -2.893169371920129,
        'zon_weaSta_reaWeaSolTim_y': 3416.0653373907476,
        'zon_weaSta_reaWeaSolZen_y': 2.7824994455386434,
        'zon_weaSta_reaWeaTBlaSky_y': 258.4543868019217,
        'zon_weaSta_reaWeaTDewPoi_y': 266.54999999999995,
        'zon_weaSta_reaWeaTDryBul_y': 273.15,
        'zon_weaSta_reaWeaTWetBul_y': 270.67504560460424,
        'zon_weaSta_reaWeaWinDir_y': 3.543018381548489,
        'zon_weaSta_reaWeaWinSpe_y': 2.8,
        'con_oveTSetCoo_activate': 1,
        'con_oveTSetCoo_u': 278.15,
        'con_oveTSetHea_activate': 0,
        'con_oveTSetHea_u': 288.15,
        'fcu_oveFan_activate': 0,
        'fcu_oveFan_u': 1,
        'fcu_oveTSup_activate': 0,
        'fcu_oveTSup_u': 294.15
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
