# -*- coding: utf-8 -*-
import requests, json

url = "https://127.0.0.1:8443"

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def call_back(u):
    json_object = json.dumps(u, indent = 4,default=str)    
    result = requests.put('{0}/set_point'.format(url),headers={"Content-type":"application/json"}, data=json_object, verify=False).json()    
    return result