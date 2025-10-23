import logging, csv
from volttron.platform.agent import utils
from typing import Dict, Tuple, Any, Union

utils.setup_logging()
_log = logging.getLogger(__name__)

# Base URL for the ecobee Smart Themostat API endpoint
HEADERS = {'Content-Type': 'application/json'}

selected_room = ['103','104','105','108','109','110','111','112','118','119','120','122','124','125']

def initialize(BASE, system_id):
    _log.info('Initialize agent "{}"'.format(system_id))
    url = f'{BASE}'
    return url

def build_id_to_name_map(csv_path: str) -> Dict[str, str]:
    """
    Reads a CSV with columns 'id' and 'name' and builds a map from room ID -> room NAME.

    Args:
        csv_path (str): Path to the CSV file containing room 'id' and 'name' columns.

    Returns:
        Dict[str, str]: Mapping of room IDs to their corresponding names.
    """

    id_to_name = {}
    try:
        with open(csv_path, mode='r', newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                room_id = str(row["id"])
                name_parts = row["name"].split()
                if len(name_parts) > 1:
                    id_to_name[room_id] = name_parts[1]
                else:
                    id_to_name[room_id] = row["name"]
    except Exception as e:
        _log.error(f"Error reading CSV file {csv_path}: {e}")
    return id_to_name

def build_name_to_id_map(csv_path: str) -> Dict[str, str]:
    """
    Reads a CSV with columns 'id' and 'name' and builds a map from room NAME -> room ID.

    Args:
        csv_path (str): Path to the CSV file containing room 'id' and 'name' columns.

    Returns:
        Dict[str, str]: Mapping of room name to their corresponding IDs.
    """
    name_to_id: Dict[str, str] = {}
    try:
        with open(csv_path, mode='r', newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                room_id = str(row["id"]).strip()
                # Normalize the name the same way you created names in build_id_to_name_map
                parts = str(row["name"]).split()
                room_name = parts[1] if len(parts) > 1 else str(row["name"])
                room_name = room_name.strip()
                name_to_id[room_name] = room_id
    except Exception as e:
        _log.error(f"Error reading CSV file {csv_path}: {e}")
    return name_to_id

def convert_ids_to_names(data: Dict, id_to_name_map: Dict) -> Dict:
    """
    Converts numeric room IDs in the input data to names.

    Args:
        data (Dict): Original data with room IDs as keys.
        id_to_name_map (Dict): Mapping of room IDs to names.

    Returns:
        Dict: Updated data with room names as keys.
    """
    return {id_to_name_map.get(str(k), str(k)): v for k, v in data.items() if id_to_name_map.get(str(k), str(k)) in selected_room}

def convert_names_to_ids(data: Dict) -> Dict:
    """
    Converts room NAME keys in `data` back to room IDs.

    Args:
        data (Dict): Data with room names as keys.

    Returns:
        Dict: Updated data with room IDs as keys.
    """

    name_to_id_map = build_name_to_id_map('/home/volttron/volttron/app_agents/client/3147_room_id.csv')
    return {name_to_id_map.get(str(k), str(k)): v for k, v in data.items() if k in selected_room}

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
    
    id_to_name_map = build_id_to_name_map('/home/volttron/volttron/app_agents/client/3147_room_id.csv')
    converted_data = convert_ids_to_names(input_data, id_to_name_map)

    temp1, temp2 = {}, {}
    for key, room_data in converted_data.items():
        temp1.setdefault(key, {})
        temp2.setdefault(key, {})
        
        for subkey, subvalue in room_data.items():
            if subkey == 'Setpoint' and isinstance(subvalue, type({})):
                for param, value in subvalue.items():
                    temp1[key][param] = value
                    temp2[key][param] = data_point.get(param, {})
            else:
                temp1[key][subkey] = subvalue
                temp2[key][subkey] = data_point.get(subkey, {})

    return temp1, temp2

def ecobee_control(input_object: Union[str, Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
    output_object: Dict[str, Dict[str, float]] = {}

    for room_id, settings in input_object.items():

        desired_heat = settings.get("desiredHeat")
        desired_cool = settings.get("desiredCool")
        mode = settings.get("HVACMode")

        new_setpoint = None
        if mode == "heat":
            new_setpoint = desired_heat
        elif mode == "cool":
            new_setpoint = desired_cool
        else:
            new_setpoint = desired_heat

        output_object[room_id] = {"TSet": new_setpoint}

    return output_object