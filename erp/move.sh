#!/usr/bin/env bash
# @file fix-admin-links.sh
# @project JS web-platform
# @created 2026
# @description Fixes an outdated routerLink pointing to the old (pre core split) URL structure.
#   Specifically: routerLink="/admin/dashboard" -> routerLink="/admin/web/dashboard"
#   in knowledge-base.component.html (the "Exit" link from the intranet back to the admin).
# @usage Run from the root of the Angular project: cd erp && bash move.sh
# @note Uses `sed -i` with an exact, fully closed string (routerLink="/admin/dashboard"
#   including the closing quote), so it cannot hit other links such as
#   "/admin/dashboard-something" or "/admin/web/dashboard" (no quote right after
#   "dashboard", so they do not match).

set -euo pipefail

TARGET_FILE="src/app/admin/intranet/knowledge-base/knowledge-base.component.html"
OLD_LINK='routerLink="/admin/dashboard"'
NEW_LINK='routerLink="/admin/web/dashboard"'

if [ ! -f "$TARGET_FILE" ]; then
  echo "CHYBA: $TARGET_FILE nenalezen. Spouštíš script z kořene Angular projektu (erp/)?"
  exit 1
fi

echo "== Před opravou =="
grep -n "$OLD_LINK" "$TARGET_FILE" || echo "  (žádný výskyt nenalezen - možná už opraveno)"

if grep -q "$OLD_LINK" "$TARGET_FILE"; then
  sed -i "s|${OLD_LINK}|${NEW_LINK}|g" "$TARGET_FILE"
  echo ""
  echo "== Oprava provedena =="
fi

echo ""
echo "== Po opravě (kontrola) =="
grep -n "routerLink=\"/admin/" "$TARGET_FILE" || echo "  (žádné /admin/ odkazy v souboru)"

echo ""
echo "== Finální kontrola celého projektu na zbývající zastaralé odkazy =="
echo "(očekáváme jen /admin/web/..., /admin/core/..., /admin/shop/..., /admin/intranet/...)"
grep -rn "routerLink=\"/admin/" src/ | grep -vE '/admin/(web|core|shop|intranet)/' || echo "  ŽÁDNÉ zastaralé odkazy nenalezeny - vše čisté."