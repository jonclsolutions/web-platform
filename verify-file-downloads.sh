#!/usr/bin/env bash
#
# @file        verify-file-downloads.sh
# @project     RPSW Web
# @author      RPSW
# @created     2026
# @description Regression test for PublicFileDownloadController (/download-file,
#              /view-file). Pulls every attachment currently visible via the
#              admin API (job applications, support tickets, sales orders, raw
#              request commissions), then for each one verifies that:
#                - download() returns 200 with Content-Disposition: attachment
#                  and the ORIGINAL file name (not the hashed on-disk name)
#                - view() returns 200 with Content-Disposition: inline and the
#                  same original file name
#              Also runs two security checks against the same endpoint:
#                - a path-traversal attempt is rejected (expects 404)
#                - a request for a file that doesn't exist is rejected (404)
#
# @usage       BASE_URL=http://127.0.0.1:8000 TOKEN="<sanctum bearer token>" ./verify-file-downloads.sh
#              TOKEN is only needed to LIST records (the download/view routes
#              themselves are currently public - see the note at the bottom of
#              this script's output).
#
# @requires    curl, jq (JSON parsing)

set -uo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
API="${BASE_URL}/api"
TOKEN="${TOKEN:-}"

PASS_COUNT=0
FAIL_COUNT=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# @description Prints a colored PASS/FAIL line and updates the counters.
log_result() {
    local status="$1"   # "PASS" or "FAIL"
    local message="$2"
    if [[ "$status" == "PASS" ]]; then
        echo -e "  \033[32m✔ PASS\033[0m  $message"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "  \033[31m✘ FAIL\033[0m  $message"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# @description Checks that jq is available before doing anything else - a
#              missing dependency should fail loudly and immediately, not
#              produce confusing downstream errors.
require_jq() {
    if ! command -v jq >/dev/null 2>&1; then
        echo "This script requires 'jq' (JSON parsing). Install it and re-run." >&2
        exit 1
    fi
}

# @description Fetches a paginated admin list endpoint (needs TOKEN) and
#              returns its raw JSON body.
# @param $1 API path relative to /api, e.g. "web/support_tickets"
fetch_list() {
    local path="$1"
    curl -s -H "Accept: application/json" -H "Authorization: Bearer ${TOKEN}" \
        "${API}/${path}?per_page=50&sort_by=id&sort_direction=desc"
}

# @description Verifies one attachment's download() and view() endpoints
#              against its expected original file name.
# @param $1 Human-readable label for log output (e.g. "SupportTicket#13")
# @param $2 download_url
# @param $3 view_url
# @param $4 expected original file name
verify_attachment() {
    local label="$1" download_url="$2" view_url="$3" expected_name="$4"

    # --- download() ---
    local dl_headers
    dl_headers=$(curl -s -D - -o /dev/null "$download_url")
    local dl_status
    dl_status=$(echo "$dl_headers" | head -n1 | awk '{print $2}')
    local dl_disposition
    dl_disposition=$(echo "$dl_headers" | grep -i '^Content-Disposition:' | tr -d '\r')

    if [[ "$dl_status" == "200" ]] && echo "$dl_disposition" | grep -q "attachment" \
        && echo "$dl_disposition" | grep -qF "$expected_name"; then
        log_result "PASS" "$label download() -> 200, original name present ($expected_name)"
    else
        log_result "FAIL" "$label download() -> status=$dl_status disposition=[$dl_disposition] expected_name=[$expected_name]"
    fi

    # --- view() ---
    local view_headers
    view_headers=$(curl -s -D - -o /dev/null "$view_url")
    local view_status
    view_status=$(echo "$view_headers" | head -n1 | awk '{print $2}')
    local view_disposition
    view_disposition=$(echo "$view_headers" | grep -i '^Content-Disposition:' | tr -d '\r')

    if [[ "$view_status" == "200" ]] && echo "$view_disposition" | grep -q "inline" \
        && echo "$view_disposition" | grep -qF "$expected_name"; then
        log_result "PASS" "$label view() -> 200, inline, original name present ($expected_name)"
    else
        log_result "FAIL" "$label view() -> status=$view_status disposition=[$view_disposition] expected_name=[$expected_name]"
    fi
}

# ---------------------------------------------------------------------------
# Security checks (don't need TOKEN - these hit the public endpoint directly)
# ---------------------------------------------------------------------------

verify_security_checks() {
    echo ""
    echo "== Security checks =="

    # Path traversal attempt - must NOT be able to escape the intended folder.
    local traversal_status
    traversal_status=$(curl -s -o /dev/null -w '%{http_code}' \
        "${API}/download-file/tickets/..%2F..%2F..%2F.env")
    if [[ "$traversal_status" == "404" ]]; then
        log_result "PASS" "Path traversal attempt correctly rejected (404)"
    else
        log_result "FAIL" "Path traversal attempt returned status=$traversal_status (expected 404) - INVESTIGATE IMMEDIATELY"
    fi

    # Non-existent file - must 404, not 500 or 200.
    local missing_status
    missing_status=$(curl -s -o /dev/null -w '%{http_code}' \
        "${API}/download-file/tickets/does-not-exist-1234567890.txt")
    if [[ "$missing_status" == "404" ]]; then
        log_result "PASS" "Non-existent file correctly returns 404"
    else
        log_result "FAIL" "Non-existent file returned status=$missing_status (expected 404)"
    fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

require_jq

echo "RPSW Web - file download/view endpoint verification"
echo "Base URL: $BASE_URL"
echo ""

if [[ -z "$TOKEN" ]]; then
    echo "No TOKEN provided - skipping attachment checks (list endpoints require auth)."
    echo "Re-run as: TOKEN=\"<your bearer token>\" $0"
else
    echo "== Support Tickets (single attachment via web_attachments) =="
    tickets_json=$(fetch_list "web/support_tickets")
    echo "$tickets_json" | jq -c '.data[]? // .[]?' 2>/dev/null | while read -r ticket; do
        id=$(echo "$ticket" | jq -r '.id')
        echo "$ticket" | jq -c '.attachments[]?' | while read -r att; do
            name=$(echo "$att" | jq -r '.original_filename')
            dl=$(echo "$att" | jq -r '.download_url')
            vw=$(echo "$att" | jq -r '.view_url')
            verify_attachment "SupportTicket#$id" "$dl" "$vw" "$name"
        done
    done

    echo ""
    echo "== Job Applications (single attachment via web_attachments) =="
    jobs_json=$(fetch_list "web/job_applications")
    echo "$jobs_json" | jq -c '.data[]? // .[]?' 2>/dev/null | while read -r job; do
        id=$(echo "$job" | jq -r '.id')
        echo "$job" | jq -c '.attachments[]?' | while read -r att; do
            name=$(echo "$att" | jq -r '.original_filename')
            dl=$(echo "$att" | jq -r '.download_url')
            vw=$(echo "$att" | jq -r '.view_url')
            verify_attachment "JobApplication#$id" "$dl" "$vw" "$name"
        done
    done

    echo ""
    echo "== Sales Orders (up to 10 attachments via web_attachments) =="
    orders_json=$(fetch_list "web/sales_orders")
    echo "$orders_json" | jq -c '.data[]? // .[]?' 2>/dev/null | while read -r order; do
        id=$(echo "$order" | jq -r '.id')
        echo "$order" | jq -c '.attachments[]?' | while read -r att; do
            name=$(echo "$att" | jq -r '.original_filename')
            dl=$(echo "$att" | jq -r '.download_url')
            vw=$(echo "$att" | jq -r '.view_url')
            verify_attachment "SalesOrder#$id" "$dl" "$vw" "$name"
        done
    done

    echo ""
    echo "== Raw Request Commissions (up to 10 attachments via web_attachments) =="
    commissions_json=$(fetch_list "web/raw_request_commissions")
    echo "$commissions_json" | jq -c '.data[]? // .[]?' 2>/dev/null | while read -r c; do
        id=$(echo "$c" | jq -r '.id')
        echo "$c" | jq -c '.attachments[]?' | while read -r att; do
            name=$(echo "$att" | jq -r '.original_filename')
            dl=$(echo "$att" | jq -r '.download_url')
            vw=$(echo "$att" | jq -r '.view_url')
            verify_attachment "RawRequestCommission#$id" "$dl" "$vw" "$name"
        done
    done
fi

verify_security_checks

echo ""
echo "======================================================================"
echo "Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "======================================================================"

if [[ -z "$TOKEN" ]]; then
    echo ""
    echo "NOTE: download-file/view-file are still PUBLIC/unauthenticated routes"
    echo "(known, tracked task to move them behind auth + a private disk)."
    echo "This script does not test authorization because there currently isn't any."
fi

[[ "$FAIL_COUNT" -eq 0 ]]