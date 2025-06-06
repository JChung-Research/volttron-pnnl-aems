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

import requests
import json
import importlib
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

DEFAULT_HEARTBEAT_PERIOD =60

class APIAgent(Agent):
    """Listens to everything and publishes a heartbeat according to the
    heartbeat period specified in the settings module.
    """

    def __init__(self, config_path, **kwargs):
        super().__init__(**kwargs)
        self.config = utils.load_config(config_path)
        self._heartbeat_period = self.config.get('heartbeat_period',
                                                 DEFAULT_HEARTBEAT_PERIOD)
        self.url = self.config['url']
        self.points = self.config['data_point']
        self.num_advance = 0
        self.u = None
        try:
            control_class="{}.{}".format(self.config['module'],self.config['class'])
            controller = importlib.import_module(control_class)
            self.compute_control = controller.compute_control
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
        if self._heartbeat_period != 0:
            self.core.schedule(periodic(self._heartbeat_period), self.control_advance)

    def control_advance(self):
        headers = {TIMESTAMP: format_timestamp(get_aware_utc_now())}
        result = requests.get('{0}/get_point'.format(self.url),
                                                 headers={"Content-type":"application/json"}).json()
        if result['status'] == 200:
            self.num_advance += 1
            if self.num_advance == 1:
                 self.u = self.initialize()            
            raw_data = result['payload']['output']
            temp1 = {}
            temp2 = {}
            Request_SAT_tot = 0
            for key in raw_data:
                for subkey in raw_data[key]:
                    temp1[key+'_'+subkey] = raw_data[key][subkey]
                    temp2[key+'_'+subkey] = self.points[subkey]
            self.u = self.compute_control(self.u, raw_data)
            json_object = json.dumps(self.u, default=str) 
            result = requests.put('{0}/set_point'.format(self.url),
                                                 headers={"Content-type":"application/json"},
                                                 data=json_object).json()
            if result['status'] == 200:
                _log.info('New control signals are sent')
            topic = 'devices/ORNL/FRP2/all'
            try:
                self.vip.pubsub.publish(peer='pubsub',
                                        topic=topic,
                                        message=self.u,  # [data, {'source': 'publisher3'}],
                                        headers=headers).get(timeout=2)
            except Unreachable as exc:
                self.connect_error = True
                self.stop()                

            message = []
            message.append(temp1)
            message.append(temp2)        
            try:
                self.vip.pubsub.publish(peer='pubsub',
                                        topic=topic,
                                        message=message,  # [data, {'source': 'publisher3'}],
                                        headers=headers).get(timeout=2)
            except Unreachable as exc:
                self.connect_error = True
                self.stop()

def main(argv=sys.argv):
    '''Main method called by the eggsecutable.'''
    try:
        utils.vip_main(APIAgent, version=__version__)
    except Exception as e:
        _log.exception('unhandled exception')

if __name__ == '__main__':
    # Entry point for script
    sys.exit(main())
