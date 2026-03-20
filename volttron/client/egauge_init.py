import logging, csv
from volttron.platform.agent import utils
from typing import Dict, Tuple, Any, Union

utils.setup_logging()
_log = logging.getLogger(__name__)

# Base URL for the eguage energy meter API endpoint
HEADERS = {'Content-Type': 'application/json'}

def initialize(BASE, system_id):
    _log.info('Initialize agent "{}"'.format(system_id))
    url = f'{BASE}'
    return url

def preprocessing(payload: Dict, data_point: Dict) -> Tuple[Dict, Dict]:
    """
    Processes raw payload from the eguage API and aligns it with data point definitions.

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
    for key, room_data in input_data.items():
        temp1.setdefault(key, {})
        temp2.setdefault(key, {})

        for subkey, subvalue in room_data.items():
            temp1[key][subkey] = subvalue
            temp2[key][subkey] = data_point.get(subkey, {})

    return temp1, temp2