/**
 * @refactor-note (2026-08-23) Přidáno `importable?: boolean` - viz backlog task
 * "raw_request_commissions: bulk import/export/delete". Označuje, které sloupce
 * daný resource umí přijmout ZPĚT přes hromadný import (musí přesně sedět s
 * `IMPORTABLE_COLUMNS` whitelistem v příslušném backendovém kontroleru).
 * `TableBuilderComponent` podle tohoto příznaku nabídne v export popupu přepínač
 * "Exportovat v surovém formátu" (technické názvy sloupců jako hlavičky, neformátované
 * hodnoty - takový export jde rovnou zpětně naimportovat). Volitelné pole - chybějící
 * hodnota = `false`/nepoužije se, takže žádná existující konfigurace jinde v aplikaci
 * se touhle změnou nerozbije.
 */
export interface ItemDetailsColumns {
  key: string;
  displayName: string;
  type: 'text' | 'file' | 'files' | 'currency' | 'date' | 'boolean' | 'image' | 'array' | 'object';
  format?: string;
  importable?: boolean;
}