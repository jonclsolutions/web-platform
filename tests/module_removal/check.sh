#!/usr/bin/env bash
#
# @file check.sh
# @path tests/module_removal/check.sh
# @project JS web-platform
# @author JS
# @created 2026
# @description Proves that an application can be removed: in a temporary copy of the working
#   tree it deletes the application exactly as the README describes (API folder app/Apps/<App>,
#   its tests, its line in config/apps.php and its test suite; frontend folder apps/<id> and its
#   line in apps.registry.ts) and then checks that the rest still works:
#     1. API   - `php artisan route:list` (every route loads, none of the removed application),
#     2. API   - the test suites of the core, "Other" and the remaining applications,
#     3. erp   - the production build (`ng build`),
#     4. erp   - every unit test incl. the boundary checks (tests/unit_tests/erp/lib/run.js).
#   The working tree itself is never changed.
# @dependencies
# - git, rsync, PHP 8.2+ with api/vendor, Node.js with erp/node_modules, Chrome/Chromium
#   (CHROME_BIN or on PATH) - the same as tests/unit_tests.
# @usage
#   tests/module_removal/check.sh web              (one application: web | shop | project-portal)
#   tests/module_removal/check.sh all              (every application, one after another)
#   tests/module_removal/check.sh shop --keep      (keep the temporary copy for inspection)
#   tests/module_removal/check.sh shop --skip-erp  (API only; --skip-api = frontend only)
# @note Exit code 0 = the application can be removed, 1 = a check failed, 2 = wrong usage.
#   The copy (tests/module_removal/.work, git-ignored - on the file system of the repository, so
#   api/vendor can be hard-linked instead of copied) contains api/.env (needed by artisan) and is
#   deleted at the end unless --keep. api/vendor is linked file by file (hard links), its composer
#   folder and autoload.php are real copies - the autoloader of the copy resolves the classes
#   of the copy, never those of the working tree.

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KEEP=0; SKIP_API=0; SKIP_ERP=0; TARGET=""
for arg in "$@"; do
  case "$arg" in
    --keep) KEEP=1 ;;
    --skip-api) SKIP_API=1 ;;
    --skip-erp) SKIP_ERP=1 ;;
    -*) echo "Unknown option $arg" >&2; exit 2 ;;
    *) TARGET="$arg" ;;
  esac
done

# Installed applications = the folders of erp/src/app/apps with a manifest <id>.app.ts.
mapfile -t INSTALLED < <(cd "$REPO/erp/src/app/apps" && for d in */; do d="${d%/}"; [ -f "$d/$d.app.ts" ] && echo "$d"; done)

if [ -z "$TARGET" ]; then
  echo "usage: $0 <$(IFS='|'; echo "${INSTALLED[*]}")|all> [--keep] [--skip-api] [--skip-erp]" >&2
  exit 2
fi

# @description Id of the frontend (kebab case) -> folder of the API (StudlyCase): project-portal -> ProjectPortal.
studly() { echo "$1" | awk -F- '{ for (i = 1; i <= NF; i++) printf "%s", toupper(substr($i, 1, 1)) substr($i, 2) }'; }

# @description Checks the removal of one application; prints a summary line per check.
# @param $1 Application id.
# @return 0 = every check passed, 1 = a check failed.
check_app() {
  local id="$1" dir; dir="$(studly "$id")"
  mkdir -p "$REPO/tests/module_removal/.work"
  local tmp; tmp="$(mktemp -d "$REPO/tests/module_removal/.work/$id-XXXXXX")"
  local failed=0 log="$tmp/check.log"
  echo "== Removal of '$id' (API app/Apps/$dir) in $tmp"

  # Copy of the working tree (tracked + untracked, not ignored) + the environment of artisan;
  # dependencies are linked, not copied.
  if [ "$(git -C "$REPO" rev-parse --show-toplevel 2>/dev/null)" = "$REPO" ]; then
    (cd "$REPO" && git ls-files -co --exclude-standard -z) | rsync -a --from0 --files-from=- "$REPO/" "$tmp/repo/"
  else
    # Not a git checkout (e.g. an exported copy): everything except dependencies and outputs.
    rsync -a --exclude '/api/vendor' --exclude '/erp/node_modules' --exclude '/erp/dist' --exclude '/erp/.angular' \
      --exclude '/tests/module_removal/.work' --exclude 'report/' "$REPO/" "$tmp/repo/"
  fi
  cp "$REPO/api/.env" "$tmp/repo/api/.env" 2>/dev/null || true
  cp -al "$REPO/api/vendor" "$tmp/repo/api/vendor" 2>/dev/null || cp -a "$REPO/api/vendor" "$tmp/repo/api/vendor"
  rm -rf "$tmp/repo/api/vendor/composer" "$tmp/repo/api/vendor/autoload.php"
  cp -a "$REPO/api/vendor/composer" "$REPO/api/vendor/autoload.php" "$tmp/repo/api/vendor/"
  ln -s "$REPO/erp/node_modules" "$tmp/repo/erp/node_modules"
  local copy="$tmp/repo"

  # ── Remove the application as the README describes ─────────────────────────────────────
  rm -rf "$copy/api/app/Apps/$dir" "$copy/api/tests/Apps/$dir" "$copy/erp/src/app/apps/$id"
  python3 - "$copy" "$id" "$dir" <<'PY'
import re, sys
copy, app_id, app_dir = sys.argv[1:4]
const = app_id.replace('-', '_').upper() + '_APP'
edits = {
    f'{copy}/api/config/apps.php': [(rf"\n\s*App\\Apps\\{app_dir}\\{app_dir}App::class,", '')],
    f'{copy}/api/phpunit.xml': [(rf'\n\s*<testsuite name="{app_dir}">.*?</testsuite>', '')],
    f'{copy}/erp/src/app/apps/apps.registry.ts': [
        (rf"\nimport \{{ {const} \}} from '\./{re.escape(app_id)}/{re.escape(app_id)}\.app';", ''),
        (rf"\n\s*{const},", ''),
    ],
}
for path, subs in edits.items():
    text = open(path).read()
    for pattern, repl in subs:
        new = re.sub(pattern, repl, text, count=1, flags=re.S)
        if new == text:
            sys.exit(f'Cannot remove {pattern!r} from {path}')
        text = new
    open(path, 'w').write(text)
PY
  [ $? -eq 0 ] || { echo "   FAILED: the application could not be removed from the registries"; return 1; }

  # ── API ──────────────────────────────────────────────────────────────────────────────────
  if [ "$SKIP_API" -eq 0 ]; then
    if (cd "$copy/api" && php artisan route:list --json > "$tmp/routes.json" 2>>"$log"); then
      local count; count=$(python3 -c "import json,sys; r=json.load(open(sys.argv[1])); print(len(r))" "$tmp/routes.json")
      local leftover; leftover=$(python3 -c "
import json, sys
routes = json.load(open(sys.argv[1]))
print(sum(1 for r in routes if (r.get('action') or '').startswith('App\\\\Apps\\\\' + sys.argv[2] + '\\\\')))" "$tmp/routes.json" "$dir")
      if [ "$leftover" -eq 0 ]; then echo "   ok   route:list ($count routes, none of $dir)"; else echo "   FAIL route:list: $leftover route(s) of $dir"; failed=1; fi
    else
      echo "   FAIL route:list (see $log)"; failed=1
    fi

    local suites="Core,Other" other
    for other in "${INSTALLED[@]}"; do [ "$other" != "$id" ] && suites="$suites,$(studly "$other")"; done
    if (cd "$copy/api" && php artisan test --testsuite="$suites" > "$tmp/api-tests.log" 2>&1); then
      echo "   ok   API tests ($suites): $(grep -Eo 'Tests: +[0-9]+ passed' "$tmp/api-tests.log" | head -1 | grep -Eo '[0-9]+') passed"
    else
      echo "   FAIL API tests ($suites):"; grep -E "FAILED|Tests:" "$tmp/api-tests.log" | head -20 | sed 's/^/        /'; failed=1
    fi
  fi

  # ── Frontend ─────────────────────────────────────────────────────────────────────────────
  if [ "$SKIP_ERP" -eq 0 ]; then
    if (cd "$copy/erp" && npx ng build > "$tmp/ng-build.log" 2>&1); then
      echo "   ok   ng build ($(grep -Eo 'Initial total +\| +[0-9.]+ kB' "$tmp/ng-build.log" | grep -Eo '[0-9.]+ kB' | head -1) initial)"
    else
      echo "   FAIL ng build:"; grep -E "ERROR|error TS" "$tmp/ng-build.log" | head -20 | sed 's/^/        /'; failed=1
    fi
    if (cd "$copy" && UNIT_TESTS_REPORT_DIR="$tmp/erp-report" node tests/unit_tests/erp/lib/run.js --group "Removal of $id" --command "check.sh $id" --no-coverage src > "$tmp/erp-tests.log" 2>&1); then
      echo "   ok   erp unit tests: $(grep -Eo 'Passed: [0-9]+' "$tmp/erp-tests.log" | head -1)"
    else
      echo "   FAIL erp unit tests ($(grep -E 'Total|Failed' "$tmp/erp-tests.log" | tr '\n' ' ')) - report $tmp/erp-report/report.html"
      KEEP=1; failed=1
    fi
  fi

  if [ "$KEEP" -eq 1 ]; then echo "   copy kept: $tmp"; else rm -rf "$tmp"; fi
  return $failed
}

status=0
if [ "$TARGET" = "all" ]; then
  for app in "${INSTALLED[@]}"; do check_app "$app" || status=1; done
else
  printf '%s\n' "${INSTALLED[@]}" | grep -qx "$TARGET" || { echo "Unknown application '$TARGET' (installed: ${INSTALLED[*]})" >&2; exit 2; }
  check_app "$TARGET" || status=1
fi
[ $status -eq 0 ] && echo "RESULT: the application(s) can be removed." || echo "RESULT: removal check FAILED."
exit $status
