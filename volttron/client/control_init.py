# -*- coding: utf-8 -*-
import requests, json
import logging
from volttron.platform.agent import utils

utils.setup_logging()
_log = logging.getLogger(__name__)

# BASE = 'http://host.docker.internal:5000'  # or your hosted API endpoint
BASE = 'http://api.boptest.net' # LBNL's BOPTEST API endpoint
HEADERS = {'Content-Type': 'application/json'}

step = 300
scenario_period = 'peak_heat_day'
scenario_pricing = 'highly_dynamic'

def initialize(testcase):
    testid = requests.post('{}/testcases/{}/select'.format(BASE,testcase)).json()['testid'] # testcase info should be imported from config files
    
    init_result = requests.put('{}/initialize/{}'.format(BASE, testid), json={'start_time': 1*24*3600,
                                                                              'warmup_period': 1*24*3600}).json()['message']
    _log.info('[INFO] testid "{}": {}'.format(testid, init_result))
    
    set_scenario_result = requests.put('{}/scenario/{}'.format(BASE, testid), json={'time_period': scenario_period, 
                                                                                    'electricity_price': scenario_pricing}).json()['message']
    _log.info('[INFO] testid "{}": {}'.format(testid, set_scenario_result))
    
    set_step_result = requests.put('{}/step/{}'.format(BASE, testid), json={'step':step}).json()['message']
    _log.info('[INFO] testid "{}": {}'.format(testid, set_step_result))

    return '{}/advance/{}'.format(BASE, testid)