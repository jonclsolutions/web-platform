#!/usr/bin/env bash
#
# @file run_web_public.sh
# @path tests/unit_tests/erp/run_web_public.sh
# @project JS web-platform
# @author JS
# @created 2026
# @description Runs the erp unit tests: public website – apps/web/public + the shared public 404 (public/not-found).
#   Result: tests/unit_tests/erp/report/report.html and report.xml (last run only).
# @dependencies
# - Node.js, erp/node_modules (npm install in erp/), Chrome/Chromium (CHROME_BIN or on PATH).
#
# @usage
#   ./run_web_public.sh            (from any directory)
#   CHROME_BIN=/path/to/chrome ./run_web_public.sh
#
# @note Exit code: 0 = all passed, 1 = at least one failure, 2 = setup problem.
# @note Code coverage is measured by default; pass --no-coverage to skip it.

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/lib/run.js" "$@" --group "Web public" --command "run_web_public.sh" src/app/apps/web/public src/app/public/not-found
