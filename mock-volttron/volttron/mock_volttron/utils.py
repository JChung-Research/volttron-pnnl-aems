import datetime
import logging
import time
import threading

# GLOBAL PUBSUB MESSAGE BUS
PUBSUB_REGISTRY = {}  # topic -> list of subscriber callbacks

class Unreachable(Exception):
    """Simulates a connection error raised during pubsub operations."""
    pass

def load_config(path):
    """
    Load JSON configuration from a file.
    """
    import json
    with open(path) as f:
        return json.load(f)

def setup_logging():
    logging.basicConfig(level=logging.INFO)

def get_aware_utc_now():
    return datetime.datetime.utcnow()

def format_timestamp(dt):
    return dt.isoformat()

class MockCore:
    """
    Lightweight mock core for scheduling periodic tasks in agents.
    """
    def schedule(self, func, callback):
        """
        Run `callback` repeatedly every `func` seconds in a separate thread.
        """
        def loop():
            while True:
                time.sleep(func)
                try:
                    callback()
                except Exception as e:
                    print(f"[MOCK] Error in scheduled function: {e}")
                    break
        t = threading.Thread(target=loop, daemon=True)
        t.start()

def vip_main(agent_class, version=None, argv=None):
    """
    Simulates agent startup behavior in the mock-VOLTTRON environment.
    """
    
    print(f"[MOCK] Starting agent: {agent_class.__name__} (version={version})")

    if argv is None or len(argv) < 2:
        raise ValueError("Missing config_path in argv.")

    config_path = argv[1]
    agent = agent_class(config_path)

    # Inject mock 'core' into agent
    agent.core = MockCore()

    if hasattr(agent, 'onsetup'):
        try:
            agent.onsetup('mock_sender')
        except Exception as e:
            print(f"[MOCK] Error in onsetup: {e}")

    # Simulate 'onstart'
    if hasattr(agent, 'onstart'):
        try:
            agent.onstart('mock_sender')
        except Exception as e:
            print(f"[MOCK] Error in onstart: {e}")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print(f"[MOCK] Stopping agent: {agent_class.__name__}")