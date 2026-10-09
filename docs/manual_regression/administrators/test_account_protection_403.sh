#!/usr/bin/env bash
#
# @file test_account_protection_403.sh
# @path dev_docs/test_account_protection_403.sh
# @project RPSW Web
# @author RPSW
# @created 2026
# @description Manual security check: verifies that the API itself (not only the admin form)
# refuses the changes only a sysadmin may make to ANOTHER account. Sent as a user who is not a
# sysadmin but holds core-administrators-update:
#   1. block the account                       -> must be 403
#   2. change its login e-mail                 -> must be 403
#   3. change its password (change-password)   -> must be 403
#   4. set its password through the user update -> must have NO effect (login with it fails)
# @dependencies
# - bash, curl
# - A running API (default http://127.0.0.1:8000/api).
# - The access token of a signed-in user who is NOT a sysadmin and holds
#   core-administrators-update.
# - A target: another active TEST account (not a sysadmin, not blocked, already activated).
#
# @usage
#   ./test_account_protection_403.sh            # asks for the target user id and for the token
#   ./test_account_protection_403.sh 57         # target user id given up front
#   API=https://example.test/api ./test_account_protection_403.sh
#
# @note
# - The token is read with a hidden prompt, so it never lands in the shell history or on screen.
# - Use a target id DIFFERENT from the token owner: everyone may change their own e-mail and
#   password, so the result would be misleading. The script refuses the own id when it can tell.
# - If a protection were missing, the change WOULD be applied to the target (blocked account,
#   changed e-mail or password). It is reported as FAIL together with what has to be put back,
#   so the target must be a disposable TEST account.
# - Check 4 makes ONE login attempt for the target with a password that must not work. It adds
#   one failed login to the audit log and to the security events.

set -u

API="${API:-http://127.0.0.1:8000/api}"
REQUIRED_PERMISSION="core-administrators-update"
# Meets the password policy, so a refusal cannot come from validation.
PROBE_PASSWORD='Pr0be-Passw0rd!'
# Stands in for the caller's current password. It is deliberately wrong: the refusal has to come
# before the password is even compared.
CONFIRM_PASSWORD='Wr0ng-Passw0rd!'

# The target id is never hard-coded: test accounts come and go.
TARGET_ID="${1:-}"
if [ -z "$TARGET_ID" ]; then
  read -rp "Target user id (another TEST account, not a sysadmin, not blocked): " TARGET_ID
fi
if ! [[ "$TARGET_ID" =~ ^[1-9][0-9]*$ ]]; then
  echo "Target user id must be a positive number, got '$TARGET_ID'." >&2
  exit 2
fi

if [ -z "${TOKEN:-}" ]; then
  read -rsp "Access token of the test user, never a sysadmin (input hidden): " TOKEN
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
unverified=0

# request <method> <path> [json-body] [auth: yes|no]
# Sends one request, stores the reply body in BODY_FILE and prints the HTTP status.
request() {
  local method="$1" path="$2" body="${3:-}" auth="${4:-yes}"
  local args=(-sS -o "$BODY_FILE" -w '%{http_code}' -X "$method" "$API/$path" -H 'Accept: application/json')
  if [ "$auth" = "yes" ]; then
    args+=(-H "Authorization: Bearer $TOKEN")
  fi
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' -d "$body")
  fi
  local status
  status="$(curl "${args[@]}" 2>/dev/null)" || status="000"
  printf '%s' "$status"
}

reply() { head -c 160 "$BODY_FILE" | tr -d '\n'; }

# ── Preconditions: the token must be valid and belong to a suitable user ──
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

if printf '%s' "$profile" | grep -Eq '"role_name":"sysadmin"|"user_roles":\[[^]]*"sysadmin"'; then
  echo "STOP  The token belongs to a sysadmin, who is allowed to do all of this. Use the test user." >&2
  exit 2
fi
# Without this permission every 403 would come from the route permission, not from the checks.
if printf '%s' "$profile" | grep -q 'permissions"' && ! printf '%s' "$profile" | grep -q "$REQUIRED_PERMISSION"; then
  echo "STOP  The token owner lacks $REQUIRED_PERMISSION, so the checks would not be reached." >&2
  exit 2
fi
own_id="$(printf '%s' "$profile" | grep -o '"user":{"id":[0-9]*' | head -n 1 | grep -o '[0-9]*$')"
if [ -n "$own_id" ] && [ "$own_id" = "$TARGET_ID" ]; then
  echo "STOP  Target id $TARGET_ID is the token owner. Everyone may change their own account; use another one." >&2
  exit 2
fi
owner_email="$(printf '%s' "$profile" | grep -o '"user_email":"[^"]*"' | head -n 1 | cut -d'"' -f4)"
probe_email="takeover-test-$(date +%s)@${owner_email##*@}"
[ -n "$owner_email" ] || probe_email="takeover-test-$(date +%s)@example.com"

echo "API: $API   target user id: $TARGET_ID"
echo

# expect_403 <label> <method> <path> <json-body> <what-to-put-back>
# PASS on 403. A 2xx means the change was applied; anything else means the check was not reached.
expect_403() {
  local label="$1" method="$2" path="$3" body="$4" undo="$5"
  local status
  status="$(request "$method" "$path" "$body")"
  case "$status" in
    403)
      printf 'PASS  %-34s -> 403  %s\n' "$label" "$(reply)"
      ;;
    2??)
      printf 'FAIL  %-34s -> %s  (expected 403)  %s\n' "$label" "$status" "$undo"
      failed=$((failed + 1))
      ;;
    *)
      printf 'SKIP  %-34s -> %s  not tested  %s\n' "$label" "$status" "$(reply)"
      unverified=$((unverified + 1))
      ;;
  esac
}

expect_403 "block another account" PUT "core/users/$TARGET_ID" \
  '{"is_blocked":true}' \
  "The account WAS blocked - unblock it as sysadmin."

expect_403 "change another account's e-mail" PUT "core/users/$TARGET_ID" \
  "{\"user_email\":\"$probe_email\"}" \
  "The e-mail WAS changed to $probe_email - change it back."

expect_403 "change another account's password" PUT "core/users/$TARGET_ID/change-password" \
  "{\"old_password\":\"$CONFIRM_PASSWORD\",\"new_password\":\"$PROBE_PASSWORD\",\"new_password_confirmation\":\"$PROBE_PASSWORD\"}" \
  "The password WAS changed - reset it."

# ── Check 4: a password sent through the ordinary update must be ignored ──
# The update itself is allowed (it changes nothing), so the proof is a login attempt with the
# probe password: it must be refused as invalid credentials.
label="password through user update"
status="$(request PUT "core/users/$TARGET_ID" "{\"user_password_hash\":\"$PROBE_PASSWORD\"}")"
target_email="$(grep -o '"user_email":"[^"]*"' "$BODY_FILE" | head -n 1 | cut -d'"' -f4)"
if [[ "$status" != 2?? ]] || [ -z "$target_email" ]; then
  printf 'SKIP  %-34s -> %s  not tested (the update did not return the account)  %s\n' "$label" "$status" "$(reply)"
  unverified=$((unverified + 1))
else
  login_status="$(request POST login "{\"email\":\"$target_email\",\"password\":\"$PROBE_PASSWORD\"}" no)"
  case "$login_status" in
    401)
      printf 'PASS  %-34s -> ignored (login with it: 401)\n' "$label"
      ;;
    200)
      printf 'FAIL  %-34s -> login with it: 200  The password WAS set - reset it.\n' "$label"
      failed=$((failed + 1))
      ;;
    *)
      printf 'SKIP  %-34s -> login with it: %s  not verified (blocked / not activated account, captcha or throttle)  %s\n' "$label" "$login_status" "$(reply)"
      unverified=$((unverified + 1))
      ;;
  esac
fi

echo
if [ "$failed" -gt 0 ]; then
  echo "PROBLEM: $failed change(s) were NOT refused. Put the target account back as described above."
  exit 1
fi
if [ "$unverified" -gt 0 ]; then
  echo "INCOMPLETE: nothing got through, but $unverified check(s) could not be tested (see SKIP lines)."
  exit 2
fi
echo "OK: every change was refused."