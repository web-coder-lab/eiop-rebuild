#!/bin/sh
set -e
cd "$(dirname "$0")/.."
export NODE_ENV=development
export PORT=3010
export SESSION_SECRET=dev-only-session-secret-do-not-use-in-prod-32
export DATA_DIR=./data
npx --yes tsx server/src/index.ts &
PID=$!
sleep 2
live=$(curl -sS "http://127.0.0.1:$PORT/api/v1/health/live")
ready=$(curl -sS "http://127.0.0.1:$PORT/api/v1/health/ready")
miss=$(curl -sS -o /tmp/eiop-miss.json -w "%{http_code}" "http://127.0.0.1:$PORT/api/v1/does-not-exist")
home=$(curl -sS -o /tmp/eiop-home.html -w "%{http_code}" "http://127.0.0.1:$PORT/home")
apk=$(curl -sS "http://127.0.0.1:$PORT/api/v1/download/apk/status")
kill $PID
echo "LIVE=$live"
echo "READY=$ready"
echo "MISSING_API=$miss"
echo "HOME_SPA=$home"
echo "APK=$apk"
echo "$live" | grep -q '"status":"ok"' 
echo "$ready" | grep -q '"status":"ready"'
test "$miss" = "404"
test "$home" = "200"
echo SMOKE_OK
