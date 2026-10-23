#!/usr/bin/env bash
#
# @file run_shop.sh
# @path tests/unit_tests/api/run_shop.sh
# @project RPSW Web
# @author RPSW
# @created 2026
# @description Runs the api (Laravel / PHPUnit) tests: suite Shop - tests/Unit/Shop and tests/Feature/Shop.
#   Measures code coverage of the Shop section files (lines + methods,
#   needs pcov or Xdebug - without a driver the tests still run).
#   Result: tests/unit_tests/api/report/report.html, report.xml and coverage/index.html (last run only).
# @dependencies
# - Node.js, PHP 8.2+, api/vendor (composer install in api/), pcov or Xdebug for coverage.
#
# @usage
#   ./run_shop.sh                  (from any directory)
#   ./run_shop.sh --no-coverage    (without code coverage - faster)
#
# @note Exit code: 0 = all passed, 1 = at least one failure, 2 = setup problem.
#   Test suites are defined in api/phpunit.xml, the section files in lib/sections.js.

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/lib/run.js" --group "Shop" --command "run_shop.sh" --suite Shop "$@"
