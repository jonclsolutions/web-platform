/**
 * @file table-refresh-bus.service.ts
 * @path src/app/core/services/table-refresh-bus.service.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Lehký event bus pro globální "Aktualizovat vše" tlačítko v admin headeru.
 * AdminLayoutComponent nemá žádnou přímou referenci na aktuálně vykreslenou stránkovou
 * komponentu (jede přes <router-outlet>), takže potřebuje způsob, jak jí "zavolat"
 * refresh bez přímé závislosti - odsud ten bus.
 * @dependencies
 * - GenericTableService: Skutečné zneplatnění cache napříč všemi endpointy.
 */

import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { GenericTableService } from './generic-table.service';

@Injectable({ providedIn: 'root' })
export class TableRefreshBusService {
  private _refreshAll$ = new Subject<void>();

  /** Stránky s tabulkou (přes BaseDataComponent.initWithAuthCheck()) se na tohle přihlásí. */
  public refreshAll$ = this._refreshAll$.asObservable();

  constructor(private genericTableService: GenericTableService) {}

  /**
   * @description Zavolá globální admin header refresh tlačítko. Nejdřív zneplatní
   * ÚPLNĚ CELOU cache (žádný síťový dotaz sám o sobě), pak vyšle signál, na který
   * aktuálně mountnutá stránka zareaguje reálným refetchem toho, co má otevřené.
   * Ostatní, právě NEotevřené stránky se přefetchnou samy při příští návštěvě, protože
   * jejich cache je teď prázdná.
   */
  triggerGlobalRefresh(): void {
    this.genericTableService.invalidateAll();
    this._refreshAll$.next();
  }
}