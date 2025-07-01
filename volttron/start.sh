#!/bin/bash

cd /home/volttron/volttron || exit 1

# Activate virtual environment
source env/bin/activate

# Start Volttron in background
volttron -vv -l v.log > /dev/null 2>&1 &
disown

# Wait briefly to ensure Volttron has started (optional but often helpful)
sleep 30

# Run upgrade scripts
bash upgrade_scripts/upgrade_interface_bestest-air
bash upgrade_scripts/upgrade_rec_bestest-air
bash upgrade_scripts/upgrade_interface_bestest-hydronic
bash upgrade_scripts/upgrade_rec_bestest-hydronic

# Keep container running and output logs
tail -f v.log
