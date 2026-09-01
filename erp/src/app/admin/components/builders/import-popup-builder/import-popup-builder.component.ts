/**
 * @file import-popup-builder.component.ts
 * @path src/app/admin/components/builders/import-popup-builder/import-popup-builder.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Reusable import popup - stejná role jako `ExportPopupBuilderComponent`,
 * ale pro opačný směr (soubor -> DB, append-only). Řeší celý flow: výběr formátu,
 * stažení prázdné šablony, upload souboru, zobrazení dry-run souhrnu (validní/chybné
 * řádky) a po potvrzení spuštění skutečného zápisu (`core/import/commit`).
 *
 * @security Import je VŽDY dvoukrokový (dry-run token -> commit) - komponenta sama
 * nikdy neposílá soubor podruhé, jen `import_token` vrácený z validace (viz
 * `ImportController` na backendu). Skutečné vynucení oprávnění (`-create` permission
 * daného resource) i whitelist sloupců řeší výhradně backend - tahle komponenta je
 * čistě prezentační/orchestrační vrstva, stejně jako export.
 *
 * @dependencies
 * - DataHandler: multipart upload (`upload()`) a JSON volání (`post()`/`get()`).
 * - HttpClient: přímé volání pro stažení šablony jako blob (DataHandler.get() nemá
 *   responseType 'blob' variantu - stejný důvod, proč TableBuilderComponent pro XLSX
 *   export taky nepoužívá DataHandler, ale volá SheetJS přímo).
 * - ScrollLockService: Sdílený zámek scrollu na pozadí (viz refactor-note 2026-08-31).
 *
 * @refactor-note (2026-08-23) PŘECHOD Z CENTRÁLNÍHO `core/import/*` NA PER-RESOURCE
 * ENDPOINTY (`{resource}/import/template`, `/import/validate`, `/import/commit`) -
 * stejný důvod jako u hromadného mazání (viz TableBuilderComponent.onBulkDeleteClick()):
 * generický zápis přes centrální kontrolér obcházel `store()` konkrétního kontroleru,
 * a s ním i jeho vedlejší efekty (hashování hesla, notifikační e-maily, přiřazení výchozí
 * role apod.) - riziko, které by se dřív nebo později projevilo na jiném resource, i
 * když u prvního otestovaného (`web/raw_request_commissions`) bylo neškodné. Import
 * teď musí mít vlastní `importTemplate()`/`importValidate()`/`importCommit()` metody
 * přímo v konkrétním kontroleru - tahle komponenta zůstává beze změny použitelná,
 * protože jen skládá URL z `resource` Inputu, stejně jako předtím.
 *
 * @refactor-note (2026-08-23v2) XLSX ODEBRÁNO Z IMPORTU (export XLSX přes SheetJS na
 * frontendu tímhle NENÍ dotčen, zůstává funkční beze změny) - čtení binárního .xlsx
 * na backendu vyžadovalo `phpoffice/phpspreadsheet`, který má tvrdou závislost na PHP
 * rozšíření `ext-gd`. Na některých hostinzích (sdílený hosting bez možnosti měnit PHP
 * moduly) by to zbytečně komplikovalo nasazení kvůli jedinému formátu s plnohodnotnou
 * náhradou (CSV). `formatOptions` proto XLSX z nabídky vyřazuje jen pro IMPORT popup -
 * `EXPORT_FORMAT_OPTIONS` samotné pole zůstává nedotčené (export ho pořád nabízí).
 *
 * @bugfix-note (2026-08-31) BACKLOG "zablokovat scroll na pozadí u popup builderů":
 * tahle komponenta dřív scroll na pozadí VŮBEC nezamykala (na rozdíl od
 * ExportPopupBuilderComponent) - přidán `implements OnInit, OnDestroy` +
 * `ScrollLockService.lock()/unlock()`, stejný mechanismus jako u všech ostatních
 * overlay komponent v aplikaci - viz scroll-lock.service.ts.
 */

import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DataHandler } from '../../../../core/services/data-handler.service';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { ScrollLockService } from '../../../../core/services/scroll-lock.service';
import { environment } from '../../../../../environments/environment';
import { ExportFormat, EXPORT_FORMAT_OPTIONS, ExportFormatOption } from '../../../../shared/interfaces/export-format';

/** @description Jeden řádek chybového souhrnu z dry-run validace. */
interface ImportRowError {
  row: number;
  errors: Record<string, string[]>;
}

/** @description Odpověď `POST core/import/validate`. */
interface ImportValidateResponse {
  import_token: number;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  errors: ImportRowError[];
  can_commit: boolean;
}

/** @description Odpověď `POST core/import/commit` pro synchronní (malé) importy. */
interface ImportCommitResponse {
  queued: boolean;
  batch_id?: number;
  message?: string;
  imported_count?: number;
  skipped_count?: number;
  skip_reasons?: Record<number, string>;
}

type ImportStep = 'format' | 'upload' | 'summary' | 'done';

/**
 * @description Modální popup pro hromadný append-only import dat do libovolné tabulky
 * registrované v backendovém `config/importable_resources.php`.
 * @usage `<app-import-popup-builder [resource]="apiEndpoint" (imported)="onImported()" (closed)="onClose()" />`
 */
@Component({
  selector: 'app-import-popup-builder',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './import-popup-builder.component.html',
  styleUrl: './import-popup-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImportPopupBuilderComponent implements OnInit, OnDestroy {
  /** @description Resource klíč - MUSÍ přesně odpovídat `apiEndpoint` stránky a klíči v backendovém registru. */
  @Input({ required: true }) resource!: string;

  @Output() imported = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  private dataHandler = inject(DataHandler);
  private http = inject(HttpClient);
  private alertDialogService = inject(AlertDialogService);
  private cd = inject(ChangeDetectorRef);
  private scrollLock = inject(ScrollLockService);

  step: ImportStep = 'format';
  selectedFormat: ExportFormat | null = null;
  selectedFile: File | null = null;

  isDownloadingTemplate = false;
  isValidating = false;
  isCommitting = false;

  validation: ImportValidateResponse | null = null;
  commitResult: ImportCommitResponse | null = null;

  readonly formatOptions: ExportFormatOption[] = EXPORT_FORMAT_OPTIONS.filter(opt => opt.value !== 'xlsx');

  private readonly baseUrl = environment.base_api_url;

  ngOnInit(): void {
    this.scrollLock.lock();
  }

  ngOnDestroy(): void {
    this.scrollLock.unlock();
  }

  // ── Krok 1: volba formátu ────────────────────────────────────────────────

  selectFormat(format: ExportFormat): void {
    this.selectedFormat = format;
    this.step = 'upload';
  }

  backToFormat(): void {
    this.selectedFile = null;
    this.validation = null;
    this.step = 'format';
  }

  // ── Šablona ──────────────────────────────────────────────────────────────

  /**
   * @description Stáhne prázdnou šablonu se správnými hlavičkami. Volá `HttpClient`
   * přímo (ne `DataHandler`), protože potřebujeme `responseType: 'blob'` - stejný
   * důvod jako u XLSX exportu v `TableBuilderComponent`.
   * @bugfix-note (2026-08-22) Dřív se `format` parametr backendu vůbec neposílal a
   * přípona souboru byla natvrdo `.csv` bez ohledu na zvolený formát - backend teď
   * podle `format` generuje odpovídající soubor (viz ImportController::template()),
   * frontend musí poslat stejnou hodnotu a použít odpovídající příponu.
   */
  downloadTemplate(): void {
    if (this.isDownloadingTemplate || !this.selectedFormat) return;
    this.isDownloadingTemplate = true;

    this.http.get(`${this.baseUrl}/${this.resource}/import/template`, {
      params: { format: this.selectedFormat! },
      responseType: 'blob',
    }).subscribe({
      next: (blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `import-sablona-${this.resource.replace(/\//g, '-')}.${this.selectedFormat}`;
        link.click();
        URL.revokeObjectURL(link.href);
        this.isDownloadingTemplate = false;
        this.cd.markForCheck();
      },
      error: (err) => {
        this.isDownloadingTemplate = false;
        const msg = err?.status === 404
          ? 'Import pro tuto tabulku není nastaven.'
          : 'Šablonu se nepodařilo stáhnout.';
        this.alertDialogService.open('Chyba', msg, 'danger');
        this.cd.markForCheck();
      }
    });
  }

  // ── Krok 2: výběr souboru + dry-run validace ────────────────────────────

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.selectedFile = file;
  }

  clearSelectedFile(): void {
    this.selectedFile = null;
  }

  /**
   * @description Odešle soubor na `core/import/validate` - NEZAPISUJE nic do DB,
   * jen vrátí souhrn a `import_token` pro následný `commit()`.
   * @bugfix-note (2026-08-22) HLAVNÍ PŘÍČINA "zaseknutého" UI: komponenta má
   * `ChangeDetectionStrategy.OnPush`, ale chyběl `ChangeDetectorRef`/`markForCheck()`.
   * Backend odpovídal správně a `this.step = 'summary'` se v JS proměnné SKUTEČNĚ
   * nastavilo (potvrzeno console.logem), ale Angular OnPush komponentu bez explicitního
   * `markForCheck()` po async RxJS callbacku nepřekreslí - view tak zůstalo vizuálně
   * na kroku "upload", i když interní stav byl už dávno "summary". Přidán `cd.markForCheck()`
   * po KAŽDÉ asynchronní změně stavu v této komponentě (viz i `downloadTemplate()`/
   * `confirmCommit()`).
   */
  runValidation(): void {
    if (!this.selectedFile || !this.selectedFormat || this.isValidating) return;

    this.isValidating = true;

    const formData = new FormData();
    formData.append('format', this.selectedFormat!);
    formData.append('file', this.selectedFile, this.selectedFile.name);

    this.dataHandler.upload<ImportValidateResponse>(`${this.resource}/import/validate`, formData).subscribe({
      next: (res) => {
        this.validation = res;
        this.isValidating = false;
        this.step = 'summary';
        this.cd.markForCheck();
      },
      error: () => {
        // Chybová hláška se zobrazí přes DataHandler.handleError() (globální alert),
        // tady jen odemkneme UI zpátky.
        this.isValidating = false;
        this.cd.markForCheck();
      }
    });
  }

  // ── Krok 3: souhrn dry-run + potvrzení zápisu ───────────────────────────

  get hasErrors(): boolean {
    return (this.validation?.invalid_rows ?? 0) > 0;
  }

  /**
   * @description Potvrdí zápis - pošle jen `import_token` (soubor se znovu NEPOSÍLÁ,
   * viz bezpečnostní poznámka v hlavičce souboru).
   */
  confirmCommit(): void {
    if (!this.validation || this.isCommitting) return;
    this.isCommitting = true;

    this.dataHandler.post<ImportCommitResponse>(`${this.resource}/import/commit`, {
      import_token: this.validation.import_token,
    }).subscribe({
      next: (res) => {
        this.commitResult = res;
        this.isCommitting = false;
        this.step = 'done';
        this.cd.markForCheck();

        if (!res.queued) {
          this.alertDialogService.open(
            'Import dokončen',
            `Přidáno ${res.imported_count} záznamů, přeskočeno ${res.skipped_count}.`,
            'success'
          );
        } else {
          this.alertDialogService.open('Import zařazen do fronty', res.message ?? 'Import se zpracovává na pozadí.', 'success');
        }

        this.imported.emit();
      },
      error: () => {
        this.isCommitting = false;
        this.cd.markForCheck();
      }
    });
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onClose(): void {
    if (this.isValidating || this.isCommitting) return;
    this.closed.emit();
  }
}