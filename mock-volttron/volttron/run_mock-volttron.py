import threading
import traceback
from agents.InterfaceAgent.api import agent as interface_agent
from agents.RecvAgent.recv import agent as recv_agent

# Provide correct paths to your config files
interface_config_path = "config/interface_config_mock"
recv_config_path = "config/recv_config_mock"

def run_interface_agent():
    try:
        interface_agent.main([None, interface_config_path])
    except Exception:
        traceback.print_exc()

def run_recv_agent():
    try:
        recv_agent.main([None, recv_config_path])
    except Exception:
        traceback.print_exc()

t1 = threading.Thread(target=run_interface_agent)
t2 = threading.Thread(target=run_recv_agent)

t1.start()
t2.start()
