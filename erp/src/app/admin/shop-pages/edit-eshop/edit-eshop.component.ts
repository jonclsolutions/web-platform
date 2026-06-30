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

// ─── Interfaces ───────────────────────────────────────────────

/**
 * Metadata jazyka vrácená serverem.
 * Server ukládá ikonky na disk a vrací iconUrl (veřejná URL).
 * iconBase64 je pouze dočasný stav při nahrávání nové ikonky v UI.
 */
export interface LangMeta {
  code: string;        // 'cz', 'en', 'sk' …
  name: string;        // 'Čeština', 'English' …
  iconUrl?: string;    // veřejná URL ikonky ze serveru (null = žádná)
  active: boolean;
  isBuiltIn?: boolean; // true = nelze smazat
}

export interface FlatKey {
  path: string;
  value: string;
  missing: boolean;    // prázdná hodnota oproti CZ vzoru
}

// localStorage klíč — pouze pro fallback seznam jazyků (bez ikonek)
const LS_KEY = 'rpsw_languages';


@Component({
  selector: 'app-edit-website',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './edit-eshop.component.html',
  styleUrls: ['./edit-eshop.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditEshopComponent
  extends BaseDataComponent<any>
  implements OnInit, OnDestroy {

  public override loadingService = inject(LoadingService);
  override apiEndpoint = 'save_translations';

  private readonly MODULE = 'shop';

  // ── Jazyky ──────────────────────────────────────────────────
  languages: LangMeta[] = [];
  currentLang: string = 'cz';

  // ── Překlady ─────────────────────────────────────────────────
  translations: any = {};
  czTranslations: any = {};     // referenční CZ pro diff chybějících klíčů
  flattenedKeys: FlatKey[] = [];
  filteredKeys: FlatKey[] = [];
  searchQuery: string = '';

  // ── Přidání jazyka — formulář ────────────────────────────────
  showAddForm: boolean = false;
  newLangCode: string = '';
  newLangName: string = '';
  newLangActive: boolean = true;
  addFormError: string = '';
  /** Soubor ikonky vybraný uživatelem — odešle se jako FormData */
  private newLangIconFile: File | null = null;
  /** Preview pro UI — zobrazí se ihned po výběru souboru */
  newLangIconPreview: string = '';

  // ── Upload JSON ───────────────────────────────────────────────
  showUploadModal: boolean = false;
  uploadLangCode: string = '';
  uploadError: string = '';
  uploadSuccess: string = '';

  // ── Smazání jazyka ────────────────────────────────────────────
  langToDelete: LangMeta | null = null;

  // ── Statistiky (gettery, vždy aktuální) ──────────────────────
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

  // ════════════════════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════════════════════

  override ngOnInit(): void {
    this.loadLanguages();
  }

  // ════════════════════════════════════════════════════════════
  // NAČTENÍ JAZYKŮ
  // ════════════════════════════════════════════════════════════

  /**
   * Načte seznam jazyků ze serveru.
   * Server vrací iconUrl (veřejná URL), nikoliv base64.
   * Při chybě použije localStorage nebo built-in seznam.
   */
  private loadLanguages(): void {
    // Upravená URL s parametrem modulu
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
          // Fallback na localStorage
          const cached = localStorage.getItem(LS_KEY);
          this.languages = cached ? JSON.parse(cached) : this.getBuiltInLanguages();
          this.afterLanguagesLoaded();
        }
      });
  }

  private getBuiltInLanguages(): LangMeta[] {
    return [
      { code: 'cz', name: 'Čeština', iconUrl: undefined, active: true, isBuiltIn: true },
      { code: 'en', name: 'English',  iconUrl: undefined, active: true, isBuiltIn: false },
    ];
  }

  private afterLanguagesLoaded(): void {
    // Načti CZ jako referenci pro diff, pak načti aktuální jazyk
    this.loadCzReference(() => {
      this.loadLang(this.currentLang);
    });
  }

  private persistMetaToLocalStorage(): void {
    // Ukládáme bez iconUrl — URL je server-side a může se změnit
    const stripped = this.languages.map(({ iconUrl, ...rest }) => rest);
    try { localStorage.setItem(LS_KEY, JSON.stringify(stripped)); } catch {}
  }

  // ════════════════════════════════════════════════════════════
  // NAČTENÍ PŘEKLADŮ ZE SERVERU
  // ════════════════════════════════════════════════════════════

  /**
   * Načte CZ překlady ze serveru jako referenční vzor pro diff.
   * Endpoint: GET /api/translations/cz
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
          // Pokud CZ selže, pokračujeme bez referenčního vzoru
          this.czTranslations = {};
          callback?.();
        }
      });
  }

  /**
   * Přepne na daný jazyk a načte překlady ze serveru.
   * Endpoint: GET /api/translations/{lang}
   */
  loadLang(lang: string): void {
    // Pokud přepínáme na stejný jazyk a data jsou načtena, přeskočíme
    if (this.currentLang === lang && Object.keys(this.translations).length > 0) return;
    this.currentLang = lang;
    this.refreshTranslations();
  }

  /**
   * Znovu načte překlady pro currentLang ze serveru.
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
          // JSON pro tento jazyk ještě neexistuje na serveru
          // Inicializujeme prázdnou strukturu dle CZ vzoru
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

  // ════════════════════════════════════════════════════════════
  // FLAT LIST + DIFF
  // ════════════════════════════════════════════════════════════

  private buildFlatList(): void {
    this.flattenedKeys = [];
    const czFlat  = this.flattenToMap(this.czTranslations);
    const curFlat = this.flattenToMap(this.translations);

    // Projdi všechny klíče z CZ (master vzor)
    for (const [path] of czFlat.entries()) {
      const curVal = curFlat.get(path) ?? '';
      this.flattenedKeys.push({
        path,
        value: curVal,
        missing: curVal.trim() === ''
      });
    }

    // Klíče které jsou v překladu ale ne v CZ vzoru (přebývající / nové)
    for (const [path, val] of curFlat.entries()) {
      if (!czFlat.has(path)) {
        this.flattenedKeys.push({ path, value: val, missing: false });
      }
    }
  }

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

  /** Vytvoří hlubokou kopii struktury objektu s prázdnými string hodnotami */
  private buildEmptyFromCz(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return '';
    const result: any = {};
    for (const key in obj) {
      result[key] = this.buildEmptyFromCz(obj[key]);
    }
    return result;
  }

  // ════════════════════════════════════════════════════════════
  // FILTROVÁNÍ
  // ════════════════════════════════════════════════════════════

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

  // ════════════════════════════════════════════════════════════
  // EDITACE HODNOT
  // ════════════════════════════════════════════════════════════

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

  // ════════════════════════════════════════════════════════════
  // ULOŽENÍ PŘEKLADŮ NA SERVER
  // ════════════════════════════════════════════════════════════

  /**
   * POST /api/save_translations
   * Uloží aktuální překlady pro currentLang na server.
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

  // ════════════════════════════════════════════════════════════
  // SPRÁVA JAZYKŮ — PŘIDÁNÍ
  // ════════════════════════════════════════════════════════════

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
   * Uživatel vybral soubor ikonky.
   * Vytvoříme lokální preview (base64) pro zobrazení v UI.
   * Skutečný soubor se odešle jako FormData při confirmAddLang().
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

    // Vytvoříme pouze lokální preview pro UI
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
   * Odešle nový jazyk na server jako FormData.
   * POST /api/languages
   * Body: languages (JSON string), icon (File, volitelné), target_code (string)
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

    // Sestavíme FormData — server očekává 'languages' jako JSON string
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
          
          // 1. Znovu načteme seznam jazyků, aby se správně propsala ikonka
          this.loadLanguages();

          // 2. MÍSTO volání refreshTranslations(), které by vyvolalo 404, 
          // nastavíme prázdnou strukturu lokálně:
          this.currentLang = code;
          this.translations = this.buildEmptyFromCz(this.czTranslations);
          this.buildFlatList();
          this.applyFilter();
          
          // Upozorníme uživatele, že je jazyk prázdný
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

  // ════════════════════════════════════════════════════════════
  // SPRÁVA JAZYKŮ — SMAZÁNÍ
  // ════════════════════════════════════════════════════════════

  askDeleteLang(lang: LangMeta): void {
    this.langToDelete = lang;
    this.cd.markForCheck();
  }

  cancelDelete(): void {
    this.langToDelete = null;
    this.cd.markForCheck();
  }

  /**
   * DELETE /api/languages/{code}
   * Server smaže metadata, ikonku i JSON soubor s překlady.
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

          // Znovu načteme seznam jazyků ze serveru
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

  // ════════════════════════════════════════════════════════════
  // TOGGLE ACTIVE
  // ════════════════════════════════════════════════════════════

  /**
   * Přepne active flag jazyka a uloží celý seznam na server.
   * POST /api/languages s aktualizovaným polem languages.
   */
  toggleLangActive(lang: LangMeta): void {
  lang.active = !lang.active;
  this.cd.markForCheck();

  const fd = new FormData();
  fd.append('languages', JSON.stringify(this.languages));
  fd.append('module', this.MODULE); // PŘIDAT TOTO

  // Upravit endpoint na: /api/languages/{module}
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

  // ════════════════════════════════════════════════════════════
  // UPLOAD JSON
  // ════════════════════════════════════════════════════════════

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

  /**
   * Uživatel vybral JSON soubor k nahrání.
   * Přeloží ho a rovnou odešle na server přes POST /api/save_translations.
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

  private uploadJsonToServer(data: any): void {
    this.dataHandler.post(`save_translations/${this.MODULE}`, {
      lang: this.uploadLangCode,
      data
    }).pipe(Core.takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.uploadSuccess = `JSON pro „${this.uploadLangCode}" byl úspěšně uložen na server.`;
        this.uploadError   = '';

        // Pokud jsme nahrávali pro aktuální jazyk, znovu načteme překlady
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

  // ════════════════════════════════════════════════════════════
  // DOWNLOAD JSON
  // ════════════════════════════════════════════════════════════

  /**
   * Stáhne aktuálně editovaný překlad jako JSON soubor.
   * Data jsou z in-memory stavu (ne znovu ze serveru).
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

  // ════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════

  trackByPath(_: number, item: FlatKey): string  { return item.path; }
  trackByCode(_: number, lang: LangMeta): string { return lang.code; }

  getCurrentLangMeta(): LangMeta | undefined {
    return this.languages.find(l => l.code === this.currentLang);
  }
}