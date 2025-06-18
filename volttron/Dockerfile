FROM senhuang/volttron:6.x

COPY volttron/scripts /home/volttron/volttron/upgrade_scripts

COPY volttron/agents /home/volttron/volttron/app_agents

COPY client /home/volttron/volttron/app_agents/client

COPY volttron/config /home/volttron/volttron/config

RUN /bin/bash -c "source /home/volttron/volttron/env/bin/activate"

ENV VOLTTRON_HOME=~/.volttron_central

RUN mkdir /home/volttron/.volttron_central

COPY volttron/volttron_config/keystore /home/volttron/.volttron_central/

COPY volttron/volttron_config/config /home/volttron/.volttron_central/

COPY volttron/volttron_config/auth.json /home/volttron/.volttron_central/

USER root

RUN ln -sf /usr/share/zoneinfo/Etc/UTC /etc/localtime && \
    echo "Etc/UTC" > /etc/timezone

RUN chown volttron /home/volttron/.volttron_central/keystore

RUN chown volttron /home/volttron/.volttron_central/config

RUN chown volttron /home/volttron/.volttron_central/auth.json

RUN chown volttron /home/volttron/.volttron_central/ -R

USER volttron

