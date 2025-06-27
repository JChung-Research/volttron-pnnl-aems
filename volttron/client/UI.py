# -*- coding: utf-8 -*-
import requests, json

url = "http://127.0.0.1:5100"

def call_back(u):
    json_object = json.dumps(u, indent = 4,default=str)
    result = requests.put('{0}/set_point'.format(url),headers={"Content-type":"application/json"}, data=json_object).json()
    return result