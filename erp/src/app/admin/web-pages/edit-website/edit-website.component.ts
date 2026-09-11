/**
 * @file edit-website.component.ts
 * @path src/app/admin/web-pages/edit-website/edit-website.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages internationalization (i18n) settings, translation keys, and language
 * metadata for the public web module.
 *
 * (Earlier refactor-notes for the DataHandler unification and TTL cache are unchanged -
 * see version history, omitted here for brevity.)
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `translationSection`/`t()` doplněny stejným vzorem jako `CoreDashboardComponent`/
 * `UserRequestComponent`. Tahle stránka NEMÁ `*.config.ts` (tlačítka/labely jsou přímo
 * v šabloně, ne v deklarativním poli), takže žádné NG0956 riziko a žádná factory funkce
 * není potřeba - stačí `translations$.subscribe(() => markForCheck())` v konstruktoru
 * (OnPush komponenta) a `t()` volání přímo v šabloně. Jediná výjimka: `alertDialogService.open()`
 * volání v `refreshTranslations()`/`onSubmit()`/`confirmAddLang()`/`confirmDeleteLang()`/
 * `toggleLangActive()`/`uploadJsonToServer()` interpolovala jazykový kód přímo do
 * anglického natvrdo psaného textu (`„${this.currentLang}" saved.`) - nahrazeno `t()` +
 * `.replace('{lang}', ...)` stejným vzorem jako `rowSelectAriaLabel()` v `TableBuilderComponent`.
 *
 * @dependencies
 * - BaseDataComponent: Provides foundational CRUD state management (i18n dědí odsud).
 * - LoadingService: Manages application-wide loading indicators.
 * - DataHandler: Handles multipart/form-data and standard REST requests for language assets.
 * - ResourceCacheService: TTL cache pro languages/translations fetch.
 */

import {
  Component, ChangeDetectionStrategy, ChangeDetectorRef,
  inject, OnInit, OnDestroy
} from '@angular/core';
import { Observable } from 'rxjs';
import * as Core from '../../../shared/imports/core-providers';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { LoadingService } from '../../../core/services/loading.service';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { LangMeta, FlatKey } from './';
const LS_KEY = 'rpsw_languages';

/**
 * @description Serves as the primary controller for language management and key-based
 * translation editing.
 * @usage Provides administrators the interface to add/remove languages, upload/download JSON
 * translation packs, and translate strings.
 * @note Implements a recursive diffing mechanism against a 'CZ' reference language to identify
 * untranslated keys.
 */
@Component({
  selector: 'app-edit-website',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './edit-website.component.html',
  styleUrls: ['./edit-website.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditWebsiteComponent
  extends BaseDataComponent<any>
  implements OnInit, OnDestroy {

  public override loadingService = inject(LoadingService);
  private resourceCache = inject(ResourceCacheService);
  override apiEndpoint = 'save_translations';

  protected override translationSection: string = 'edit-website';

  public override t(key: string): string {
    return this.i18n.getValue(`edit-website.${key}`);
  }

  private readonly MODULE = 'web';
  private readonly LANGUAGES_CACHE_KEY = 'edit-website:languages';
  private readonly LANGUAGES_TTL_MS = 10 * 60 * 1000;
  private readonly TRANSLATIONS_CACHE_PREFIX = 'edit-website:translations:';
  private readonly TRANSLATIONS_TTL_MS = 2 * 60 * 1000;

  languages: LangMeta[] = [];
  currentLang: string = 'cz';

  translations: any = {};
  czTranslations: any = {};
  flattenedKeys: FlatKey[] = [];
  filteredKeys: FlatKey[] = [];
  searchQuery: string = '';

  showAddForm: boolean = false;
  newLangCode: string = '';
  newLangName: string = '';
  newLangActive: boolean = true;
  addFormError: string = '';
  private newLangIconFile: File | null = null;
  newLangIconPreview: string = '';

  showUploadModal: boolean = false;
  uploadLangCode: string = '';
  uploadError: string = '';
  uploadSuccess: string = '';

  langToDelete: LangMeta | null = null;

  /** @returns Count of keys currently marked as missing in the active language. */
  get missingCount(): number { return this.filteredKeys.filter(k => k.missing).length; }
  /** @returns Total number of keys currently filtered. */
  get totalCount(): number   { return this.filteredKeys.length; }
  /** @returns Count of translated keys currently filtered. */
  get filledCount(): number  { return this.filteredKeys.filter(k => !k.missing && k.value?.trim()).length; }

    /**
   * @description Whether the current actor may perform any mutating action on this
   * page (save translations, upload JSON, add/toggle/delete a language). The
   * underlying GET routes (`languages/{module}`, `translations/{module}/{lang}`)
   * are PUBLIC (the public website itself reads them unauthenticated), so there is
   * no separate frontend gate needed for viewing - only for mutating.
   * @refactor-note (2026-09-07) BACKLOG "edit-website/edit-eshop permissions": this
   * page has no config file (buttons are hardcoded in the template), so the
   * permission check lives directly here instead of a `Core.TableButtons`/`Button`
   * `permission` field like other admin pages.
   */
  get canUpdate(): boolean {
    return this.permissionService.hasPermission('web-edit-website-update');
  }
  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
  ) {
    super(dataHandler, cd, genericTableService);

    /**
     * @refactor-note (2026-09-08) Stejný minimalistický vzor jako Core/Web dashboard -
     * žádné pole se nepřestavuje (žádný config.ts, žádný NG0956 riziko), jen se OnPush
     * komponenta donutí přehodnotit šablonu při přepnutí jazyka.
     */
    this.i18n.translations$.subscribe(() => this.cd.markForCheck());
  }

  override ngOnInit(): void {
    this.loadLanguages();
  }

  /**
   * @description Fetches language metadata from the server (přes TTL cache), falling back
   * to local storage if necessary.
   * @param force Bypass cache - voláno po přidání/smazání/toggle jazyka.
   */
  private loadLanguages(force: boolean = false): void {
    if (force) {
      this.resourceCache.invalidate(this.LANGUAGES_CACHE_KEY);
    }

    this.resourceCache.get(
      this.LANGUAGES_CACHE_KEY,
      () => this.dataHandler.get<{ languages: LangMeta[] }>(`languages/${this.MODULE}`),
      this.LANGUAGES_TTL_MS
    )
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.languages = res.languages ?? this.getBuiltInLanguages();
          this.persistMetaToLocalStorage();
          this.afterLanguagesLoaded();
        },
        error: (err) => {
          console.error('Language load error:', err);
          const cached = localStorage.getItem(LS_KEY);
          this.languages = cached ? JSON.parse(cached) : this.getBuiltInLanguages();
          this.afterLanguagesLoaded();
        }
      });
  }

  private getBuiltInLanguages(): LangMeta[] {
    return [
      { code: 'cz', name: 'Čeština', iconUrl: undefined, active: true, isBuiltIn: true }
    ];
  }

  private afterLanguagesLoaded(): void {
    this.loadCzReference(() => {
      this.loadLang(this.currentLang);
    });
  }

  private persistMetaToLocalStorage(): void {
    const stripped = this.languages.map(({ iconUrl, ...rest }) => rest);
    try { localStorage.setItem(LS_KEY, JSON.stringify(stripped)); } catch {}
  }

  /**
   * @description Sjednocené načtení překladů pro daný jazyk, přes TTL cache SDÍLENOU mezi
   * `loadCzReference()` (referenční CZ struktura) a `refreshTranslations()` (aktivní
   * jazyk).
   * @param lang Jazykový kód.
   * @param force Bypass cache.
   */
  private fetchTranslations(lang: string, force: boolean = false): Observable<any> {
    const key = `${this.TRANSLATIONS_CACHE_PREFIX}${lang}`;
    if (force) {
      this.resourceCache.invalidate(key);
    }
    return this.resourceCache.get(
      key,
      () => this.dataHandler.get<any>(`translations/${this.MODULE}/${lang}`),
      this.TRANSLATIONS_TTL_MS
    );
  }

  /**
   * @description Loads CZ as the master reference structure to identify missing keys in other
   * languages.
   * @param callback Optional hook to trigger once the reference data is fetched.
   */
  private loadCzReference(callback?: () => void): void {
    this.fetchTranslations('cz')
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.czTranslations = data;
          callback?.();
        },
        error: () => {
          this.czTranslations = {};
          callback?.();
        }
      });
  }

  /**
   * @description Switches active context to a specific language code.
   * @param lang The ISO code of the language to load.
   */
  loadLang(lang: string): void {
    if (this.currentLang === lang && Object.keys(this.translations).length > 0) return;
    this.currentLang = lang;
    this.refreshTranslations();
  }

  /**
   * @refactor-note (2026-09-08) Info hláška 'Translations for „X" do not exist yet...'
   * nahrazena `t()` voláním s `.replace('{lang}', ...)`.
   */
  public refreshTranslations(): void {
    this.errorMessage = null;
    this.cd.markForCheck();

    this.fetchTranslations(this.currentLang)
      .pipe(
        Core.takeUntil(this.destroy$),
        Core.finalize(() => {
          this.cd.markForCheck();
          setTimeout(() => this.resizeAllTextareas(), 50);
        })
      )
      .subscribe({
        next: (data) => {
          this.translations = data;
          this.buildFlatList();
          this.applyFilter();
        },
        error: () => {
          this.translations = this.buildEmptyFromCz(this.czTranslations);
          this.buildFlatList();
          this.applyFilter();
          this.alertDialogService.open(
            this.t('info_title'),
            this.t('translations_not_found_message').replace('{lang}', this.currentLang),
            'info'
          );
        }
      });
  }

  /**
   * @description Compares current language structure against the CZ master reference to identify
   * missing content.
   */
private buildFlatList(): void {
    this.flattenedKeys = [];
    const czFlat  = this.flattenToMap(this.czTranslations);
    const curFlat = this.flattenToMap(this.translations);

    for (const [path] of czFlat.entries()) {
      const rawVal = curFlat.get(path) ?? '';
      const curVal = typeof rawVal === 'string' ? rawVal : String(rawVal); // <-- Bezpečná ochrana
      
      this.flattenedKeys.push({
        path,
        value: curVal,
        missing: curVal.trim() === ''
      });
    }

    for (const [path, val] of curFlat.entries()) {
      if (!czFlat.has(path)) {
        const safeVal = typeof val === 'string' ? val : String(val);
        this.flattenedKeys.push({ path, value: safeVal, missing: false });
      }
    }
  }

  private flattenToMap(obj: any, path: string = '', map = new Map<string, string>()): Map<string, string> {
    for (const key in obj) {
      const newPath = path ? `${path}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.flattenToMap(obj[key], newPath, map);
      } else {
        map.set(newPath, obj[key] ?? '');
      }
    }
    return map;
  }

  private buildEmptyFromCz(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return '';
    const result: any = {};
    for (const key in obj) {
      result[key] = this.buildEmptyFromCz(obj[key]);
    }
    return result;
  }

  applyFilter(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredKeys = q
      ? this.flattenedKeys.filter(k =>
          k.path.toLowerCase().includes(q) ||
          String(k.value || '').toLowerCase().includes(q)
        )
      : [...this.flattenedKeys];
    this.cd.markForCheck();
  }

  filterMissing(): void {
    this.searchQuery = '';
    this.filteredKeys = this.flattenedKeys.filter(k => k.missing);
    this.cd.markForCheck();
  }

  resetFilter(): void {
    this.searchQuery = '';
    this.applyFilter();
    setTimeout(() => this.resizeAllTextareas(), 10);
  }

updateValue(path: string, newValue: string): void {
    const keys = path.split('.');
    let temp = this.translations;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!temp[keys[i]]) temp[keys[i]] = {};
      temp = temp[keys[i]];
    }
    temp[keys[keys.length - 1]] = newValue;

    const item = this.flattenedKeys.find(k => k.path === path);
    if (item) {
      item.value   = newValue;
      item.missing = (typeof newValue === 'string' ? newValue : String(newValue)).trim() === '';
    }
  }

  adjustHeight(event: any): void {
    const el = event.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

 /**
 * @description Batch-resizuje všechny textarea prvky bez layout thrashingu. Původní
 * verze prokládala čtení (scrollHeight) a zápis (style.height) v jedné smyčce pro
 * KAŽDÝ element zvlášť - to nutí prohlížeč přepočítat layout znovu při každé iteraci
 * (classic "layout thrashing"), což je skutečná příčina ~1s zamrznutí při vstupu na
 * stránku s velkým počtem překladových klíčů. Řešení: tři oddělené průchody (reset ->
 * hromadné čtení -> hromadný zápis) vynutí reflow jen jednou pro celou dávku místo
 * jednou na element. NENÍ to problém s cachí ani s ukládáním - tahle metoda běží čistě
 * na klientovi po tom, co data už dorazila (ze sítě nebo z cache), stejně zamrzne
 * v obou případech.
 */
private resizeAllTextareas(): void {
  const elements = Array.from(document.querySelectorAll<HTMLTextAreaElement>('.ew-edit-input'));
  if (elements.length === 0) return;

  // Průchod 1: reset (write)
  elements.forEach(el => { el.style.height = 'auto'; });
  // Průchod 2: čtení (jeden vynucený reflow pro celou dávku)
  const heights = elements.map(el => el.scrollHeight);
  // Průchod 3: zápis (write)
  elements.forEach((el, i) => { el.style.height = `${heights[i]}px`; });
}

  /**
   * @description Uloží aktuálně editovaný jazyk. Po úspěchu invaliduje cache klíč tohoto
   * jazyka.
   * @refactor-note (2026-09-08) 'Translations for „X" saved.' nahrazeno `t()` voláním.
   */
  onSubmit(): void {
    this.dataHandler.post(`save_translations/${this.MODULE}`, {
      lang: this.currentLang,
      data: this.translations
    }).pipe(Core.takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.resourceCache.invalidate(`${this.TRANSLATIONS_CACHE_PREFIX}${this.currentLang}`);
        this.alertDialogService.open(
          this.t('admin_title'),
          this.t('translations_saved_message').replace('{lang}', this.currentLang),
          'success'
        );
        this.buildFlatList();
        this.applyFilter();
        this.cd.markForCheck();
      },
      error: () => {
        this.alertDialogService.open(this.i18n.getValue('shared.error'), this.t('save_failed_message'), 'danger');
      }
    });
  }

  openAddForm(): void {
    this.showAddForm     = true;
    this.newLangCode     = '';
    this.newLangName     = '';
    this.newLangActive   = true;
    this.newLangIconFile = null;
    this.newLangIconPreview = '';
    this.addFormError    = '';
    this.cd.markForCheck();
  }

  closeAddForm(): void {
    this.showAddForm = false;
    this.cd.markForCheck();
  }

  /**
   * @description Processes user-selected flag file, creates a local preview, and validates file
   * size.
   * @refactor-note (2026-09-08) 'Icon exceeds size limit (512 KB).' nahrazeno `t()` voláním.
   */
  onIconFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    if (file.size > 512 * 1024) {
      this.addFormError = this.t('icon_size_error');
      this.cd.markForCheck();
      return;
    }

    this.newLangIconFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.newLangIconPreview = reader.result as string;
      this.addFormError = '';
      this.cd.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  clearIconSelection(): void {
    this.newLangIconFile    = null;
    this.newLangIconPreview = '';
    this.cd.markForCheck();
  }

  /**
   * @description Submits a new language definition using multipart/form-data to include flag
   * imagery. Po úspěchu invaliduje cache jazykového seznamu.
   * @refactor-note (2026-09-08) Všechny validační/úspěšné hlášky nahrazeny `t()` voláním.
   */
  confirmAddLang(): void {
    const code = this.newLangCode.trim().toLowerCase();
    const name = this.newLangName.trim();

    if (!code || !name) {
      this.addFormError = this.t('code_and_name_required_error');
      this.cd.markForCheck();
      return;
    }
    if (!/^[a-z]{2,5}$/.test(code)) {
      this.addFormError = this.t('code_format_error');
      this.cd.markForCheck();
      return;
    }
    if (this.languages.some(l => l.code === code)) {
      this.addFormError = this.t('code_already_exists_error').replace('{code}', code);
      this.cd.markForCheck();
      return;
    }

    const newLang: LangMeta = {
      code,
      name,
      active:    this.newLangActive,
      isBuiltIn: false
    };

    const fd = new FormData();
    fd.append('languages', JSON.stringify([...this.languages, newLang]));
    fd.append('module', this.MODULE);

    if (this.newLangIconFile) {
      fd.append('icon',        this.newLangIconFile);
      fd.append('target_code', code);
    }

    this.dataHandler.upload<{ status: string }>(`languages/${this.MODULE}`, fd)
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showAddForm = false;
          this.cd.markForCheck();
          this.loadLanguages(true);

          this.currentLang = code;
          this.translations = this.buildEmptyFromCz(this.czTranslations);
          this.buildFlatList();
          this.applyFilter();

          this.alertDialogService.open(
            this.i18n.getValue('shared.success'),
            this.t('language_created_message').replace('{code}', code),
            'success'
          );
        },
        error: () => {
          this.addFormError = this.t('language_save_failed_error');
          this.cd.markForCheck();
        }
      });
  }

  askDeleteLang(lang: LangMeta): void {
    this.langToDelete = lang;
    this.cd.markForCheck();
  }

  cancelDelete(): void {
    this.langToDelete = null;
    this.cd.markForCheck();
  }

  /**
   * @description Smaže jazyk. Po úspěchu invaliduje cache seznamu jazyků i překladů
   * smazaného jazyka.
   * @refactor-note (2026-09-08) Fallback chybová hláška ('Failed to delete language.')
   * nahrazena `t()` voláním - server-provided `err.error.message` má přednost beze
   * změny (mimo scope frontendové i18n vrstvy).
   */
  confirmDeleteLang(): void {
    if (!this.langToDelete) return;
    const code = this.langToDelete.code;

    this.dataHandler.delete(`languages/${this.MODULE}/${code}`)
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.langToDelete = null;
          this.resourceCache.invalidate(`${this.TRANSLATIONS_CACHE_PREFIX}${code}`);

          if (this.currentLang === code) {
            this.currentLang  = 'cz';
            this.translations = {};
          }

          this.loadLanguages(true);
          this.cd.markForCheck();
        },
        error: (err) => {
          this.langToDelete = null;
          const msg = err?.error?.message ?? this.t('delete_language_failed_error');
          this.alertDialogService.open(this.i18n.getValue('shared.error'), msg, 'danger');
          this.cd.markForCheck();
        }
      });
  }

  /**
   * @description Toggles language activation state by posting the full updated language metadata
   * list to the server. Po úspěchu invaliduje cache seznamu jazyků - lokální mutace
   * `lang.active` je optimistická, ale cache by jinak mohla po vypršení TTL vrátit
   * dřívější (neplatnou) hodnotu.
   * @refactor-note (2026-09-08) 'Change could not be saved.' nahrazeno `t()` voláním.
   */
  toggleLangActive(lang: LangMeta): void {
    lang.active = !lang.active;
    this.cd.markForCheck();

    const fd = new FormData();
    fd.append('languages', JSON.stringify(this.languages));
    fd.append('module', this.MODULE);

    this.dataHandler.upload<{ status: string }>(`languages/${this.MODULE}`, fd)
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.resourceCache.invalidate(this.LANGUAGES_CACHE_KEY);
        },
        error: () => {
          lang.active = !lang.active;
          this.alertDialogService.open(this.i18n.getValue('shared.error'), this.t('toggle_failed_error'), 'danger');
          this.cd.markForCheck();
        }
      });
  }

  openUploadModal(lang: string): void {
    this.uploadLangCode = lang;
    this.uploadError    = '';
    this.uploadSuccess  = '';
    this.showUploadModal = true;
    this.cd.markForCheck();
  }

  closeUploadModal(): void {
    this.showUploadModal = false;
    this.cd.markForCheck();
  }

  onJsonFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        this.uploadJsonToServer(parsed);
      } catch {
        this.uploadError   = this.t('invalid_json_error');
        this.uploadSuccess = '';
        this.cd.markForCheck();
      }
    };
    reader.readAsText(file);
  }

  /**
   * @description Nahraje JSON pro daný jazyk. Po úspěchu invaliduje cache klíč tohoto
   * jazyka, ať se při případném refreshi aktivního jazyka nezobrazí stará (pre-upload)
   * data.
   * @refactor-note (2026-09-08) Úspěšná/chybová hláška nahrazena `t()` voláním.
   */
  private uploadJsonToServer(data: any): void {
    this.dataHandler.post(`save_translations/${this.MODULE}`, {
      lang: this.uploadLangCode,
      data
    }).pipe(Core.takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.resourceCache.invalidate(`${this.TRANSLATIONS_CACHE_PREFIX}${this.uploadLangCode}`);
        this.uploadSuccess = this.t('json_uploaded_message').replace('{lang}', this.uploadLangCode);
        this.uploadError   = '';

        if (this.uploadLangCode === this.currentLang) {
          this.translations = {};
          this.refreshTranslations();
        }

        this.cd.markForCheck();
      },
      error: () => {
        this.uploadError   = this.t('upload_failed_error');
        this.uploadSuccess = '';
        this.cd.markForCheck();
      }
    });
  }

  downloadJson(): void {
    const blob = new Blob(
      [JSON.stringify(this.translations, null, 2)],
      { type: 'application/json' }
    );
    const a  = document.createElement('a');
    a.href   = URL.createObjectURL(blob);
    a.download = `${this.currentLang}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  trackByPath(_: number, item: FlatKey): string  { return item.path; }
  trackByCode(_: number, lang: LangMeta): string { return lang.code; }

  getCurrentLangMeta(): LangMeta | undefined {
    return this.languages.find(l => l.code === this.currentLang);
  }
}