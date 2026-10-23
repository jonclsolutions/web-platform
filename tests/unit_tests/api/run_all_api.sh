#!/usr/bin/env bash
#
# @file run_all_api.sh
# @path tests/unit_tests/api/run_all_api.sh
# @project RPSW Web
# @author RPSW
# @created 2026
# @description Runs the api (Laravel / PHPUnit) tests: every test suite (Core, Web, Shop, Other).
#   Measures code coverage of all of api/app (lines + methods,
#   needs pcov or Xdebug - without a driver the tests still run).
#   Result: tests/unit_tests/api/report/report.html, report.xml and coverage/index.html (last run only).
# @dependencies
# - Node.js, PHP 8.2+, api/vendor (composer install in api/), pcov or Xdebug for coverage.
#
# @usage
#   ./run_all_api.sh                  (from any directory)
#   ./run_all_api.sh --no-coverage    (without code coverage - faster)
#
# @note Exit code: 0 = all passed, 1 = at least one failure, 2 = setup problem.
#   Test suites are defined in api/phpunit.xml, the section files in lib/sections.js.

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/lib/run.js" --group "All" --command "run_all_api.sh" "$@"
