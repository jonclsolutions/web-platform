#!/usr/bin/env bash
#
# @file test_permissions_403.sh
# @path dev_docs/test_permissions_403.sh
# @project RPSW Web
# @author RPSW
# @created 2026
# @description Manual security check: verifies that the API itself (not only the Angular UI)
# refuses every operation on `core/users` for a user WITHOUT the administrators permissions.
# Each request must end with HTTP 403.
# @dependencies
# - bash, curl
# - A running API (default http://127.0.0.1:8000/api) and the access token of a signed-in test
#   user that does NOT hold core-administrators-view / -create / -update / -delete.
#
# @usage
#   ./test_permissions_403.sh            # asks for the target user id and for the token
#   ./test_permissions_403.sh 57         # target user id given up front, asks only for the token
#   API=https://example.test/api ./test_permissions_403.sh
#
# @note
# - The token is read with a hidden prompt, so it never lands in the shell history or on screen.
# - POST / PUT / PATCH send an EMPTY JSON body on purpose: if a permission check were missing, the
#   request would stop at validation (422) instead of creating or changing a record.
# - DELETE cannot be made harmless. If the permission check were missing, the target user would
#   be (soft) deleted, so the target must be a disposable TEST account.
# - Use a target id DIFFERENT from the user the token belongs to. On their own id a user may be
#   allowed to update themselves (profile, 2FA) and is refused deletion for another reason
#   (CANNOT_DELETE_OWN_ACCOUNT), which would make the result misleading.

set -u

API="${API:-http://127.0.0.1:8000/api}"
RESOURCE="core/users"

# The target id is never hard-coded: test accounts come and go, and a stale id would only test
# "user not found" instead of the permission.
TARGET_ID="${1:-}"
if [ -z "$TARGET_ID" ]; then
  read -rp "Target user id (a TEST account, not the one the token belongs to): " TARGET_ID
fi
if ! [[ "$TARGET_ID" =~ ^[1-9][0-9]*$ ]]; then
  echo "Target user id must be a positive number, got '$TARGET_ID'." >&2
  exit 2
fi

if [ -z "${TOKEN:-}" ]; then
  read -rsp "Access token of the test user (input hidden): " TOKEN
  echo
fi
# A token copied with a trailing line break corrupts the request headers.
TOKEN="$(printf '%s' "$TOKEN" | tr -d '[:space:]')"
if [ -z "$TOKEN" ]; then
  echo "No token given." >&2
  exit 2
fi

BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT
failed=0

# check <method> <path> [json-body] [allowed-status-regex]
# Sends one request and reports PASS when the status matches the allowed ones (default: 403).
check() {
  local method="$1" path="$2" body="${3:-}" allowed="${4:-403}"
  local args=(-sS -o "$BODY_FILE" -w '%{http_code}' -X "$method" "$API/$path"
              -H 'Accept: application/json' -H "Authorization: Bearer $TOKEN")
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' -d "$body")
  fi

  local status
  status="$(curl "${args[@]}" 2>/dev/null)" || status="000"
  local reply
  reply="$(head -c 140 "$BODY_FILE" | tr -d '\n')"

  if [ "$status" = "401" ]; then
    echo "STOP  $method $path -> 401: the token is invalid or expired, nothing was tested." >&2
    exit 2
  fi

  if [[ "$status" =~ ^($allowed)$ ]]; then
    printf 'PASS  %-6s %-22s -> %s  %s\n' "$method" "$path" "$status" "$reply"
  else
    printf 'FAIL  %-6s %-22s -> %s  (expected %s)  %s\n' "$method" "$path" "$status" "$allowed" "$reply"
    failed=$((failed + 1))
  fi
}

echo "API: $API   target user id: $TARGET_ID"
echo

check GET    "$RESOURCE"
check GET    "$RESOURCE/$TARGET_ID"
check POST   "$RESOURCE"            '{}'
check PUT    "$RESOURCE/$TARGET_ID" '{}'
# PATCH: 405 is fine as well, it only means the API defines no PATCH route for users.
check PATCH  "$RESOURCE/$TARGET_ID" '{}' '403|405'
check DELETE "$RESOURCE/$TARGET_ID"

echo
if [ "$failed" -eq 0 ]; then
  echo "OK: every request was refused."
else
  echo "PROBLEM: $failed request(s) were NOT refused. 422 = the permission check is missing or runs"
  echo "after validation; 200/201/204 = the operation was carried out; 000 = no reply from the server."
  exit 1
fi