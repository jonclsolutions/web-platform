#!/usr/bin/env bash
#
# @file run_project_portal.sh
# @path tests/unit_tests/api/run_project_portal.sh
# @project JS web-platform
# @author JS
# @created 2026
# @description Runs the api (Laravel / PHPUnit) tests: suite ProjectPortal - api/tests/Apps/ProjectPortal.
#   Measures code coverage of the project portal files (lines + methods,
#   needs pcov or Xdebug - without a driver the tests still run).
#   Result: tests/unit_tests/api/report/report.html, report.xml and coverage/index.html (last run only).
# @dependencies
# - Node.js, PHP 8.2+, api/vendor (composer install in api/), pcov or Xdebug for coverage.
#
# @usage
#   ./run_project_portal.sh                  (from any directory)
#   ./run_project_portal.sh --no-coverage    (without code coverage - faster)
#
# @note Exit code: 0 = all passed, 1 = at least one failure, 2 = setup problem.
#   Test suites are defined in api/phpunit.xml, the section files in lib/sections.js.

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/lib/run.js" --group "ProjectPortal" --command "run_project_portal.sh" --suite ProjectPortal "$@"
