# -*- coding: utf-8 -*-
import requests, json

url = "http://127.0.0.1:5100"

def call_back(u): 
    u = {
            "con_oveTSetCoo_u": 278.15,
            "con_oveTSetCoo_activate": 1
    }    
    return u