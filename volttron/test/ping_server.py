# ping_server.py
from datetime import datetime, timezone
from flask import Flask

app = Flask(__name__)

@app.get("/ping")
def ping():
    return {"ok": True, "ts": datetime.now(timezone.utc).isoformat()}, 200

if __name__ == "__main__":
    # Bind to all interfaces so other containers can reach it via service name
    app.run(host="0.0.0.0", port=5000, debug=False)