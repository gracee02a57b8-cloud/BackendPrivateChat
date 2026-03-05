#!/bin/bash
# Login as Diana
RESP=$(curl -s -X POST https://barsikchat.duckdns.org/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"Diana","password":"test123"}' --insecure)
echo "Login response: $RESP"

TOKEN=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
echo "Token: ${TOKEN:0:20}..."

if [ -z "$TOKEN" ]; then
  echo "No token, trying Сергей..."
  RESP=$(curl -s -X POST https://barsikchat.duckdns.org/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"admin123"}' --insecure)
  echo "Login response: $RESP"
  TOKEN=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
fi

echo ""
echo "=== Room POST ==="
curl -s -X POST "https://barsikchat.duckdns.org/api/rooms/private/%D0%A1%D0%B5%D1%80%D0%B3%D0%B5%D0%B9" \
  -H "Authorization: Bearer $TOKEN" --insecure
echo ""

echo ""
echo "=== Message History ==="
curl -s "https://barsikchat.duckdns.org/api/rooms/pm_Diana_%D0%A1%D0%B5%D1%80%D0%B3%D0%B5%D0%B9/history?page=0&size=25" \
  -H "Authorization: Bearer $TOKEN" --insecure
echo ""
