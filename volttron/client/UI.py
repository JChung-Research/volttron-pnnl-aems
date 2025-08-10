# -*- coding: utf-8 -*-
import requests, json
import logging
from volttron.platform.agent import utils

utils.setup_logging()
_log = logging.getLogger(__name__)

url = "http://host.docker.internal:5100"
HEADERS = {'Content-Type': 'application/json'}

def call_back(obj):
    """
    Send sensor data for a system (zone/testcase) to server_UI API. 
    
    Args:
        obj (dict): A dictionary where each key is a system ID and the value is the corresponding sensor data.

    Returns:
        dict: Response from the server_UI API, containing the updated 'u' control object for the system ID.
    """
    
    json_object = json.dumps(obj, indent = 4,default=str)
    result = requests.put('{0}/set_point'.format(url),headers=HEADERS, data=json_object).json()
    _log.info(f"Result from server_UI: {result}")
    return result