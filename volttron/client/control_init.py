# -*- coding: utf-8 -*-
import requests, json

BASE = 'http://host.docker.internal:5000'  # or your hosted API endpoint
HEADERS = {'Content-Type': 'application/json'}

def initialize():
    testid = requests.post('{}/testcases/{}/select'.format(BASE,'bestest_air')).json()['testid']
    return '{}/advance/{}'.format(BASE,testid)