#!/usr/bin/env bash
#
# @file test_role_escalation_403.sh
# @path dev_docs/test_role_escalation_403.sh
# @project RPSW Web
# @author RPSW
# @created 2026
# @description Manual security check: verifies that the API itself (not only the role select in
# the Angular form) refuses to create an account with a role that holds more permissions than
# the caller has. The create request must end with HTTP 403.
# @dependencies
# - bash, curl
# - A running API (default http://127.0.0.1:8000/api).
# - Two roles: a LIMITED one (few permissions, must include core-administrators-create) and a
#   HIGHER one (at least one permission the limited role does not have).
# - The access token of a signed-in user with the LIMITED role.
#
# @usage
#   ./test_role_escalation_403.sh            # asks for the higher role id and for the token
#   ./test_role_escalation_403.sh 7          # higher role id given up front
#   API=https://example.test/api EMAIL=someone@allowed.cz ./test_role_escalation_403.sh
#
# @note
# - The token is read with a hidden prompt, so it never lands in the shell history or on screen.
# - The request body is complete and valid on purpose: an incomplete one would stop at validation
#   (422) and never reach the role check.
# - The test e-mail uses the domain of the token owner, so the e-mail access policy does not
#   refuse it first. Override it with EMAIL=... when that domain is not allowed.
# - The pre-checks read the profile from GET user. When that endpoint fails, the script warns,
#   asks for the test e-mail and runs the check anyway.
# - If the role check were missing, the account WOULD be created (it is reported as FAIL and has
#   to be deleted by hand). Never run this with a sysadmin token; the script refuses one.

set -u

API="${API:-http://127.0.0.1:8000/api}"
REQUIRED_PERMISSION="core-administrators-create"

# The role id is never hard-coded: test roles come and go.
ROLE_ID="${1:-}"
if [ -z "$ROLE_ID" ]; then
  read -rp "Id of the HIGHER role (more permissions than the token owner has): " ROLE_ID
fi
if ! [[ "$ROLE_ID" =~ ^[1-9][0-9]*$ ]]; then
  echo "Role id must be a positive number, got '$ROLE_ID'." >&2
  exit 2
fi

if [ -z "${TOKEN:-}" ]; then
  read -rsp "Access token of the user with the LIMITED role (input hidden): " TOKEN
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

# request <method> <path> [json-body]
# Sends one request, stores the reply body in BODY_FILE and prints the HTTP status.
request() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -o "$BODY_FILE" -w '%{http_code}' -X "$method" "$API/$path"
              -H 'Accept: application/json' -H "Authorization: Bearer $TOKEN")
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' -d "$body")
  fi
  local status
  status="$(curl "${args[@]}" 2>/dev/null)" || status="000"
  printf '%s' "$status"
}

# ── Preconditions: the token must be valid and should belong to a suitable user ──
# The profile is only used for pre-checks. When the API cannot return it, the test still runs,
# the tester is warned and asked for the test e-mail instead.
status="$(request GET user)"
profile=""
case "$status" in
  200)
    profile="$(cat "$BODY_FILE")"
    ;;
  401|000)
    echo "STOP  GET user -> $status: nothing was tested (401 = token invalid or expired, 000 = no reply from the server)." >&2
    exit 2
    ;;
  *)
    echo "WARN  GET user -> $status: the profile could not be read, the token owner is NOT pre-checked."
    echo "      Make sure the token is not a sysadmin's and its owner holds $REQUIRED_PERMISSION."
    ;;
esac

if printf '%s' "$profile" | grep -q '"role_name":"sysadmin"'; then
  echo "STOP  The token belongs to a sysadmin, who may assign any role. Use the limited user." >&2
  exit 2
fi
# Without this permission the 403 would come from the route permission, not from the role check.
if printf '%s' "$profile" | grep -q '"permissions"' && ! printf '%s' "$profile" | grep -q "$REQUIRED_PERMISSION"; then
  echo "STOP  The token owner lacks $REQUIRED_PERMISSION, so the role check would not be reached." >&2
  exit 2
fi

if [ -z "${EMAIL:-}" ]; then
  owner_email="$(printf '%s' "$profile" | grep -o '"user_email":"[^"]*"' | head -n 1 | cut -d'"' -f4)"
  if [ -n "$owner_email" ]; then
    EMAIL="role-test-$(date +%s)@${owner_email##*@}"
  else
    read -rp "Test e-mail for the new account (allowed domain, must not exist yet): " EMAIL
  fi
fi
if ! [[ "$EMAIL" =~ ^[^@[:space:]\"\\]+@[^@[:space:]\"\\]+$ ]]; then
  echo "STOP  '$EMAIL' is not usable as a test e-mail. Pass one with EMAIL=..." >&2
  exit 2
fi

echo "API: $API   higher role id: $ROLE_ID   test e-mail: $EMAIL"
echo

# ── The check itself ──
status="$(request POST core/users "{\"user_email\":\"$EMAIL\",\"full_name\":\"Role escalation test\",\"role_id\":$ROLE_ID}")"
reply="$(head -c 200 "$BODY_FILE" | tr -d '\n')"

case "$status" in
  403)
    printf 'PASS  POST core/users (role_id %s) -> 403  %s\n\n' "$ROLE_ID" "$reply"
    echo "OK: the role was refused, no account was created."
    ;;
  2??)
    printf 'FAIL  POST core/users (role_id %s) -> %s  (expected 403)  %s\n\n' "$ROLE_ID" "$status" "$reply"
    echo "PROBLEM: the account $EMAIL WAS created with the higher role. Delete it."
    exit 1
    ;;
  *)
    printf 'STOP  POST core/users (role_id %s) -> %s  %s\n\n' "$ROLE_ID" "$status" "$reply" >&2
    echo "Not tested: the request ended before the role check (422 = validation, e.g. unknown role" >&2
    echo "id or e-mail domain not allowed; 000 = no reply from the server)." >&2
    exit 2
    ;;
esac