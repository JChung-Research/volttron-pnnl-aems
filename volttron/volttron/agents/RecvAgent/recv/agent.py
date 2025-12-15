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
from pprint import pformat
import datetime
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
DEFAULT_MESSAGE = 'Test Message'
DEFAULT_AGENTID = "rec"
DEFAULT_HEARTBEAT_PERIOD = 5

class RecvAgent(Agent):
    """Listens to everything and publishes a heartbeat according to the
    heartbeat period specified in the settings module.
    """

    def __init__(self, config_path, **kwargs):
        super().__init__(**kwargs)
        self.config = utils.load_config(config_path)
        self.inputs = self.config.get('inputs', None)   
        self.topic = self.config.get('topic', None)
        self.building_id = self.config.get('building', None)
        self.manager_id = self.config.get('manager', None)
        try:
            control_class="{}.{}".format(self.config['module'],self.config['class'])
            controller = importlib.import_module(control_class)
            self.call_back = controller.call_back
        except:
            _log.info('Invalid control module')            


    @Core.receiver('onsetup')
    def onsetup(self, sender, **kwargs):
        # Demonstrate accessing a value from the config file
        _log.info(self.config.get('message', DEFAULT_MESSAGE))
        self.subscribe()


    def subscribe(self):
        """
        Subscribe to VOLTTRON topics
        :return:
        """
        topic = self.inputs.get('topic', None)
        if topic is not None:
            callback = self.on_match_topic
            _log.info('[RecvAgent] subscribed to ' + topic)
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
        msg = message if type(message) == type([]) else [message]

        # Input format for '/set_point' endpoint of server_UI: {manager_id: sensor_data}
        # Response format: sensor_data corresponding to the input manager_id
        y = self.call_back({self.manager_id: msg[0]})
                
        try:
            self.vip.pubsub.publish(peer='pubsub',
                                    topic=self.topic,
                                    message=y,  # [data, {'source': 'publisher3'}],
                                    headers=headers).get(timeout=2)
        except Unreachable as exc:
            self.connect_error = True
            self.stop()        


def main(argv=sys.argv):
    '''Main method called by the eggsecutable.'''
    try:
        utils.vip_main(RecvAgent, version=__version__)
    except Exception as e:
        _log.exception('unhandled exception')


if __name__ == '__main__':
    # Entry point for script
    sys.exit(main())
