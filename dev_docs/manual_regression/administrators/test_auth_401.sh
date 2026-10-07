#!/usr/bin/env bash
#
# @file test_auth_401.sh
# @path dev_docs/test_auth_401.sh
# @project RPSW Web
# @author RPSW
# @created 2026
# @description Manual security check: verifies that `core/users` cannot be read without a valid
# session. Every request must end with HTTP 401.
# @dependencies
# - bash, curl
# - A running API (default http://127.0.0.1:8000/api).
#
# @usage
#   ./test_auth_401.sh
#   API=https://example.test/api ./test_auth_401.sh
#
# @note
# - Checks 1 and 2 need nothing: a request without a token and one with a made-up token.
# - Check 3 is optional and is the reason for "log out" in the test steps: paste the token you
#   used BEFORE logging out to prove that logout really invalidated it. Press Enter to skip.
#   The token is read with a hidden prompt, so it never lands in the shell history or on screen.

set -u

API="${API:-http://127.0.0.1:8000/api}"
PATH_TO_CHECK="core/users"

read -rsp "Token from BEFORE logout (optional, Enter to skip): " OLD_TOKEN
echo
OLD_TOKEN="$(printf '%s' "$OLD_TOKEN" | tr -d '[:space:]')"

BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT
failed=0

# check <label> [token]
# Sends GET core/users (with the token when given) and reports PASS only for HTTP 401.
check() {
  local label="$1" token="${2:-}"
  local args=(-sS -o "$BODY_FILE" -w '%{http_code}' "$API/$PATH_TO_CHECK" -H 'Accept: application/json')
  if [ -n "$token" ]; then
    args+=(-H "Authorization: Bearer $token")
  fi

  local status
  status="$(curl "${args[@]}" 2>/dev/null)" || status="000"
  local reply
  reply="$(head -c 100 "$BODY_FILE" | tr -d '\n')"

  if [ "$status" = "401" ]; then
    printf 'PASS  %-22s -> %s  %s\n' "$label" "$status" "$reply"
  else
    printf 'FAIL  %-22s -> %s  (expected 401)  %s\n' "$label" "$status" "$reply"
    failed=$((failed + 1))
  fi
}

echo "API: $API   GET $PATH_TO_CHECK"
echo

check "no token"
check "made-up token" "0|this-token-does-not-exist"
if [ -n "$OLD_TOKEN" ]; then
  check "token after logout" "$OLD_TOKEN"
fi

echo
if [ "$failed" -eq 0 ]; then
  echo "OK: every request was rejected as unauthenticated."
else
  echo "PROBLEM: $failed request(s) were NOT rejected with 401. 200 = data is readable without a valid"
  echo "session; 403 = the token is still accepted; 000 = no reply from the server."
  exit 1
fi