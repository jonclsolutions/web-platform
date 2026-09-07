/**
 * @file edit-legal.component.ts
 * @path src/app/admin/web-pages/edit-legal/edit-legal.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Provides a multi-language content management interface for legal document sections (e.g., GDPR, Terms of Service, Cookies).
 * @dependencies
 * - BaseDataComponent: Manages core CRUD operations and API communication.
 * - ConfirmDialogService: Facilitates secure deletion of content sections.
 * - AlertDialogService: Provides feedback to users after operations.
 * - ResourceCacheService: TTL cache pro document-types/languages/section fetche (viz
 *   refactor-note 2026-08-8).
 * - RxJS: Used for reactive data fetching and cross-language consistency checks.
 *
 * @refactor-note (2026) `activeTab: 1 | 2` bylo natvrdo napsané pro přesně 2 typy dokumentů
 * (GDPR/TOS). Po přidání třetího typu (Cookies) byl tenhle hardcoded výčet nahrazen
 * dynamickým načítáním typů dokumentů z nového endpointu `legal/document-types`
 * (viz DocumentTypeController) - přidání dalšího typu dokumentu v budoucnu tak
 * nebude vyžadovat žádnou další změnu v tomhle souboru.
 *
 * @refactor-note (2026-08-8) TTL CACHE (backlog: "zbytečně moc dotazů na API"). Tahle
 * stránka měla dva zdroje zbytečných requestů:
 * 1) `loadDocumentTypes()`/`loadLanguages()` se natahovaly znovu při KAŽDÉM vstupu na
 *    stránku, přestože typy dokumentů a jazyky se mění jen zřídka - teď cache 10 min.
 * 2) `checkCompleteness()` volá `loadAllData()` JEDNOU ZA KAŽDÝ JAZYK při KAŽDÉM
 *    přepnutí tabu/jazyka - přidána `fetchSections()` obalující stejné volání TTL cache
 *    (2 min) s klíčem podle `document_type_id` + `lang`, sdílenou s `refreshData()`.
 * Po jakékoliv mutaci (saveEdit/submitAdd/confirmDelete) se invaliduje jen cache klíč
 * PRÁVĚ upravované kombinace.
 *
 * @refactor-note (2026-08-11) KRITICKÁ OPRAVA - `usesPaginatedList = false` (backlog:
 * "zbytečně moc dotazů na API", stejná třída bugu jako u `CategoriesComponent`). Tahle
 * komponenta NEPOUŽÍVÁ stránkování vůbec - `this.data` je plněno výhradně vlastním
 * `override refreshData()`/`fetchSections()` podle `document_type_id`+`lang`. Bez
 * `usesPaginatedList = false` ale `BaseDataComponent.initWithAuthCheck()` navíc spouští
 * `this.list.loadInitial()` - pokus o STRÁNKOVANÝ fetch na `legal/document-sections`.
 * Backend (`DocumentSectionController::index()`) ale na tomhle endpointu vůbec
 * nestránkuje - vrací holé pole `DocumentSectionResource::collection($data)`, ne
 * `{ data: [...], total, ... }`. `GenericTableService`/`PaginatedListStore` pak udělá
 * `this.data = response.data`, kde `response` JE to pole samo -> `response.data` je
 * `undefined` -> `this.data` (přes `this.list.data`) se přepíše na `undefined` ->
 * runtime chyba `ctx.data is undefined` v šabloně (`@if (data.length === 0)`).
 * Stejnou cestou byl zranitelný i globální "Aktualizovat vše" button v headeru a
 * 15minutový background refresh (oba volaly zděděné `forceFullRefresh()`, které jde
 * přes `this.list`) - proto `forceFullRefresh()` teď PŘEPSÁNO, ať místo toho zavolá
 * `invalidateCurrentSections()` + `refreshData()` (skutečný zdroj dat téhle komponenty).
 */

import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormsModule } from '@angular/forms';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import * as Core from '../../../shared/imports/core-providers';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';

interface DocumentSection {
  id: number;
  document_type_id: number;
  position: number;
  heading: string;
  content: string;
  lang?: string;
}

interface DocumentTypeItem {
  id: number;
  slug: string;
  title: string;
}

/**
 * @description Manages the editing lifecycle of localized legal document content.
 * @usage Allows administrators to toggle between document types (GDPR, TOS, Cookies, ...) and languages, ensuring content parity across translations.
 * @note Implements an inline editing pattern with a completeness checker to warn users about missing translations.
 */
@Component({
  selector: 'app-edit-legal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './edit-legal.component.html',
  styleUrl: './edit-legal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditLegalComponent extends BaseDataComponent<DocumentSection> implements OnInit {
  override apiEndpoint: string = 'legal/document-sections';
  override usesPaginatedList = false;
protected override translationSection: string = 'edit-legal';
  private readonly LANG_MODULE = 'web';
  private readonly META_TTL_MS = 10 * 60 * 1000;
  private readonly SECTIONS_TTL_MS = 2 * 60 * 1000;

  private resourceCache = inject(ResourceCacheService);

  /** Typy dokumentů (GDPR/TOS/Cookies/...) načtené z API - taby se vykreslují podle tohoto pole. */
  documentTypes: DocumentTypeItem[] = [];
  /** ID aktuálně vybraného typu dokumentu; null dokud se typy ještě nenačetly. */
  activeTabId: number | null = null;

  languages: any[] = [];
  activeLang: string = 'cz';

  missingSummary: Record<number, string[]> = {};

  editingIds: Set<number> = new Set();
  editBuffer: Record<number, { heading: string; content: string }> = {};

  
  showAddForm = false;
  newHeading = '';
  newContent = '';
  saving = false;

  addForPosition: number | null = null;

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private fb: FormBuilder,
    private router: Core.Router,
    private confirmDialog: ConfirmDialogService,
    private alertDialog: AlertDialogService
  ) {
    super(dataHandler, cd, genericTableService);
    // Chráníme se před `undefined` i kdyby cokoliv (staré cache, race, budoucí regrese)
    // omylem přepsalo `this.data` přes zděděné `this.list` mechanismy - šablona s tímhle
    // polem počítá jako s polem vždy.
    this.data = [];
  }

  override ngOnInit(): void {
    this.initWithAuthCheck(this.router);
    this.loadDocumentTypes();
    this.loadLanguages();
  }

  /**
   * @description Načte dostupné typy právních dokumentů a nastaví první z nich jako
   * výchozí tab. Cache 10 min (viz refactor-note v hlavičce souboru).
   */
  private loadDocumentTypes(): void {
    this.resourceCache.get(
      'edit-legal:document-types',
      () => this.dataHandler.getCollection<DocumentTypeItem>('legal/document-types'),
      this.META_TTL_MS
    )
      .pipe(catchError(() => of([])))
      .subscribe((types) => {
        this.documentTypes = types ?? [];

        if (this.documentTypes.length > 0 && this.activeTabId === null) {
          this.activeTabId = this.documentTypes[0].id;
          this.refreshData();
        }

        this.cd.markForCheck();
      });
  }

  /**
   * @description Retrieves supported languages for the 'web' module and initializes the
   * active language state. Cache 10 min (viz refactor-note v hlavičce souboru).
   */
  private loadLanguages(): void {
    this.resourceCache.get(
      `edit-legal:languages:${this.LANG_MODULE}`,
      () => this.dataHandler.getCollection<any>(`languages/${this.LANG_MODULE}`),
      this.META_TTL_MS
    )
      .pipe(catchError(() => of({ languages: [] })))
      .subscribe((res: any) => {
        this.languages = (res?.languages ?? []).filter((l: any) => l.active !== false);

        if (this.languages.length > 0 && !this.languages.find(l => l.code === this.activeLang)) {
          this.activeLang = this.languages[0].code;
        }

        this.refreshData();
        this.cd.markForCheck();
      });
  }

  /**
   * @description Sjednocené načtení sekcí pro danou kombinaci typu dokumentu + jazyka,
   * přes TTL cache (viz refactor-note v hlavičce souboru). SDÍLENO mezi `refreshData()`
   * a `checkCompleteness()` - stejný klíč, stejný cache záznam, ať se stejná data
   * netahají dvakrát nezávisle.
   */
  private fetchSections(documentTypeId: number, lang: string): Observable<DocumentSection[]> {
    const key = `edit-legal:sections:${documentTypeId}:${lang}`;
    return this.resourceCache.get(
      key,
      () => this.loadAllData({ document_type_id: documentTypeId, lang }),
      this.SECTIONS_TTL_MS
    );
  }

  /**
   * @description Zneplatní cache klíč PRÁVĚ upravované kombinace (aktivní typ dokumentu +
   * aktivní jazyk) - volat po každé úspěšné mutaci (create/update/delete sekce).
   */
  private invalidateCurrentSections(): void {
    if (this.activeTabId === null) return;
    this.resourceCache.invalidate(`edit-legal:sections:${this.activeTabId}:${this.activeLang}`);
  }

  /**
   * @description Updates the active language and resets transient UI states to prevent editing collisions.
   * @param code The language ISO code to switch to.
   */
  switchLang(code: string): void {
    if (this.activeLang === code) return;
    this.activeLang = code;
    this.editingIds.clear();
    this.editBuffer = {};
    this.showAddForm = false;
    this.addForPosition = null;
    this.newHeading = '';
    this.newContent = '';
    this.refreshData();
  }

  getLangName(code: string): string {
    return this.languages.find(l => l.code === code)?.name ?? code.toUpperCase();
  }

  override refreshData(): void {
    if (this.activeTabId === null) return;

    this.fetchSections(this.activeTabId, this.activeLang).subscribe({
      next: (res) => {
        this.data = Array.isArray(res) ? res : [];
        this.checkCompleteness();
        this.cd.markForCheck();
      },
      error: () => {
        // I na chybu se `data` musí vrátit do prokazatelně platného stavu (prázdné pole),
        // ne zůstat undefined - viz refactor-note (2026-08-11) v hlavičce souboru.
        this.data = [];
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description "Tvrdý" refresh - přepsáno (ne zděděno z `BaseDataComponent`), ať
   * globální "Aktualizovat vše" tlačítko v headeru a periodický background refresh
   * (oba volají `forceFullRefresh()`) míří na SKUTEČNÝ zdroj dat téhle komponenty, ne
   * na `this.list` (které tahle komponenta vůbec nepoužívá - viz refactor-note
   * 2026-08-11 v hlavičce souboru).
   */
  override forceFullRefresh(_currentFilters: Core.FilterParams = this.defaultFilters): void {
    if (this.activeTabId === null) return;
    this.invalidateCurrentSections();
    this.refreshData();
  }

  /**
   * @description Přepne aktivní typ dokumentu (tab) a resetuje rozpracovaný stav editace.
   * @param tabId ID typu dokumentu z `documentTypes`.
   */
  switchTab(tabId: number): void {
    if (this.activeTabId === tabId) return;
    this.activeTabId = tabId;
    this.editingIds.clear();
    this.editBuffer = {};
    this.showAddForm = false;
    this.addForPosition = null;
    this.newHeading = '';
    this.newContent = '';
    this.refreshData();
  }

  /**
   * @description Performs an asynchronous check across all languages to identify missing translations for existing sections.
   * @note Uses forkJoin to aggregate data for every supported language and compares position availability. Přes `fetchSections()`
   * sdílí cache se zobrazenou sekcí, takže opakované přepínání tabů/jazyků nevyvolává
   * pokaždé nové requesty - viz refactor-note v hlavičce souboru.
   */
  private checkCompleteness(): void {
    if (this.languages.length <= 1 || this.activeTabId === null) {
      this.missingSummary = {};
      this.cd.markForCheck();
      return;
    }

    const requests = this.languages.map(lang =>
      this.fetchSections(this.activeTabId!, lang.code).pipe(
        map(res => ({
          lang: lang.code,
          positions: new Set<number>((Array.isArray(res) ? res : []).map((s: DocumentSection) => s.position))
        })),
        catchError(() => of({ lang: lang.code, positions: new Set<number>() }))
      )
    );

    forkJoin(requests).subscribe(results => {
      const allPositions = new Set<number>();
      results.forEach(r => r.positions.forEach(p => allPositions.add(p)));

      const summary: Record<number, string[]> = {};
      allPositions.forEach(pos => {
        const missing = results.filter(r => !r.positions.has(pos)).map(r => r.lang);
        if (missing.length > 0) {
          summary[pos] = missing;
        }
      });

      this.missingSummary = summary;
      this.cd.markForCheck();
    });
  }

  getMissingForPosition(position: number): string[] {
    return this.missingSummary[position] ?? [];
  }

  langHasWarning(langCode: string): boolean {
    return Object.values(this.missingSummary).some(missing => missing.includes(langCode));
  }

  get totalWarnings(): number {
    return Object.values(this.missingSummary).reduce((sum, arr) => sum + arr.length, 0);
  }

  get missingPositionsForCurrentLang(): number[] {
    return Object.keys(this.missingSummary)
      .map(Number)
      .filter(pos => this.missingSummary[pos].includes(this.activeLang))
      .sort((a, b) => a - b);
  }
    /** @refactor-note (2026-09) viz hlavička souboru - plain-text varianta bez <strong>. */
  get totalWarningsLabel(): string {
    const count = this.totalWarnings;
    const word = count === 1 ? this.strings.warning_count_singular : this.strings.warning_count_plural;
    return `${count} ${word}`;
  }

  get emptyMessage(): string {
    return this.strings.empty_no_sections.replace('{lang}', this.getLangName(this.activeLang));
  }

  missingTagTitle(item: DocumentSection): string {
    return this.strings.missing_tag_title.replace('{langs}', this.getMissingForPosition(item.position).join(', '));
  }

  missingTagText(item: DocumentSection): string {
    return this.strings.missing_tag_text.replace('{count}', String(this.getMissingForPosition(item.position).length));
  }

  get newSectionTitle(): string {
    return this.strings.new_section_title
      .replace('{tab}', this.tabLabel)
      .replace('{lang}', this.getLangName(this.activeLang));
  }

  positionFillTagText(pos: number): string {
    return this.strings.position_fill_tag.replace('{pos}', String(pos));
  }

  get addSectionToLabel(): string {
    return this.strings.add_section_to
      .replace('{tab}', this.tabLabel)
      .replace('{lang}', this.getLangName(this.activeLang));
  }

  addPositionButtonLabel(pos: number): string {
    return this.strings.add_position_button.replace('{pos}', String(pos));
  }

  /**
   * @description Initializes the buffer for inline editing of a specific document section.
   * @param item The section to start editing.
   */
  startEdit(item: DocumentSection): void {
    this.editingIds.add(item.id);
    this.editBuffer[item.id] = {
      heading: item.heading ?? '',
      content: item.content ?? '',
    };
    this.cd.markForCheck();
  }

  cancelEdit(id: number): void {
    this.editingIds.delete(id);
    delete this.editBuffer[id];
    this.cd.markForCheck();
  }

  /**
   * @description Commits edited data to the API and refreshes the current view.
   * @param item The original item containing the ID.
   */
    saveEdit(item: DocumentSection): void {
    const buf = this.editBuffer[item.id];
    if (!buf || !buf.content?.trim()) {
      this.alertDialog.open(this.t('shared.error'), this.t('edit-legal.content_empty_error'), 'warning');
      return;
    }

    this.saving = true;
    const payload: DocumentSection = {
      ...item,
      heading: buf.heading,
      content: buf.content,
      lang: this.activeLang,
    };

    this.updateData(item.id, payload).subscribe({
      next: () => {
        this.cancelEdit(item.id);
        this.saving = false;
        this.invalidateCurrentSections();
        this.refreshData();
        this.alertDialog.open(this.t('shared.success'), this.t('edit-legal.save_success'), 'success');
      },
      error: () => {
        this.saving = false;
        this.alertDialog.open(this.t('shared.error'), this.t('edit-legal.save_error'), 'danger');
        this.cd.markForCheck();
      }
    });
  }

  isEditing(id: number): boolean {
    return this.editingIds.has(id);
  }

  /**
   * @description Displays the creation form and scrolls it into view.
   * @param position Optional numeric index for ordering.
   */
  openAddForm(position?: number): void {
    this.showAddForm = true;
    this.addForPosition = position ?? null;
    this.newHeading = '';
    this.newContent = '';
    setTimeout(() => {
      const el = document.getElementById('add-form-anchor');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    this.cd.markForCheck();
  }

  cancelAdd(): void {
    this.showAddForm = false;
    this.addForPosition = null;
    this.newHeading = '';
    this.newContent = '';
    this.cd.markForCheck();
  }

  submitAdd(): void {
    if (!this.newContent?.trim() || !this.newHeading?.trim()) {
      this.alertDialog.open('Validace', 'Nadpis i obsah musí být vyplněny.', 'warning');
      return;
    }
    if (this.activeTabId === null) return;

    this.saving = true;
    const payload: any = {
      document_type_id: this.activeTabId,
      heading: this.newHeading,
      content: this.newContent,
      position: this.addForPosition ?? (this.data.length + 1),
      lang: this.activeLang,
    };
    this.postData(payload as DocumentSection).subscribe({
      next: () => {
        this.cancelAdd();
        this.saving = false;
        this.invalidateCurrentSections();
        this.refreshData();
        this.alertDialog.open('Úspěch', 'Sekce byla úspěšně přidána.', 'success');
      },
      error: () => {
        this.saving = false;
        this.alertDialog.open('Chyba', 'Nepodařilo se přidat sekci.', 'danger');
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Prompts the user for confirmation before performing a hard delete of a content section.
   * @param item The target record for deletion.
   */
    async confirmDelete(item: DocumentSection): Promise<void> {
    const confirmed = await this.confirmDialog.open(
      this.t('edit-legal.delete_confirm_title'),
      this.t('edit-legal.delete_confirm_message')
        .replace('{heading}', item.heading)
        .replace('{lang}', this.activeLang.toUpperCase())
    );

    if (confirmed) {
      this.deleteData(item.id).subscribe({
        next: () => {
          this.invalidateCurrentSections();
          this.refreshData();
          this.alertDialog.open(this.t('shared.success'), this.t('edit-legal.delete_success'), 'success');
        },
        error: () => {
          this.alertDialog.open(this.t('shared.error'), this.t('edit-legal.delete_error'), 'danger');
        }
      });
    }
  }

  /**
   * @description Název aktuálně vybraného typu dokumentu (dřív natvrdo `activeTab === 1 ? 'GDPR' : ...`).
   */
  get tabLabel(): string {
    return this.documentTypes.find(t => t.id === this.activeTabId)?.title ?? '';
  }

  trackById(_: number, item: DocumentSection): number {
    return item.id;
  }

  trackByTypeId(_: number, item: DocumentTypeItem): number {
    return item.id;
  }
}