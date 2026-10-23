#!/usr/bin/env bash
#
# @file run_all.sh
# @path tests/unit_tests/run_all.sh
# @project RPSW Web
# @author RPSW
# @created 2026
# @description Runs ALL unit tests: erp/run_all_erp.sh (Angular) and api/run_all_api.sh
#   (Laravel), then writes one combined report: tests/unit_tests/report/report.html,
#   report.xml and coverage/ (erp code coverage). Last run only.
# @dependencies
# - Everything erp/run_all_erp.sh and api/run_all_api.sh need (Node.js, erp/node_modules,
#   Chrome/Chromium, PHP 8.2+, api/vendor) – see README.md.
#
# @usage
#   ./run_all.sh                 (from any directory)
#   ./run_all.sh --no-coverage   (erp without code coverage, faster)
#
# @note Exit code: 0 = all passed, 1 = at least one failure, 2 = a part could not run (setup problem).

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/lib/run_all.js" "$@"
