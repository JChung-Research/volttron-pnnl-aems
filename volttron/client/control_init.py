# -*- coding: utf-8 -*-
import requests, json
import logging
from volttron.platform.agent import utils
from datetime import datetime, timezone

utils.setup_logging()
_log = logging.getLogger(__name__)

# BASE = 'http://host.docker.internal:5000'  # or your hosted API endpoint
HEADERS = {'Content-Type': 'application/json'}

now = datetime.now(timezone.utc)
current_timestep = now.hour*3600 + now.minute*60 + now.second

step = 300
scenario_period = 'peak_heat_day'
scenario_pricing = 'highly_dynamic'

def initialize(BASE, testcase):
    _log.info('[INFO] Select testcase: {}'.format(testcase))

    testid = requests.post('{}/testcases/{}/select'.format(BASE,testcase)).json()['testid'] # testcase info should be imported from config files

    init_result = requests.put('{}/initialize/{}'.format(BASE, testid), json={'start_time': 1*24*3600 + current_timestep,
                                                                              'warmup_period': 1*24*3600}).json()['message']
    _log.info('[INFO] testid "{}": {}'.format(testid, init_result))
    
    set_scenario_result = requests.put('{}/scenario/{}'.format(BASE, testid), json={'time_period': scenario_period, 
                                                                                    'electricity_price': scenario_pricing}).json()['message']
    _log.info('[INFO] testid "{}": {}'.format(testid, set_scenario_result))
    
    set_step_result = requests.put('{}/step/{}'.format(BASE, testid), json={'step':step}).json()['message']
    _log.info('[INFO] testid "{}": {}'.format(testid, set_step_result))

    return '{}/advance/{}'.format(BASE, testid)