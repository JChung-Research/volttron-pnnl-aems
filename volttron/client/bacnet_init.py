import logging, csv
from volttron.platform.agent import utils
from typing import Dict, Tuple, Any, Union

utils.setup_logging()
_log = logging.getLogger(__name__)

# Base URL for the ecobee Smart Themostat API endpoint
BASE = 'http://bacnet-test:5006'
HEADERS = {'Content-Type': 'application/json'}

def initialize(system_id):
    _log.info('Initialize agent "{}"'.format(system_id))
    url = f'{BASE}'
    return url

def preprocessing(payload: Dict, data_point: Dict) -> Tuple[Dict, Dict]:
    """
    Processes raw payload from the ecobee API and aligns it with data point definitions.

    Args:
        payload (Dict): Incoming payload containing real-time thermostat data.
        data_point (Dict): Mapping of parameter names to their metadata from config files.

    Returns:
        Tuple[Dict, Dict]: 
            - temp1: Extracted real-time values for each room/parameter.
            - temp2: Corresponding metadata from data_point.
    """
    try:
        input_data = payload['output']
    except KeyError as e:
        _log.error(f"Error reading payload: missing key {e}. Payload was: {payload}")
        return {}, {}

    temp1, temp2 = {}, {}
    for subkey, subvalue in input_data.items():
            temp1[subkey] = subvalue
            temp2[subkey] = data_point.get(subkey, {})

    return temp1, temp2