#!/bin/bash
echo "=== Testing greet plugin ==="
printf '{"id":1,"method":"greet.hello","params":{"name":"Niri"}}\n' | ./plugins/greet-go/greet

echo ""
echo "=== Testing logger plugin ==="
printf '{"id":1,"method":"log.info","params":{"message":"test from shell"}}\n' | python3 plugins/logger-py/main.py