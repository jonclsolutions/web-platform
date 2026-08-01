/**
 * @file edit-eshop.component.ts
 * @path src/app/admin/shop-pages/edit-eshop/edit-eshop.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages internationalization (i18n) settings, translation keys, and language
 * metadata for the shop module.
 *
 * @refactor-note (2025) Tři metody (`confirmAddLang`, `confirmDeleteLang`, `toggleLangActive`)
 * dřív injektovaly vlastní `HttpClient` a volaly ho s ručně napsaným `/api/languages/{module}`
 * prefixem — zatímco zbytek souboru (`loadLanguages`, `loadCzReference`, `onSubmit`…) už
 * používal jednotně `this.dataHandler` (z `BaseDataComponent`). Sjednoceno: `dataHandler.upload()`
 * pro multipart POST a `dataHandler.delete()` pro DELETE, se stejnou konvencí endpointů jako
 * zbytek aplikace (bez `/api` prefixu — ten už řeší `DataHandler.baseUrl`). `HttpClient` už
 * komponenta vůbec nepotřebuje.
 *
 * @dependencies
 * - BaseDataComponent: Provides foundational CRUD state management.
 * - LoadingService: Manages application-wide loading indicators.
 * - DataHandler: Handles multipart/form-data and standard REST requests for language assets.
 */

import {
  Component, ChangeDetectionStrategy, ChangeDetectorRef,
  inject, OnInit, OnDestroy
} from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { LoadingService } from '../../../core/services/loading.service';
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
  override apiEndpoint = 'save_translations';

  private readonly MODULE = 'web';

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

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
  ) {
    super(dataHandler, cd, genericTableService);
  }

  override ngOnInit(): void {
    this.loadLanguages();
  }

  /**
   * @description Fetches language metadata from the server, falling back to local storage if
   * necessary.
   */
  private loadLanguages(): void {
    this.dataHandler.get<{ languages: LangMeta[] }>(`languages/${this.MODULE}`)
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
   * @description Loads CZ as the master reference structure to identify missing keys in other
   * languages.
   * @param callback Optional hook to trigger once the reference data is fetched.
   */
  private loadCzReference(callback?: () => void): void {
    this.dataHandler.get<any>(`translations/${this.MODULE}/cz`)
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

  public refreshTranslations(): void {
    this.errorMessage = null;
    this.cd.markForCheck();

    this.dataHandler.get<any>(`translations/${this.MODULE}/${this.currentLang}`)
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
            'Info',
            `Translations for „${this.currentLang}" do not exist yet. Defaulting to empty keys.`,
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

  private resizeAllTextareas(): void {
    document.querySelectorAll<HTMLTextAreaElement>('.ew-edit-input').forEach(ta => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });
  }

  onSubmit(): void {
    this.dataHandler.post(`save_translations/${this.MODULE}`, {
      lang: this.currentLang,
      data: this.translations
    }).pipe(Core.takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.alertDialogService.open(
          'Admin',
          `Translations for „${this.currentLang}" saved.`,
          'success'
        );
        this.buildFlatList();
        this.applyFilter();
        this.cd.markForCheck();
      },
      error: () => {
        this.alertDialogService.open('Error', 'Save failed.', 'danger');
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
      this.addFormError = 'Icon exceeds size limit (512 KB).';
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
   * imagery.
   */
  confirmAddLang(): void {
    const code = this.newLangCode.trim().toLowerCase();
    const name = this.newLangName.trim();

    if (!code || !name) {
      this.addFormError = 'Code and name are required.';
      this.cd.markForCheck();
      return;
    }
    if (!/^[a-z]{2,5}$/.test(code)) {
      this.addFormError = 'Code must be 2–5 lowercase letters.';
      this.cd.markForCheck();
      return;
    }
    if (this.languages.some(l => l.code === code)) {
      this.addFormError = `Language code „${code}" already exists.`;
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
          this.loadLanguages();

          this.currentLang = code;
          this.translations = this.buildEmptyFromCz(this.czTranslations);
          this.buildFlatList();
          this.applyFilter();

          this.alertDialogService.open(
            'Success',
            `Language „${code}" created.`,
            'success'
          );
        },
        error: () => {
          this.addFormError = 'Failed to save language to server.';
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

  confirmDeleteLang(): void {
    if (!this.langToDelete) return;
    const code = this.langToDelete.code;

    this.dataHandler.delete(`languages/${this.MODULE}/${code}`)
      .pipe(Core.takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.langToDelete = null;

          if (this.currentLang === code) {
            this.currentLang  = 'cz';
            this.translations = {};
          }

          this.loadLanguages();
          this.cd.markForCheck();
        },
        error: (err) => {
          this.langToDelete = null;
          const msg = err?.error?.message ?? 'Failed to delete language.';
          this.alertDialogService.open('Error', msg, 'danger');
          this.cd.markForCheck();
        }
      });
  }

  /**
   * @description Toggles language activation state by posting the full updated language metadata
   * list to the server.
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
        error: () => {
          lang.active = !lang.active;
          this.alertDialogService.open('Error', 'Change could not be saved.', 'danger');
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
        this.uploadError   = 'Invalid JSON file.';
        this.uploadSuccess = '';
        this.cd.markForCheck();
      }
    };
    reader.readAsText(file);
  }

  private uploadJsonToServer(data: any): void {
    this.dataHandler.post(`save_translations/${this.MODULE}`, {
      lang: this.uploadLangCode,
      data
    }).pipe(Core.takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.uploadSuccess = `JSON for „${this.uploadLangCode}" successfully uploaded.`;
        this.uploadError   = '';

        if (this.uploadLangCode === this.currentLang) {
          this.translations = {};
          this.refreshTranslations();
        }

        this.cd.markForCheck();
      },
      error: () => {
        this.uploadError   = 'Upload failed. Check server connectivity.';
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