/**
 * @file edit-website.component.ts
 * @path src/app/admin/web-pages/edit-website/edit-website.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Manages web localization, translation files, and language metadata administration.
 * @dependencies
 * - Angular Core/Common/Forms/Router: Standard framework utilities.
 * - BaseDataComponent: Inheritance for base CRUD and state handling.
 * - HttpClient: Used for multipart/form-data operations (icons/files).
 * - LoadingService: Global UI loading state management.
 */

import {
  Component, ChangeDetectionStrategy, ChangeDetectorRef,
  inject, OnInit, OnDestroy
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as Core from '../../../shared/imports/core-providers';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { LoadingService } from '../../../core/services/loading.service';
import { LangMeta, FlatKey } from './';

const LS_KEY = 'rpsw_languages';

/**
 * @description Main controller for managing website localization (translations) and language settings.
 * @usage Enables CRUD operations for languages, provides an inline editor for translation keys, and supports JSON-based bulk updates.
 * @note Implements differential translation checking against the 'cz' locale to identify missing keys.
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

  get missingCount(): number { return this.filteredKeys.filter(k => k.missing).length; }
  get totalCount(): number   { return this.filteredKeys.length; }
  get filledCount(): number  { return this.filteredKeys.filter(k => !k.missing && k.value?.trim()).length; }

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private http: HttpClient,
  ) {
    super(dataHandler, cd, genericTableService);
  }

  override ngOnInit(): void {
    this.loadLanguages();
  }

  /**
   * @description Fetches all available languages for the current module from the API.
   * Falls back to local storage if the server request fails.
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
          console.error('Chyba při načítání jazyků:', err);
          const cached = localStorage.getItem(LS_KEY);
          this.languages = cached ? JSON.parse(cached) : this.getBuiltInLanguages();
          this.afterLanguagesLoaded();
        }
      });
  }

  /**
   * @description Provides the hardcoded fallback languages in case the API is offline.
   * @returns An array of default LangMeta objects.
   */
  private getBuiltInLanguages(): LangMeta[] {
    return [
      { code: 'cz', name: 'Čeština', iconUrl: undefined, active: true, isBuiltIn: true },
      { code: 'en', name: 'English',  iconUrl: undefined, active: true, isBuiltIn: false },
    ];
  }

  /**
   * @description Chains initialization logic once language definitions are ready.
   */
  private afterLanguagesLoaded(): void {
    this.loadCzReference(() => {
      this.loadLang(this.currentLang);
    });
  }

  /**
   * @description Caches basic language information to localStorage to allow for quick offline access.
   */
  private persistMetaToLocalStorage(): void {
    const stripped = this.languages.map(({ iconUrl, ...rest }) => rest);
    try { localStorage.setItem(LS_KEY, JSON.stringify(stripped)); } catch {}
  }

  /**
   * @description Fetches the 'cz' (master) translation file to serve as a structure reference for diffing.
   * @param callback Optional trigger to continue loading after reference data is cached.
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
   * @description Sets the active language code and triggers the translation fetcher.
   * @param lang The language ISO code to select.
   */
  loadLang(lang: string): void {
    if (this.currentLang === lang && Object.keys(this.translations).length > 0) return;
    this.currentLang = lang;
    this.refreshTranslations();
  }

  /**
   * @description Communicates with the server to reload translations for the currently active locale.
   */
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
            `Překlady pro jazyk „${this.currentLang}" zatím neexistují. Zobrazeny prázdné klíče ke překladu.`,
            'info'
          );
        }
      });
  }

  /**
   * @description Flattens the hierarchical translation JSON into a list for easy filtering and UI representation.
   */
  private buildFlatList(): void {
    this.flattenedKeys = [];
    const czFlat  = this.flattenToMap(this.czTranslations);
    const curFlat = this.flattenToMap(this.translations);

    for (const [path] of czFlat.entries()) {
      const curVal = curFlat.get(path) ?? '';
      this.flattenedKeys.push({
        path,
        value: curVal,
        missing: curVal.trim() === ''
      });
    }

    for (const [path, val] of curFlat.entries()) {
      if (!czFlat.has(path)) {
        this.flattenedKeys.push({ path, value: val, missing: false });
      }
    }
  }

  /**
   * @description Recursively maps nested object keys to dot-notation strings.
   * @param obj The object tree to flatten.
   * @param path The current path accumulator.
   * @param map The map to collect results.
   * @returns A Map containing dot-notation paths as keys and values as strings.
   */
  private flattenToMap(
    obj: any,
    path: string = '',
    map = new Map<string, string>()
  ): Map<string, string> {
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

  /**
   * @description Creates a deep-copied template of the CZ translation structure with empty strings.
   * @param obj Reference structure.
   * @returns A structure containing the same keys but blank values.
   */
  private buildEmptyFromCz(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return '';
    const result: any = {};
    for (const key in obj) {
      result[key] = this.buildEmptyFromCz(obj[key]);
    }
    return result;
  }

  /**
   * @description Updates the view list based on the search query input.
   */
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

  /**
   * @description Narrows the view to show only keys that currently have no translation.
   */
  filterMissing(): void {
    this.searchQuery = '';
    this.filteredKeys = this.flattenedKeys.filter(k => k.missing);
    this.cd.markForCheck();
  }

  /**
   * @description Resets current search and filtering criteria.
   */
  resetFilter(): void {
    this.searchQuery = '';
    this.applyFilter();
    setTimeout(() => this.resizeAllTextareas(), 10);
  }

  /**
   * @description Updates a translation value inside the nested object structure using dot-notation.
   * @param path The key path (e.g., "header.title").
   * @param newValue The text content to set.
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
      item.missing = newValue.trim() === '';
    }
  }

  /**
   * @description Handles dynamic resizing of textarea inputs based on content.
   */
  adjustHeight(event: any): void {
    const el = event.target;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  /**
   * @description Forces all translation textareas to match their content height.
   */
  private resizeAllTextareas(): void {
    document.querySelectorAll<HTMLTextAreaElement>('.ew-edit-input').forEach(ta => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });
  }

  /**
   * @description POSTs the currently edited translation tree to the server.
   */
  onSubmit(): void {
    this.dataHandler.post(`save_translations/${this.MODULE}`, {
      lang: this.currentLang,
      data: this.translations
    }).pipe(Core.takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.alertDialogService.open(
          'Administrace',
          `Překlady pro „${this.currentLang}" byly úspěšně uloženy.`,
          'success'
        );
        this.buildFlatList();
        this.applyFilter();
        this.cd.markForCheck();
      },
      error: () => {
        this.alertDialogService.open('Chyba', 'Uložení na server selhalo.', 'danger');
      }
    });
  }

  /**
   * @description Initializes the state for the 'Add New Language' modal.
   */
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

  /**
   * @description Closes the 'Add New Language' modal.
   */
  closeAddForm(): void {
    this.showAddForm = false;
    this.cd.markForCheck();
  }

  /**
   * @description Handles local file selection and generates a base64 preview for the language icon.
   * @param event The file input change event.
   */
  onIconFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;

    if (file.size > 512 * 1024) {
      this.addFormError = 'Ikonka je příliš velká (max 512 KB).';
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

  /**
   * @description Discards the selected language icon file before submission.
   */
  clearIconSelection(): void {
    this.newLangIconFile    = null;
    this.newLangIconPreview = '';
    this.cd.markForCheck();
  }

  /**
   * @description Processes form data and icon upload to create a new language entry on the server.
   */
  confirmAddLang(): void {
    const code = this.newLangCode.trim().toLowerCase();
    const name = this.newLangName.trim();

    if (!code || !name) {
      this.addFormError = 'Kód i název jazyka jsou povinné.';
      this.cd.markForCheck();
      return;
    }
    if (!/^[a-z]{2,5}$/.test(code)) {
      this.addFormError = 'Kód jazyka musí být 2–5 malých písmen (např. sk, de, fr).';
      this.cd.markForCheck();
      return;
    }
    if (this.languages.some(l => l.code === code)) {
      this.addFormError = `Jazyk s kódem „${code}" již existuje.`;
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

    this.http.post<{ status: string }>(`/api/languages/${this.MODULE}`, fd)
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
            'Úspěch',
            `Jazyk „${code}" byl vytvořen. Nyní můžete začít překládat klíče.`,
            'success'
          );
        },
        error: () => {
          this.addFormError = 'Nepodařilo se uložit jazyk na server.';
          this.cd.markForCheck();
        }
      });
  }

  /**
   * @description Sets the target language for the deletion confirmation step.
   * @param lang The language to be deleted.
   */
  askDeleteLang(lang: LangMeta): void {
    this.langToDelete = lang;
    this.cd.markForCheck();
  }

  /**
   * @description Cancels the pending deletion action.
   */
  cancelDelete(): void {
    this.langToDelete = null;
    this.cd.markForCheck();
  }

  /**
   * @description Deletes the selected language from the server and refreshes the manifest.
   */
  confirmDeleteLang(): void {
    if (!this.langToDelete) return;
    const code = this.langToDelete.code;

    this.http.delete<void>(`/api/languages/${this.MODULE}/${code}`)
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
          const msg = err?.error?.message ?? 'Nepodařilo se smazat jazyk.';
          this.alertDialogService.open('Chyba', msg, 'danger');
          this.cd.markForCheck();
        }
      });
  }

  /**
   * @description Updates the 'active' status of a language and syncs the entire manifest to the backend.
   * @param lang The language item to modify.
   */
  toggleLangActive(lang: LangMeta): void {
  lang.active = !lang.active;
  this.cd.markForCheck();

  const fd = new FormData();
  fd.append('languages', JSON.stringify(this.languages));
  fd.append('module', this.MODULE);

  this.http.post<{ status: string }>(`/api/languages/${this.MODULE}`, fd)
    .pipe(Core.takeUntil(this.destroy$))
    .subscribe({
      error: () => {
        lang.active = !lang.active;
        this.alertDialogService.open('Chyba', 'Nepodařilo se uložit změnu.', 'danger');
        this.cd.markForCheck();
      }
    });
}

  /**
   * @description Opens the JSON upload modal.
   * @param lang The target language code to override.
   */
  openUploadModal(lang: string): void {
    this.uploadLangCode = lang;
    this.uploadError    = '';
    this.uploadSuccess  = '';
    this.showUploadModal = true;
    this.cd.markForCheck();
  }

  /**
   * @description Closes the JSON upload modal.
   */
  closeUploadModal(): void {
    this.showUploadModal = false;
    this.cd.markForCheck();
  }

  /**
   * @description Processes a local JSON file selection for translation import.
   * @param event The file input change event.
   */
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
        this.uploadError   = 'Soubor není validní JSON.';
        this.uploadSuccess = '';
        this.cd.markForCheck();
      }
    };
    reader.readAsText(file);
  }

  /**
   * @description Sends the parsed JSON data to the API for the current module.
   * @param data The translation object to store.
   */
  private uploadJsonToServer(data: any): void {
    this.dataHandler.post(`save_translations/${this.MODULE}`, {
      lang: this.uploadLangCode,
      data
    }).pipe(Core.takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.uploadSuccess = `JSON pro „${this.uploadLangCode}" byl úspěšně uložen na server.`;
        this.uploadError   = '';

        if (this.uploadLangCode === this.currentLang) {
          this.translations = {};
          this.refreshTranslations();
        }

        this.cd.markForCheck();
      },
      error: () => {
        this.uploadError   = 'Upload se nezdařil. Zkontrolujte připojení nebo práva na serveru.';
        this.uploadSuccess = '';
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Triggers a browser download of the current translation set as a JSON file.
   */
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

  /**
   * @description TrackBy function for key list rendering.
   */
  trackByPath(_: number, item: FlatKey): string  { return item.path; }
  
  /**
   * @description TrackBy function for language list rendering.
   */
  trackByCode(_: number, lang: LangMeta): string { return lang.code; }

  /**
   * @description Retrieves the metadata for the currently active language.
   * @returns LangMeta object or undefined.
   */
  getCurrentLangMeta(): LangMeta | undefined {
    return this.languages.find(l => l.code === this.currentLang);
  }
}