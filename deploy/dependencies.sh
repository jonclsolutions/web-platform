#!/usr/bin/env bash
# =============================================================================
# @file dependencies.sh
# @path deploy/dependencies.sh
# @project JS web-platform
# @author JS
# @created 2026
# @description Known vulnerabilities of the PRODUCTION dependencies (npm of erp/, Composer of
# api/) - one implementation for `./dev.sh deps-audit`, `./dev.sh deps-fix` and the dependency
# step of deploy/build.sh.
#   audit  lists the advisories, critical / high ones by name, and whether each can be fixed
#          automatically; changes nothing.
#   fix    updates ONLY the vulnerable packages and ONLY within the versions allowed by
#          package.json / composer.json (patch and minor updates: `npm audit fix` without
#          --force - it also fixes the development tools within their versions - and
#          `composer update <packages> --with-all-dependencies` with the platform PHP of
#          composer.json), then runs every unit test and audits again. A new major version or a
#          package without a fixed release is only reported as "needs a manual update" - its API
#          may differ, so it is changed and tested by hand.
# @note fix never commits: the lock files stay changed for a review, a manual test of the
#   affected features and a commit. Undo: git checkout -- erp/package.json erp/package-lock.json
#   api/composer.json api/composer.lock, then ./dev.sh npm ci and ./dev.sh composer install.
# @usage (inside the dev container - normally through dev.sh)
#   ./dev.sh deps-audit     ->  deploy/dependencies.sh audit
#   ./dev.sh deps-fix       ->  deploy/dependencies.sh fix
# @return audit: always 0 (warnings only). fix: 0 = done (see the remaining list), 1 = the tests
#   failed after the update (lock files left changed for inspection).
# @dependencies npm, node, composer, php (the dev image); tests/unit_tests/run_all.sh
# =============================================================================

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ERP_DIR="$ROOT_DIR/erp"
API_DIR="$ROOT_DIR/api"

info() { printf '   - %s\n' "$*"; }
warn() { printf '\e[33m   ! %s\e[0m\n' "$*" >&2; }
fail() { printf '\e[31m   ✗ %s\e[0m\n' "$*" >&2; }
head_line() { printf '\n\e[34m== %s\e[0m\n' "$*"; }

# -----------------------------------------------------------------------------
# @description npm advisories of the production dependencies as one line
# "<critical> <high> <moderate> <low>|<auto-fixable names>|<manual names>" (names with their
# severity), or "ERR" when the audit could not run (no network, broken JSON).
# -----------------------------------------------------------------------------
npm_summary() {
    local json
    # npm audit exits with 1 when it finds something - the JSON is what counts.
    json="$(cd "$ERP_DIR" && npm audit --omit=dev --json 2>/dev/null)" || true
    printf '%s' "$json" | node -e '
        let d = ""; process.stdin.on("data", c => d += c).on("end", () => {
          try {
            const j = JSON.parse(d), v = j.metadata && j.metadata.vulnerabilities;
            if (!v) { process.stdout.write("ERR"); return; }
            const auto = [], manual = [];
            for (const [name, x] of Object.entries(j.vulnerabilities || {})) {
              const label = name + " (" + x.severity + ")";
              // true = a fix inside the allowed range; an object = only by another (major) version
              (x.fixAvailable === true ? auto : manual).push(label);
            }
            process.stdout.write([v.critical, v.high, v.moderate, v.low].join(" ") + "|" + auto.join(", ") + "|" + manual.join(", "));
          } catch { process.stdout.write("ERR"); }
        });' 2>/dev/null || true
}

# -----------------------------------------------------------------------------
# @description Composer advisories of the production dependencies as one line
# "<count>|<critical / high names>|<package names>", or "ERR" when the audit could not run.
# -----------------------------------------------------------------------------
composer_summary() {
    local json
    # composer audit exits with 1 when it finds something - the JSON is what counts.
    json="$(cd "$API_DIR" && composer audit --no-dev --locked --format=json --no-interaction 2>/dev/null)" || true
    printf '%s' "$json" | php -r '
        $j = json_decode(stream_get_contents(STDIN), true);
        if (!is_array($j) || !array_key_exists("advisories", $j)) { echo "ERR"; exit; }
        $n = 0; $top = [];
        foreach ($j["advisories"] as $pkg => $list) {
            foreach ($list as $a) {
                $n++;
                $sev = strtolower($a["severity"] ?? "");
                if (in_array($sev, ["critical", "high"], true)) { $top[] = "$pkg ($sev)"; }
            }
        }
        echo $n . "|" . implode(", ", array_unique($top)) . "|" . implode(" ", array_keys($j["advisories"]));' 2>/dev/null || true
}

# -----------------------------------------------------------------------------
# @description Prints the state of both package managers.
# @return 0 = nothing found, 1 = advisories found or an audit could not run.
# -----------------------------------------------------------------------------
report() {
    local npm composer found=0 c h m l rest
    npm="$(npm_summary)"
    if [[ "$npm" == "ERR" || -z "$npm" ]]; then
        warn "WARNING: npm audit could not run (no network access?) - production npm packages NOT checked"
        found=1
    else
        read -r c h m l <<< "${npm%%|*}"; rest="${npm#*|}"
        if (( c + h + m + l > 0 )); then
            found=1
            warn "WARNING: npm (production): $c critical, $h high, $m moderate, $l low vulnerabilities"
            [[ -n "${rest%%|*}" ]] && warn "         fixable by ./dev.sh deps-fix: ${rest%%|*}"
            [[ -n "${rest#*|}" ]]  && warn "         needs a manual update (new major version / no fix): ${rest#*|}"
        else
            info "npm (production): no known vulnerabilities"
        fi
    fi

    composer="$(composer_summary)"
    if [[ "$composer" == "ERR" || -z "$composer" ]]; then
        warn "WARNING: composer audit could not run (no network access?) - production Composer packages NOT checked"
        found=1
    elif [[ "${composer%%|*}" != "0" ]]; then
        found=1
        rest="${composer#*|}"
        warn "WARNING: Composer (production): ${composer%%|*} advisories in: ${rest#*|}"
        [[ -n "${rest%%|*}" ]] && warn "         critical / high: ${rest%%|*}"
    else
        info "Composer (production): no known vulnerabilities"
    fi

    return "$found"
}

# -----------------------------------------------------------------------------
# @description Updates the vulnerable packages within the allowed versions, tests, re-audits.
# -----------------------------------------------------------------------------
fix() {
    local composer packages

    head_line "[1/4] npm: vulnerable packages within the allowed versions (npm audit fix, no --force)"
    # Without --omit=dev: with it npm would also REMOVE the dev packages (Angular CLI, Karma) from
    # node_modules. Development tools are fixed too, still only within their allowed versions.
    # Exits with 1 while something stays unfixed - the final audit below lists it.
    (cd "$ERP_DIR" && npm audit fix --no-fund) || true

    head_line "[2/4] Composer: vulnerable packages within composer.json (with their dependencies)"
    composer="$(composer_summary)"
    if [[ "$composer" == "ERR" || -z "$composer" ]]; then
        warn "composer audit could not run - Composer packages not updated"
    else
        packages="${composer##*|}"
        if [[ -n "$packages" ]]; then
            info "packages: $packages"
            # shellcheck disable=SC2086
            (cd "$API_DIR" && composer update $packages --with-all-dependencies --no-interaction) \
                || warn "composer update failed (e.g. no version allowed by composer.json fixes it) - see above"
        else
            info "nothing to update"
        fi
    fi

    head_line "[3/4] all unit tests (erp + api)"
    if ! bash "$ROOT_DIR/tests/unit_tests/run_all.sh"; then
        fail "the tests FAILED after the update - do not commit; inspect the change or undo it:"
        fail "git checkout -- erp/package.json erp/package-lock.json api/composer.json api/composer.lock"
        fail "then ./dev.sh npm ci && ./dev.sh composer install"
        return 1
    fi

    head_line "[4/4] remaining advisories"
    report && info "all production dependencies are clean"

    printf '\nChanged files - test the affected features by hand, then commit:\n'
    git -C "$ROOT_DIR" status --short -- erp/package.json erp/package-lock.json api/composer.json api/composer.lock
    return 0
}

case "${1:-audit}" in
    audit) report; exit 0 ;;
    fix)   fix ;;
    *) printf 'usage: deploy/dependencies.sh audit|fix\n' >&2; exit 2 ;;
esac
