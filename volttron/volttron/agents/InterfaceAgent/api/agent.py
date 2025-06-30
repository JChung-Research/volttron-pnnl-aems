# -*- coding: utf-8 -*- {{{
# vim: set fenc=utf-8 ft=python sw=4 ts=4 sts=4 et:
#
# Copyright 2020, Battelle Memorial Institute.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# This material was prepared as an account of work sponsored by an agency of
# the United States Government. Neither the United States Government nor the
# United States Department of Energy, nor Battelle, nor any of their
# employees, nor any jurisdiction or organization that has cooperated in the
# development of these materials, makes any warranty, express or
# implied, or assumes any legal liability or responsibility for the accuracy,
# completeness, or usefulness or any information, apparatus, product,
# software, or process disclosed, or represents that its use would not infringe
# privately owned rights. Reference herein to any specific commercial product,
# process, or service by trade name, trademark, manufacturer, or otherwise
# does not necessarily constitute or imply its endorsement, recommendation, or
# favoring by the United States Government or any agency thereof, or
# Battelle Memorial Institute. The views and opinions of authors expressed
# herein do not necessarily state or reflect those of the
# United States Government or any agency thereof.
#
# PACIFIC NORTHWEST NATIONAL LABORATORY operated by
# BATTELLE for the UNITED STATES DEPARTMENT OF ENERGY
# under Contract DE-AC05-76RL01830
# }}}


import logging
import sys
import importlib

import requests
import json
from volttron.platform.agent import utils
from volttron.platform.messaging.health import STATUS_GOOD
from volttron.platform.vip.agent import Agent, Core, PubSub
from volttron.platform.scheduling import periodic
from volttron.platform.messaging.headers import TIMESTAMP
from volttron.platform.agent.utils import (get_aware_utc_now,
                                           format_timestamp)

utils.setup_logging()
_log = logging.getLogger(__name__)
__version__ = '3.3'

DEFAULT_HEARTBEAT_PERIOD =10
API_HEADER = {'Content-Type': 'application/json'}

# Temperature unit converters (Kelvin / Fahrenheit degree)
def temp_f_to_k(f: float) -> float:
    return ((f - 32) * 5) / 9 + 273.15

def temp_k_to_f(k: float) -> float:
    return ((k - 273.15) * 9) / 5 + 32

class InterfaceAgent(Agent):
    """Listens to everything and publishes a heartbeat according to the
    heartbeat period specified in the settings module.
    """

    def __init__(self, config_path, **kwargs):
        super().__init__(**kwargs)
        self.config = utils.load_config(config_path)
        self._heartbeat_period = self.config.get('heartbeat_period',
                                                 DEFAULT_HEARTBEAT_PERIOD)
        self.url = self.config.get('url', None)
        self.api = self.config.get('api', None)
        self.topic = self.config.get('topic', None)         
        self.points = self.config.get('data_point', None)
        self.inputs = self.config.get('inputs', None)
        self.u = None  
        if self.config['module'] is not None:
            try:
                control_class="{}.{}".format(self.config['module'],self.config['class'])
                controller = importlib.import_module(control_class)
                self.initialize = controller.initialize
            except:
                _log.error('Invalid control module')    
        try:
            self._heartbeat_period = int(self._heartbeat_period)
        except:
            _log.warning('Invalid heartbeat period specified setting to default')
            self._heartbeat_period = DEFAULT_HEARTBEAT_PERIOD        

    @Core.receiver('onstart')
    def onstart(self, sender, **kwargs):
        self.subscribe()
        if self.config['module'] is not None:
            self.url = self.initialize(self.topic.split('/')[2]) # Provide to 'control_init.py' with testcase info for BOPTEST initialization
        if self._heartbeat_period != 0:
            self.core.schedule(periodic(self._heartbeat_period), self.control_update)

    def control_update(self):
        headers = {TIMESTAMP: format_timestamp(get_aware_utc_now())}

        # Check the temperature variables whose unit is Kelvin to convert it to Fahrenheit degree, using 'interface_config' files
        temp_k_vars = [k for k, v in self.points.items() if v['units'] == 'K']

        if self.u is not None:
            # Convert Fahrenheit degree to Kelvin unit for the BOPTEST API
            data = {
                k: temp_f_to_k(v) if k in temp_k_vars else v
                for k, v in self.u.get('payload').items()
                }

        else:
            data = {} 

        result = requests.post('{}'.format(self.url),
                                                 json=data,
                                                 headers=API_HEADER).json()
        
        if result['status'] == 200:
            _log.info('system_id "{}": {}'.format(self.topic.split('/')[2], result['message']))
            raw_data = {
                    k: temp_k_to_f(v) if k in temp_k_vars else v # Convert Kelvin unit to Fahrenheit degree considering the BOPTEST API
                    for k, v in result.get('payload').items() 
                    if k in self.points # Include only variables defined in the 'interface_config' file
                }
            
            temp1 = {}
            temp2 = {}
            Request_SAT_tot = 0
            for key in raw_data:
                temp1[key] = raw_data[key]
                temp2[key] = self.points[key]
               
            message = []
            message.append(temp1)
            message.append(temp2)    
            try:
                self.vip.pubsub.publish(peer='pubsub',
                                        topic=self.topic,
                                        message=message,  # [data, {'source': 'publisher3'}],
                                        headers=headers).get(timeout=2)
            except Unreachable as exc:
                self.connect_error = True
                self.stop()
        else:
            _log.error('Error during BOPTEST advance: ' + result['message'])


    def subscribe(self):
        """
        Subscribe to VOLTTRON topics
        :return:
        """
        topic = self.inputs.get('topic', None)
        if topic is not None:
            callback = self.on_match_topic
            _log.info('subscribed to ' + topic)
            self.vip.pubsub.subscribe(peer='pubsub', prefix=topic, callback=callback)


    def on_match_topic(self, peer, sender, bus, topic, headers, message):
        """
        Callback to capture VOLTTRON messages
        :param peer: 'pubsub'
        :param sender: sender identity
        :param bus:
        :param topic: topic for the message
        :param headers: message header
        :param message: actual message
        :return:
        """
        if message is not None:
            self.u = message
        _log.info(f"Received: {self.u}")




def main(argv=sys.argv):
    '''Main method called by the eggsecutable.'''
    try:
        utils.vip_main(InterfaceAgent, version=__version__)
    except Exception as e:
        _log.exception('unhandled exception')

if __name__ == '__main__':
    # Entry point for script
    sys.exit(main())
