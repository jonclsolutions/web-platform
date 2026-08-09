#!/usr/bin/env bash
# @file fix-admin-links.sh
# @project RPSW Web
# @created 2026
# @description Opraví zastaralý routerLink odkaz na starou (před-core-split) URL strukturu.
#   Konkrétně: routerLink="/admin/dashboard" -> routerLink="/admin/web/dashboard"
#   v knowledge-base.component.html ("Exit" odkaz z intranetu zpět do administrace).
# @usage Spustit z kořene Angular projektu: cd /rp_website/erp && bash fix-admin-links.sh
# @note Používá `sed -i` s přesným, plně uzavřeným řetězcem (routerLink="/admin/dashboard"
#   včetně uvozovky na konci), takže nemůže omylem zasáhnout jiné odkazy jako
#   "/admin/dashboard-something" nebo "/admin/web/dashboard" (ten už uvozovku nemá hned
#   po "dashboard", takže nesedí).

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