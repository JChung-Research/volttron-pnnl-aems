# -*- coding: utf-8 -*-
import requests, json

url = "http://host.docker.internal:5100"

def call_back(obj):
    """
    Send sensor data for a system (zone/testcase) to server_UI API. 
    
    Args:
        obj (dict): A dictionary where each key is a system ID and the value is the corresponding sensor data.

    Returns:
        dict: Response from the server_UI API, containing the updated 'u' control object for the system ID.
    """
    
    json_object = json.dumps(obj, indent = 4,default=str)
    result = requests.put('{0}/set_point'.format(url),headers={"Content-type":"application/json"}, data=json_object).json()
    print("\nResult from server_UI: ", result)
    return result