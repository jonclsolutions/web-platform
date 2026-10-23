#!/usr/bin/env bash
#
# @file run_admin_core.sh
# @path tests/unit_tests/erp/run_admin_core.sh
# @project RPSW Web
# @author RPSW
# @created 2026
# @description Runs the erp unit tests: admin core section – admin/core-pages, the shared admin components (base-data, builders, layout, dialogs) and admin/auth.
#   Result: tests/unit_tests/erp/report/report.html and report.xml (last run only).
# @dependencies
# - Node.js, erp/node_modules (npm install in erp/), Chrome/Chromium (CHROME_BIN or on PATH).
#
# @usage
#   ./run_admin_core.sh            (from any directory)
#   CHROME_BIN=/path/to/chrome ./run_admin_core.sh
#
# @note Exit code: 0 = all passed, 1 = at least one failure, 2 = setup problem.
# @note Code coverage is measured by default; pass --no-coverage to skip it.

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/lib/run.js" "$@" --group "Admin core" --command "run_admin_core.sh" src/app/admin/core-pages src/app/admin/components src/app/admin/auth
