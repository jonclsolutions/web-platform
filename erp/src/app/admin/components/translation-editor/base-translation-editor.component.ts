/**
 * @file base-translation-editor.component.ts
 * @path src/app/admin/components/translation-editor/base-translation-editor.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared logic of the admin translation editors: language list (add / toggle /
 * delete, flag upload), loading and editing translation keys against the CZ reference,
 * JSON upload/download and saving, the page tabs (texts, page titles, extra tabs of the
 * application). One page per module extends it; TranslationEditorViewComponent renders it.
 * @note i18n: `t()` = the key of the `translationSection` of the page when it has one (page
 * title, extra tabs, page names `pt_page_*`), otherwise the shared text of the section
 * `translation-editor`; messages with a language code use `.replace('{lang}', ...)`. The OnPush component is re-evaluated after a
 * language switch by `translations$.subscribe(() => markForCheck())` in the constructor.
 * @note `isDirty` (unsaved changes) - set by `updateValue()`, reset after saving, after a
 * (re)load of the translations, after adding and after deleting the current language. Drives
 * the "Save changes" button of the template.
 * @note `canUpdate`: the GET routes (`languages/{module}`, `translations/{module}/{lang}`) are
 * public (read by the public web), so only the mutating actions are guarded.
 *
 * @dependencies
 * - BaseDataComponent: CRUD state, i18n, alert dialog, permission service.
 * - DataHandler: multipart/form-data and REST requests for language assets.
 * - ResourceCacheService: TTL cache for the languages / translations fetch.
 */

import { ChangeDetectorRef, Directive, inject, OnInit, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import * as Core from '../../../shared/imports/core-providers';
import { BaseDataComponent } from '../base-data/base-data.component';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { migrateLegacyKey } from '../../../shared/utils/legacy-storage';
import { AdminIconName } from '../admin-icon/admin-icon.component';

/** @description Translation section of the texts shared by every translation editor. */
export const TRANSLATION_EDITOR_SECTION = 'translation-editor';

/** @description One page tab of the editor. */
export interface TranslationEditorTab {
  /** Key of the tab ('translations', 'page_titles' or the key of an extra tab). */
  key: string;
  /** Key of its label (page section first, then `translation-editor`). */
  labelKey: string;
  icon: AdminIconName;
}

/** @description Tabs of every editor: the texts and the browser page titles of the module. */
const BUILT_IN_TABS: TranslationEditorTab[] = [
  { key: 'translations', labelKey: 'tab_translations', icon: 'languages' },
  { key: 'page_titles', labelKey: 'tab_page_titles', icon: 'window' },
];

/**
 * @description Language metadata as returned by `languages/{module}`.
 */
export interface LangMeta {
  code: string;
  name: string;
  iconUrl?: string;
  active: boolean;
  isBuiltIn?: boolean;
}

/**
 * @description One flattened translation key (dot path) shown in the editor.
 */
export interface FlatKey {
  path: string;
  value: string;
  missing: boolean;
}

/** localStorage fallback for the language list (same key for every module, as before). */
const LS_KEY = 'jsw_languages';
/** Former key of the cached language list - moved to LS_KEY before the first read. */
const LEGACY_LS_KEY = 'rpsw_languages';

/**
 * @description Abstract base of the translation editor pages (EditWebsiteComponent,
 * EditEshopComponent).
 * @usage `export class EditXComponent extends BaseTranslationEditorComponent` + set the
 * abstract members and `translationSection`; template `<app-translation-editor-view [e]="this">`
 * with the panels of `extraTabs` as its content.
 * @note Implements a recursive diffing mechanism against a 'CZ' reference language to identify
 * untranslated keys.
 */
@Directive()
export abstract class BaseTranslationEditorComponent
  extends BaseDataComponent<any>
  implements OnInit, OnDestroy {

  /** Backend module whose languages/translations are edited (the id of the application). */
  protected abstract readonly MODULE: string;
  /** ResourceCache key of the language list of this module. */
  protected abstract readonly LANGUAGES_CACHE_KEY: string;
  /** ResourceCache key prefix of the translations of this module (+ language code). */
  protected abstract readonly TRANSLATIONS_CACHE_PREFIX: string;
  /** Permission required for any mutating action on the page. */
  protected abstract readonly UPDATE_PERMISSION: string;

  private resourceCache = inject(ResourceCacheService);
  override apiEndpoint = 'save_translations';

  /** Extra page tabs of the application (after the texts and the page titles). */
  readonly extraTabs: TranslationEditorTab[] = [];
  /** Active page tab. */
  activeTab = 'translations';
  /** Tabs opened at least once - their panel stays created (hidden) from then on. */
  private readonly openedTabs = new Set<string>(['translations']);
  /** Unsaved edits of the tabs other than the texts (dot on the tab). */
  private readonly dirtyTabs = new Set<string>();

  /**
   * @description Text of the page: its own key when the page section has one, otherwise the
   *   shared text of `translation-editor`.
   * @param key Key without the section prefix.
   */
  public override t(key: string): string {
    const own = this.i18n.getMergedSection(this.translationSection)?.[key];
    return typeof own === 'string' ? own : this.i18n.getValue(`${TRANSLATION_EDITOR_SECTION}.${key}`);
  }

  /** @description Module of the editor (application id) - area of its page titles. */
  get module(): string {
    return this.MODULE;
  }

  /** @description Permission of every change on the page. */
  get updatePermission(): string {
    return this.UPDATE_PERMISSION;
  }

  /** @description Translation section of the page (page names of the page titles editor). */
  get section(): string {
    return this.translationSection;
  }

  /** @description Every tab of the page in order. */
  get tabs(): TranslationEditorTab[] {
    return [...BUILT_IN_TABS, ...this.extraTabs];
  }

  /**
   * @description Switches the page tab; the panel of a tab is created on its first open and
   *   stays created, so unsaved edits survive a tab switch.
   * @param tab Key of the tab.
   */
  switchTab(tab: string): void {
    this.activeTab = tab;
    this.openedTabs.add(tab);
    this.cd.markForCheck();
  }

  /**
   * @description Whether the panel of a tab was opened (and is therefore created).
   * @param tab Key of the tab.
   */
  isTabOpened(tab: string): boolean {
    return this.openedTabs.has(tab);
  }

  /**
   * @description Whether a tab has unsaved edits (the texts: `isDirty`).
   * @param tab Key of the tab.
   */
  isTabDirty(tab: string): boolean {
    return tab === 'translations' ? this.isDirty : this.dirtyTabs.has(tab);
  }

  /**
   * @description Marks the unsaved edits of a tab (event `dirtyChange` of its editor).
   * @param tab Key of the tab.
   * @param dirty Whether it has unsaved edits.
   */
  setTabDirty(tab: string, dirty: boolean): void {
    if (dirty) this.dirtyTabs.add(tab); else this.dirtyTabs.delete(tab);
    this.cd.markForCheck();
  }

  private readonly LANGUAGES_TTL_MS = 10 * 60 * 1000;
  private readonly TRANSLATIONS_TTL_MS = 2 * 60 * 1000;

  languages: LangMeta[] = [];
  currentLang: string = 'cz';

  translations: any = {};
  czTranslations: any = {};
  flattenedKeys: FlatKey[] = [];
  filteredKeys: FlatKey[] = [];
  searchQuery: string = '';

  /** Unsaved changes of the currently edited language (drives the state of the "Save changes" button). */
  isDirty: boolean = false;

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
   * page (save translations, upload JSON, add/toggle/delete a language). Viewing needs
   * no frontend gate - see the file header.
   */
  get canUpdate(): boolean {
    return this.permissionService.hasPermission(this.UPDATE_PERMISSION);
  }

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
  ) {
    super(dataHandler, cd, genericTableService);
    this.i18n.translations$.pipe(Core.takeUntil(this.destroy$)).subscribe(() => this.cd.markForCheck());
  }

  override ngOnInit(): void {
    this.loadLanguages();
  }

  /**
   * @description Fetches language metadata from the server (through the TTL cache), falling back
   * to local storage if necessary.
   * @param force Bypass cache - called after adding / deleting / toggling a language.
   */
  private loadLanguages(force: boolean = false): void {
    if (force) {
      this.resourceCache.invalidate(this.LANGUAGES_CACHE_KEY);
    }

    this.resourceCache.get(
      this.LANGUAGES_CACHE_KEY,
      () => this.dataHandler.get<LangMeta[]>(`languages/${this.MODULE}`),
      this.LANGUAGES_TTL_MS
    )
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.languages = Array.isArray(res) ? res : this.getBuiltInLanguages();  // payload = the list (finding #6)
          this.persistMetaToLocalStorage();
          this.afterLanguagesLoaded();
        },
        error: (err) => {
          console.error('Language load error:', err);
          migrateLegacyKey(localStorage, LS_KEY, LEGACY_LS_KEY);
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
    try { localStorage.setItem(LS_KEY, JSON.stringify(stripped)); localStorage.removeItem(LEGACY_LS_KEY); } catch {}
  }

  /**
   * @description Unified load of the translations of a language through the TTL cache SHARED by
   * `loadCzReference()` (CZ reference structure) and `refreshTranslations()` (active language).
   * @param lang Language code.
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
          this.czTranslations = structuredClone(data ?? {});
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

  public refreshTranslations(): void {
    this.isDirty = false;
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
          // a private copy - the cached response must stay untouched
          this.translations = structuredClone(data ?? {});
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
      const curVal = typeof rawVal === 'string' ? rawVal : String(rawVal);

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

  /**
   * @description Writes the new value of the key into `translations` (nested structure) and the
   * flat list and marks the page as unsaved.
   * @param path Dot path of the key (e.g. `hero.heading`).
   * @param newValue New translation value.
   */
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

    this.isDirty = true;
    this.cd.markForCheck();
  }

  adjustHeight(event: any): void {
    const el = event.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  /**
   * @description Batch-resizes all textarea elements without layout thrashing: three separate
   * passes (reset -> bulk read -> bulk write) force one reflow for the whole batch instead of
   * one per element (interleaving the scrollHeight read and the style.height write per element
   * caused a ~1 s freeze on pages with many translation keys). Runs purely on the client after
   * the data arrived (network or cache).
   */
  private resizeAllTextareas(): void {
    const elements = Array.from(document.querySelectorAll<HTMLTextAreaElement>('.ew-edit-input'));
    if (elements.length === 0) return;

    // Pass 1: reset (write)
    elements.forEach(el => { el.style.height = 'auto'; });
    // Pass 2: read (one forced reflow for the whole batch)
    const heights = elements.map(el => el.scrollHeight);
    // Pass 3: write
    elements.forEach((el, i) => { el.style.height = `${heights[i]}px`; });
  }

  /**
   * @description Saves the currently edited language. Invalidates the cache key of the language on
   * success.
   */
  onSubmit(): void {
    if (!this.canUpdate) return;

    this.dataHandler.post(`save_translations/${this.MODULE}`, {
      lang: this.currentLang,
      data: this.translations
    }).pipe(Core.takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isDirty = false;
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
   * imagery. Invalidates the cache of the language list on success.
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

    this.dataHandler.upload<null>(`languages/${this.MODULE}`, fd)  // 204 since finding #6
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showAddForm = false;
          this.cd.markForCheck();
          this.loadLanguages(true);

          this.currentLang = code;
          this.translations = this.buildEmptyFromCz(this.czTranslations);
          this.isDirty = false;
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
   * @description Deletes a language. Invalidates the cache of the language list and of the
   * translations of the deleted language on success.
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
            this.isDirty      = false;
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
   * list to the server. Invalidates the cache of the language list on success - the local
   * mutation of `lang.active` is optimistic, but the cache could return the earlier (invalid)
   * value after the TTL otherwise.
   */
  toggleLangActive(lang: LangMeta): void {
    lang.active = !lang.active;
    this.cd.markForCheck();

    const fd = new FormData();
    fd.append('languages', JSON.stringify(this.languages));
    fd.append('module', this.MODULE);

    this.dataHandler.upload<null>(`languages/${this.MODULE}`, fd)  // 204 since finding #6
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
   * @description Uploads the JSON of a language. Invalidates the cache key of the language on
   * success, so a refresh of the active language never shows the old (pre-upload) data.
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
