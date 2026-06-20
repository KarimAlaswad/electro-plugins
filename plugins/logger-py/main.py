import sys
import json
import os

LOG_FILE = "electro-plugins.log"


def send_response(req_id, result=None, error=None):
    response = {"id": req_id}
    if error:
        response["error"] = error
    else:
        response["result"] = result
    sys.stdout.write(json.dumps(response) + "\n")
    sys.stdout.flush()


def handle_request(request):
    method = request.get("method")
    params = request.get("params", {})
    req_id = request.get("id")

    if method == "log.info":
        message = params.get("message", "")
        with open(LOG_FILE, "a") as f:
            f.write(message + "\n")
        send_response(req_id, "ok")

    elif method == "log.list":
        if os.path.exists(LOG_FILE):
            with open(LOG_FILE, "r") as f:
                entries = [line.strip() for line in f.readlines()]
        else:
            entries = []
        send_response(req_id, entries)

    else:
        send_response(req_id, error="Method not found: " + method)


for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        request = json.loads(line)
        handle_request(request)
    except json.JSONDecodeError:
        send_response(None, error="Parse error")