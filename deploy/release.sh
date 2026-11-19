#!/usr/bin/env bash
# =============================================================================
# @file release.sh
# @path deploy/release.sh
# @project JS web-platform
# @author JS
# @created 2026
# @description Releases a new version of THIS repository (one client = one repository = one VPS):
#   1. checks: a valid tag, branch main, no uncommitted changes, main equal to origin/main, the
#      tag does not exist yet
#   2. moves "unreleased" of api/resources/changelog/changelog.json under the tag, dated today
#      (php artisan changelog:release in the dev container - refuses an empty "unreleased")
#   3. shows the notes and asks for confirmation
#   4. commits the changelog ("release: <tag>"), creates the annotated tag and pushes both at once
#   GitHub Actions (release.yml) then checks the notes, builds the images, deploys to the VPS and
#   creates the GitHub Release with the same notes.
# @usage deploy/release.sh v2026.11.2 [--note "text"] [--yes]      (or ./dev.sh release …)
#   Tag: vYYYY.MM.N - year, month, the N-th release of the month.
#   --note "…"  adds a change of the core to the release (provision.sh: "First release of …")
#   --yes       no confirmation (provision.sh asked already)
# @note Write the changes into "unreleased" together with every change (deploy_workflow.md,
#   chapter 11) - this script only moves them; a tag pushed without its notes (e.g. from the GitHub
#   web) is refused by the release workflow.
# @dependencies git, the dev environment (./dev.sh - PHP of the project).
# =============================================================================
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHANGELOG="api/resources/changelog/changelog.json"

step() { printf '\n\e[34m==> %s\e[0m\n' "$*"; }
info() { printf '    - %s\n' "$*"; }
die()  { printf '\e[31mERROR: %s\e[0m\n' "$*" >&2; exit 1; }

TAG="${1:-}"
NOTE=""; YES=0
shift || true
while [[ $# -gt 0 ]]; do
    case "$1" in
        --note) NOTE="${2:-}"; shift 2 ;;
        --yes) YES=1; shift ;;
        *) die "unknown option $1" ;;
    esac
done
[[ "$TAG" =~ ^v[0-9A-Za-z][0-9A-Za-z._-]{0,62}$ ]] || die "usage: deploy/release.sh vYYYY.MM.N (e.g. v$(date +%Y.%m).1)"
cd "$ROOT_DIR"

step "Checks"
[[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]] || die "release from the branch main"
[[ -z "$(git status --porcelain)" ]] || die "uncommitted changes - commit or stash them first"
git fetch -q origin --tags || die "git fetch failed"
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] || die "main differs from origin/main - pull / push first"
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then die "tag $TAG exists already"; fi
info "main = origin/main ($(git rev-parse --short HEAD)), $TAG is free"

step "Changelog"
release_args=(changelog:release "$TAG")
[[ -n "$NOTE" ]] && release_args+=("--note=$NOTE")
./dev.sh artisan "${release_args[@]}" || die "the changelog was not released (see above) - nothing was committed"
if git diff --quiet -- "$CHANGELOG"; then die "the changelog did not change"; fi
echo
./dev.sh artisan changelog:notes "$TAG"
answer=y
[[ $YES -eq 1 ]] || read -r -p "    ? Release $TAG with these notes? [y/N] " answer </dev/tty
if [[ ! "$answer" =~ ^[YyAa] ]]; then
    git checkout -- "$CHANGELOG"
    die "cancelled - the changelog was restored"
fi

step "Commit, tag, push"
git add -- "$CHANGELOG"
git commit -q -m "release: $TAG"
git tag -a "$TAG" -m "Release $TAG"
git push -q --atomic origin main "$TAG" || die "push failed - the commit and the tag are local (git push --atomic origin main $TAG)"
info "pushed - GitHub Actions → Release: changelog, tests, images, deploy, GitHub Release (15-25 min)"
