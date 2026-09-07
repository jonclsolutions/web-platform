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
 * - AdminLocalizationService: Statické i18n admin UI.
 *
 * (Earlier refactor-notes for per-resource import endpoints, XLSX removal from
 * import, and the OnPush change-detection bugfix are unchanged - see version
 * history, omitted here for brevity.)
 *
 * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty"
 * ImportPopupBuilderComponent NEdědí BaseDataComponent, proto ruční injection
 * AdminLocalizationService + lokální `strings`/`t()`, přesně dle vzoru
 * TableBuilderComponent/GraphBuilderComponent. Komponenta MÁ
 * `ChangeDetectionStrategy.OnPush`, proto JE potřeba `translations$.subscribe(()
 * => markForCheck())` v konstruktoru. Nahrazeny VŠECHNY uživatelsky viditelné texty
 * (nadpisy, hlášky, chybové texty, tlačítka). `keyvalue` pipe iterace nad
 * `err.errors` v šabloně (technické názvy sloupců + Laravel validační zprávy z
 * backendu) VĚDOMĚ nepřekládána - je to backendový výstup, mimo scope frontendové
 * i18n vrstvy.
 *
 * @refactor-note (2026-09v2) BACKLOG "žádný český fallback": `EXPORT_FORMAT_OPTIONS`
 * (statická konstanta) byla ODSTRANĚNA z export-format.ts (i jako "záložní" varianta
 * porušovala pravidlo žádného tichého českého fallbacku). `readonly formatOptions`
 * pole nahrazeno getterem volajícím `createExportFormatOptions(this.i18n)` - viz
 * export-format.ts refactor-note (2026-09v2).
 */

import { Component, EventEmitter, Input, Output, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DataHandler } from '../../../../core/services/data-handler.service';
import { AlertDialogService } from '../../../../core/services/alert-dialog.service';
import { ScrollLockService } from '../../../../core/services/scroll-lock.service';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { environment } from '../../../../../environments/environment';
import { ExportFormat, createExportFormatOptions, ExportFormatOption } from '../../../../shared/interfaces/export-format';

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

  /**
   * @refactor-note (2026-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty".
   */
  public readonly i18n = inject(AdminLocalizationService);
  public get strings(): any { return this.i18n.getMergedSection('import-popup'); }
  public t(key: string): string { return this.i18n.getValue(`import-popup.${key}`); }

  step: ImportStep = 'format';
  selectedFormat: ExportFormat | null = null;
  selectedFile: File | null = null;

  isDownloadingTemplate = false;
  isValidating = false;
  isCommitting = false;

  validation: ImportValidateResponse | null = null;
  commitResult: ImportCommitResponse | null = null;

  /**
   * @refactor-note (2026-09v2) `readonly formatOptions` -> getter, ať se
   * `description` texty přepočítají po přepnutí admin jazyka; `EXPORT_FORMAT_OPTIONS`
   * (statický deprecated fallback) byl odstraněn z export-format.ts, takže i toto
   * musí přejít na `createExportFormatOptions(i18n)`.
   */
  get formatOptions(): ExportFormatOption[] {
    return createExportFormatOptions(this.i18n).filter(opt => opt.value !== 'xlsx');
  }

  private readonly baseUrl = environment.base_api_url;

  constructor() {
    // Po přepnutí admin jazyka donutí OnPush komponentu přehodnotit `strings`/gettery -
    // stejný vzor jako TableBuilderComponent/GraphBuilderComponent.
    this.i18n.translations$.subscribe(() => this.cd.markForCheck());
  }

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
          ? this.t('template_not_configured')
          : this.t('template_download_failed');
        this.alertDialogService.open(this.t('error_title'), msg, 'danger');
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
            this.t('import_done_title'),
            this.t('import_done_message')
              .replace('{imported}', String(res.imported_count))
              .replace('{skipped}', String(res.skipped_count)),
            'success'
          );
        } else {
          this.alertDialogService.open(this.t('import_queued_title'), res.message ?? this.t('import_queued_default_message'), 'success');
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