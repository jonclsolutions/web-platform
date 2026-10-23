#!/usr/bin/env bash
#
# @file run_public_web.sh
# @path tests/unit_tests/erp/run_public_web.sh
# @project RPSW Web
# @author RPSW
# @created 2026
# @description Runs the erp unit tests: public website – public/web-pages.
#   Result: tests/unit_tests/erp/report/report.html and report.xml (last run only).
# @dependencies
# - Node.js, erp/node_modules (npm install in erp/), Chrome/Chromium (CHROME_BIN or on PATH).
#
# @usage
#   ./run_public_web.sh            (from any directory)
#   CHROME_BIN=/path/to/chrome ./run_public_web.sh
#
# @note Exit code: 0 = all passed, 1 = at least one failure, 2 = setup problem.
# @note Code coverage is measured by default; pass --no-coverage to skip it.

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/lib/run.js" "$@" --group "Public web" --command "run_public_web.sh" src/app/public/web-pages
