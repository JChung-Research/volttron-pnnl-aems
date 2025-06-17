from mock_volttron.utils import PUBSUB_REGISTRY

class DummyFuture:
    """
    Mock Future object to simulate asynchronous return values from publish calls.
    Always returns True.
    """
    
    def get(self, timeout=None):
        return True

class PubSub:
    """
    Mock implementation of the VOLTTRON PubSub system.
    """

    def publish(self, peer, topic, message, headers=None):
        """
        Simulate publishing a message to a topic and invoke registered callbacks.
        """

        print(f"[MOCK] Publishing to {topic}")
        if topic in PUBSUB_REGISTRY:
            for callback in PUBSUB_REGISTRY[topic]:
                try:
                    callback(peer, "MOCK_SENDER", "MOCK_BUS", topic, headers or {}, message)
                except Exception as e:
                    print(f"[MOCK] Error in subscriber callback: {e}")
                    import traceback
                    traceback.print_exc()
        return DummyFuture()

    def subscribe(self, peer, prefix, callback):
        """
        Registers a callback to simulate topic subscription.
        """
        print(f"[MOCK] Subscribing to {prefix}")
        PUBSUB_REGISTRY.setdefault(prefix, []).append(callback)

class Core:
    """
    Mock VOLTTRON Core for scheduling periodic tasks and receiver stubs.
    """

    def receiver(event_name):
        """
        Dummy receiver for simulating VOLTTRON event handlers.
        """

        def wrapper(func):
            return func
        return wrapper
    
    def schedule(self, periodic_fn, target_fn):
        """
        Simulate a periodic scheduler that runs a function in a background thread.
        """

        import threading
        def periodic_wrapper():
            import time
            while True:
                target_fn()
                time.sleep(1)
        threading.Thread(target=periodic_wrapper, daemon=True).start()


class Agent:
    """
    Mock base Agent class to simulate VOLTTRON agent behavior.
    """
    
    def __init__(self, **kwargs):
        self.vip = type('VIP', (), {})()
        self.vip.pubsub = PubSub()
        self.core = Core()