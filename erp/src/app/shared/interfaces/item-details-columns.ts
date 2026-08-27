/**
 * @refactor-note (2026-08-23) Přidáno `importable?: boolean` - viz backlog task
 * "raw_request_commissions: bulk import/export/delete".
 * @refactor-note (2026-08-26) Přidáno `chartable?: boolean` a
 * `chartAggregation?: 'count' | 'sum' | 'avg'` - viz graph-builder backlog.
 * @refactor-note (2026-08-27v11) Přidáno `chartPossibleValues?: string[]` - volitelný
 * ÚPLNÝ seznam hodnot pro `chartable` sloupce (typicky stejná `*_OPTIONS` konstanta,
 * jakou už stránka používá pro `<select>` formulářového pole/filtru - viz
 * `USER_REQUEST_STATUS_OPTIONS` apod. v user-request.config.ts). Propaguje se do
 * `GraphColumnOption.possibleValues` (graph-format.ts) - `GraphBuilderComponent` díky
 * němu do grafu/legendy/filtru hodnot doplní i hodnoty, které se v datech nikdy
 * nevyskytly (s počtem 0), např. hodnocení 1-5, kde nikdo nedal "5". Volitelné pole -
 * chybějící hodnota = beze změny oproti dosavadnímu chování (jen pozorované hodnoty).
 */
export interface ItemDetailsColumns {
  key: string;
  displayName: string;
  type: 'text' | 'file' | 'files' | 'currency' | 'date' | 'boolean' | 'image' | 'array' | 'object';
  format?: string;
  importable?: boolean;
  chartable?: boolean;
  chartAggregation?: 'count' | 'sum' | 'avg';
  chartPossibleValues?: string[];
}