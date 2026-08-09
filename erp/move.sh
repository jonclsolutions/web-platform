#!/usr/bin/env bash
# @file create-core-pages.sh
# @project RPSW Web
# @created 2026
# @description Vytvoří src/app/admin/core-pages a přesune do ní stránky, které jsou
#   systémové/sdílené napříč Web a E-shop (GDPR/TOS, správa účtů, role, firemní údaje,
#   externí odkazy). Zároveň vygeneruje dvě nové komponenty: core dashboard (placeholder)
#   a core logy (placeholder napojený dočasně na existující web_logs endpoint).
# @usage Spustit z kořene Angular projektu: cd /rp_website/erp && bash create-core-pages.sh
# @note Přesun používá `git mv`, pokud je aktuální adresář git repozitář (zachová historii
#   souborů), jinak spadne zpět na obyčejné `mv`. Po spuštění je NUTNÉ ručně nahradit
#   admin-routing.module.ts a admin-layout.component.{html,ts} verzemi dodanými zvlášť.

set -euo pipefail

SRC_ROOT="src/app/admin/web-pages"
DEST_ROOT="src/app/admin/core-pages"

MOVE_DIRS=(
  "edit-legal"
  "personal-info"
  "web-settings"
  "external-links"
  "edit-roles"
  "administrators"
)

IS_GIT_REPO=false
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  IS_GIT_REPO=true
fi

echo "== Krok 1/3: vytvářím $DEST_ROOT =="
mkdir -p "$DEST_ROOT"

echo "== Krok 2/3: přesouvám existující stránky do core-pages =="
for dir in "${MOVE_DIRS[@]}"; do
  SRC="$SRC_ROOT/$dir"
  DEST="$DEST_ROOT/$dir"

  if [ ! -d "$SRC" ]; then
    echo "  [PŘESKOČENO] $SRC neexistuje."
    continue
  fi

  if [ -d "$DEST" ]; then
    echo "  [PŘESKOČENO] $DEST už existuje - smaž ho ručně, pokud chceš přesun zopakovat."
    continue
  fi

  if [ "$IS_GIT_REPO" = true ]; then
    git mv "$SRC" "$DEST"
    echo "  [OK, git mv] $dir -> core-pages/$dir"
  else
    mv "$SRC" "$DEST"
    echo "  [OK, mv] $dir -> core-pages/$dir"
  fi
done

echo "== Krok 3/3: generuji nové core-pages komponenty (dashboard, logs) =="

# ── core-pages/dashboard ──────────────────────────────────────────────────
mkdir -p "$DEST_ROOT/dashboard"

cat > "$DEST_ROOT/dashboard/dashboard.component.ts" << 'EOF'
/**
 * @file dashboard.component.ts
 * @path src/app/admin/core-pages/dashboard/dashboard.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Placeholder landing page for the new "Core" admin module (system-wide
 *   settings shared across Web and Shop: legal docs, accounts, roles, company info,
 *   external links). Currently static welcome text - will be replaced with real
 *   summary widgets once the Core module's own metrics are defined.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * @description Landing page shown at /admin/core (default redirect target). Purely
 *   presentational placeholder for now.
 * @usage Routed as the default child of the 'core' route group in admin-routing.module.ts.
 */
@Component({
  selector: 'app-core-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoreDashboardComponent {}
EOF

cat > "$DEST_ROOT/dashboard/dashboard.component.html" << 'EOF'
<!-- 
    @file: dashboard.component.html
    @path: /src/app/admin/core-pages/dashboard/dashboard.component.html
    @project: RPSW Web
    @author: RPSW
    @created: 2026
-->

<div class="core-dashboard-placeholder">
  <div class="core-dashboard-icon" aria-hidden="true">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  </div>
  <h1 class="core-dashboard-title">Vítejte ve vašem systému</h1>
  <p class="core-dashboard-text">
    Tohle je výchozí stránka Core modulu - sdílené systémové nastavení napříč Web
    a E-shop (GDPR/TOS, správa účtů, role a oprávnění, firemní údaje, externí odkazy,
    logy). Obsah této stránky bude časem doplněn o přehledové widgety.
  </p>
</div>
EOF

cat > "$DEST_ROOT/dashboard/dashboard.component.css" << 'EOF'
/*
    @file: dashboard.component.css
    @path: /src/app/admin/core-pages/dashboard/dashboard.component.css
    @project: RPSW Web
    @author: RPSW
    @created: 2026
*/

.core-dashboard-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 16px;
  padding: 80px 24px;
}

.core-dashboard-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: rgba(166, 125, 255, 0.1);
  border: 1px solid rgba(166, 125, 255, 0.25);
  color: #a67dff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.core-dashboard-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #e0e0f0;
  margin: 0;
}

.core-dashboard-text {
  font-size: 0.92rem;
  line-height: 1.65;
  color: #888899;
  max-width: 480px;
  margin: 0;
}
EOF

echo "  [OK] core-pages/dashboard vygenerována"

# ── core-pages/logs ────────────────────────────────────────────────────────
mkdir -p "$DEST_ROOT/logs"

cat > "$DEST_ROOT/logs/logs.component.ts" << 'EOF'
/**
 * @file logs.component.ts
 * @path src/app/admin/core-pages/logs/logs.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Placeholder systémových logů pro nový Core modul. Zatím čte ze STEJNÉHO
 *   zdroje dat, jaký dnes používá Web modul (business-logs / tabulka `web_logs`),
 *   protože vyhrazená `core_logs` tabulka zatím neexistuje.
 * @note DOČASNÝ ZDROJ DAT: `API_ENDPOINT` níže předpokládá existující web-logs REST
 *   endpoint. Ověř, že sedí s routes/api.php - pokud ne, uprav jen tuhle konstantu.
 *   Až vznikne vlastní `core_logs` tabulka/endpoint, stačí změnit tuto konstantu
 *   a mapování v `loadLogs()` - zbytek komponenty (tabulka, stavy) je na zdroji dat
 *   nezávislý.
 * @note Záměrně NEPOUŽÍVÁ sdílený GenericTableService/table-builder - jde o minimální
 *   samostatnou implementaci, ať nezávisí na přesné podobě API té sdílené komponenty.
 *   Na table-builder lze bezpečně migrovat později, až bude jasný finální zdroj dat.
 */

import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataHandler } from '../../../core/services/data-handler.service';

/** Jeden řádek logu - podle sloupců tabulky `web_logs` (viz db.sql). */
interface CoreLogRow {
  id: number;
  created_at: string;
  event_type: string;
  module: string;
  description: string;
  user_plain: string | null;
}

/**
 * @description Placeholder stránka systémových logů pro Core modul.
 * @usage Routováno jako /admin/core/logs.
 */
@Component({
  selector: 'app-core-logs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoreLogsComponent implements OnInit {
  /** TEMP - viz poznámka v hlavičce souboru, ověř skutečnou cestu v routes/api.php. */
  private readonly API_ENDPOINT = 'web-logs';

  private dataHandler = inject(DataHandler);
  private cd = inject(ChangeDetectorRef);

  logs: CoreLogRow[] = [];
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.loadLogs();
  }

  private loadLogs(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.dataHandler.get<any>(this.API_ENDPOINT).subscribe({
      next: (res) => {
        // Podporuje jak přímé pole, tak Laravel paginate() obálku ({ data: [...] }).
        this.logs = Array.isArray(res) ? res : (res?.data ?? []);
        this.isLoading = false;
        this.cd.markForCheck();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Logy se nepodařilo načíst.';
        this.isLoading = false;
        this.cd.markForCheck();
      }
    });
  }
}
EOF

cat > "$DEST_ROOT/logs/logs.component.html" << 'EOF'
<!-- 
    @file: logs.component.html
    @path: /src/app/admin/core-pages/logs/logs.component.html
    @project: RPSW Web
    @author: RPSW
    @created: 2026
-->

<div class="core-logs-page">
  <div class="core-logs-header">
    <h1 class="core-logs-title">Core logy</h1>
    <p class="core-logs-subtitle">
      Dočasně zobrazuje záznamy ze sdílené tabulky systémových logů. Po zavedení
      vlastní tabulky pro Core modul se zdroj dat přepne beze změny vzhledu stránky.
    </p>
  </div>

  @if (isLoading) {
    <div class="core-logs-state">Načítám…</div>
  } @else if (errorMessage) {
    <div class="core-logs-state core-logs-state--error">{{ errorMessage }}</div>
  } @else if (logs.length === 0) {
    <div class="core-logs-state">Zatím žádné záznamy.</div>
  } @else {
    <div class="core-logs-table-wrap">
      <table class="core-logs-table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Modul</th>
            <th>Typ události</th>
            <th>Popis</th>
            <th>Uživatel</th>
          </tr>
        </thead>
        <tbody>
          @for (row of logs; track row.id) {
            <tr>
              <td>{{ row.created_at }}</td>
              <td>{{ row.module }}</td>
              <td>{{ row.event_type }}</td>
              <td>{{ row.description }}</td>
              <td>{{ row.user_plain || '—' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }
</div>
EOF

cat > "$DEST_ROOT/logs/logs.component.css" << 'EOF'
/*
    @file: logs.component.css
    @path: /src/app/admin/core-pages/logs/logs.component.css
    @project: RPSW Web
    @author: RPSW
    @created: 2026
*/

.core-logs-page {
  padding: 24px;
}

.core-logs-header {
  margin-bottom: 20px;
}

.core-logs-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: #e0e0f0;
  margin: 0 0 6px;
}

.core-logs-subtitle {
  font-size: 0.85rem;
  color: #888899;
  line-height: 1.55;
  margin: 0;
  max-width: 640px;
}

.core-logs-state {
  padding: 40px 20px;
  text-align: center;
  color: #888899;
  font-size: 0.9rem;
  border: 1px dashed rgba(166, 125, 255, 0.25);
  border-radius: 12px;
}

.core-logs-state--error {
  color: #f08080;
  border-color: rgba(240, 128, 128, 0.35);
}

.core-logs-table-wrap {
  overflow-x: auto;
  border: 1px solid rgba(166, 125, 255, 0.12);
  border-radius: 12px;
}

.core-logs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.core-logs-table th {
  text-align: left;
  padding: 12px 14px;
  background: #18183a;
  color: #a67dff;
  font-weight: 700;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.core-logs-table td {
  padding: 10px 14px;
  border-top: 1px solid rgba(166, 125, 255, 0.08);
  color: #d0d0e0;
}

.core-logs-table tbody tr:hover {
  background: rgba(166, 125, 255, 0.04);
}
EOF

echo "  [OK] core-pages/logs vygenerována"

echo ""
echo "================================================================"
echo "HOTOVO. core-pages/ obsahuje:"
ls -1 "$DEST_ROOT"
echo "================================================================"
echo "DALŠÍ KROKY (ručně):"
echo "1. Nahraď src/app/admin/admin-routing.module.ts dodanou verzí."
echo "2. Nahraď src/app/admin/components/admin-layout/admin-layout.component.html dodanou verzí."
echo "3. Nahraď src/app/admin/components/admin-layout/admin-layout.component.ts dodanou verzí."
echo "4. V DB: přidej řádek do core_permissions s permission_key = 'view-core'"
echo "   a přiřaď ho příslušným rolím v core_role_permissions."
echo "5. Ověř API_ENDPOINT v core-pages/logs/logs.component.ts proti routes/api.php."
echo "================================================================"