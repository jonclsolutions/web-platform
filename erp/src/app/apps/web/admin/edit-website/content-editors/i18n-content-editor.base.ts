/**
 * @file i18n-content-editor.base.ts
 * @path src/app/apps/web/admin/edit-website/content-editors/i18n-content-editor.base.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared logic of the content editors of the public website (FAQ, Jobs, References): the
 *   languages of the web module, the whole content loaded and saved at once (GET / PUT of the
 *   endpoint), unsaved changes (dot on the tab, save / discard), reordering and removing list
 *   entries and the missing translations - counted per language (badge on the language tab) and
 *   shown at every empty field of the current language. Only the languages of the web module are
 *   offered (from the host page, current also after a language was deleted); texts of other
 *   languages are dropped by the API. Saving keeps the expanded / collapsed
 *   state of the entries (the API answers them in the saved order).
 * @usage `class FaqEditorComponent extends I18nContentEditorBase<FaqCategoryDraft>` - the subclass
 *   says how the API rows become drafts (fromApi), how drafts are sent (toPayload) and which texts
 *   are checked (checkedTexts).
 * @note A text missing in a language shows 'Cannot load text' on the public website - that is
 *   what the warnings are for. An optional field (heading, type, place) is missing only when it is
 *   filled in another language (empty everywhere = not shown at all).
 * @dependencies
 * - DataHandler (GET / PUT, languages), ResourceCacheService (languages, 10 minutes),
 *   PermissionService (web-edit-website-update), AdminLocalizationService (section
 *   `web-content-editor`, redrawn on a switch of the admin language), AlertDialogService.
 */

import { ChangeDetectorRef, DestroyRef, Directive, DoCheck, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DataHandler } from '../../../../../core/services/data-handler.service';
import { ResourceCacheService } from '../../../../../core/services/resource-cache.service';
import { PermissionService } from '../../../../../core/auth/services/permission.service';
import { AdminLocalizationService } from '../../../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../../../core/services/alert-dialog.service';
import { CheckedText, ContentLang, I18nText } from './content-editor.model';

/** @description Languages when the module has none (or they cannot be loaded). */
const FALLBACK_LANGUAGES: ContentLang[] = [{ code: 'cz', name: 'Čeština', active: true, isBuiltIn: true }];

/** @description Permission needed to save (without it the editor is read-only). */
export const CONTENT_UPDATE_PERMISSION = 'web-edit-website-update';

@Directive()
export abstract class I18nContentEditorBase<T extends { open: boolean }> implements OnInit, DoCheck {
  /** Whether there are unsaved changes (for a dot on the tab of the host page). */
  @Output() dirtyChange = new EventEmitter<boolean>();

  /**
   * Languages of the host page (web/edit-website keeps them current when a language is added,
   * deleted or switched off) - used instead of loading them, so the editor never offers a deleted
   * language. Without it the editor loads `languages/web` itself.
   */
  @Input() set hostLanguages(value: ContentLang[] | null | undefined) {
    const previous = this.host?.map(l => l.code) ?? [];
    this.host = Array.isArray(value) ? value : null;
    // A deleted language: the API deleted its texts - drop them here too, otherwise a language
    // created again with the same code would show (and save) them again.
    const current = new Set((this.host ?? []).map(l => l.code));
    const removed = previous.filter(code => !current.has(code));
    if (removed.length && !this.loading) this.forgetLanguages(removed);
    this.cd.markForCheck();
  }

  /** API endpoint of the content (GET + PUT). */
  protected abstract readonly endpoint: string;
  /** Key of the list in the PUT payload ('categories', 'jobs'). */
  protected abstract readonly payloadKey: string;

  /** Entries of the editor (categories / positions). */
  entries: T[] = [];
  /** Language edited now. */
  lang = 'cz';
  loading = true;
  saving = false;
  loadError = false;

  /** Languages of the host page (null = loaded by the editor). */
  private host: ContentLang[] | null = null;
  /** Languages loaded by the editor itself. */
  private loadedLanguages: ContentLang[] = [];
  /** Codes of the offered languages at the last check (redraw when they change). */
  private languageSignature = '';

  /** JSON of the last loaded / saved payload - base of the unsaved state. */
  private snapshot = '';
  private lastDirty = false;
  /** Next client-side key of a new entry. */
  private nextKey = 1;

  private readonly LANG_TTL_MS = 10 * 60 * 1000;
  protected readonly dataHandler = inject(DataHandler);
  private readonly resourceCache = inject(ResourceCacheService);
  private readonly permissionService = inject(PermissionService);
  private readonly alertDialog = inject(AlertDialogService);
  protected readonly cd = inject(ChangeDetectorRef);
  public readonly i18n = inject(AdminLocalizationService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * @description Drafts of the API rows (every language of the module filled with '').
   * @param rows Rows of the API.
   */
  protected abstract fromApi(rows: any[]): T[];

  /**
   * @description Rows of the PUT payload (no client-only fields).
   * @param entries Drafts.
   */
  protected abstract toPayload(entries: T[]): unknown[];

  /** @description Texts checked for missing translations. */
  protected abstract checkedTexts(): CheckedText[];

  /** @description Texts of the editors (section `web-content-editor` + shared). */
  get strings(): any {
    return this.i18n.getMergedSection('web-content-editor');
  }

  /** Active languages (host page / loaded); the built-in Czech when there are none. */
  get languages(): ContentLang[] {
    const active = (this.host ?? this.loadedLanguages).filter(l => l.active !== false);
    return active.length ? active : FALLBACK_LANGUAGES;
  }

  get canUpdate(): boolean {
    return this.permissionService.hasPermission(CONTENT_UPDATE_PERMISSION);
  }

  get isDirty(): boolean {
    return !this.loading && JSON.stringify(this.toPayload(this.entries)) !== this.snapshot;
  }

  /** @description Name of the edited language. */
  get langName(): string {
    return this.languages.find(l => l.code === this.lang)?.name ?? this.lang.toUpperCase();
  }

  ngOnInit(): void {
    // OnPush: redraw the labels at once when the admin language is switched (otherwise they
    // changed only with the next interaction inside the editor).
    this.i18n.translations$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cd.markForCheck());
    this.load();
  }

  /**
   * @description Follows the languages of the host page (also a language switched off in place):
   *   redraws when they change; a deleted / switched off edited language = the first one instead.
   */
  ngDoCheck(): void {
    const languages = this.languages;
    const signature = languages.map(l => l.code).join(',');
    if (signature !== this.languageSignature) {
      this.languageSignature = signature;
      this.cd.markForCheck();
    }
    if (!languages.some(l => l.code === this.lang)) {
      this.lang = languages[0].code;
      this.cd.markForCheck();
    }
  }

  /** @description Loads the languages of the web module and the content. */
  load(): void {
    this.loading = true;
    this.loadError = false;
    this.cd.markForCheck();

    const langs$ = this.host ? of([] as ContentLang[]) : this.loadLanguages();
    forkJoin({ langs: langs$, rows: this.dataHandler.get<any[]>(this.endpoint) }).subscribe({
      next: ({ langs, rows }) => {
        this.loadedLanguages = langs;
        if (!this.languages.some(l => l.code === this.lang)) this.lang = this.languages[0].code;
        this.setEntries(Array.isArray(rows) ? rows : []);
        this.loading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
        this.cd.markForCheck();
      },
    });
  }

  /** @description Active languages of the web module; a failure = [] (fallback above). */
  private loadLanguages(): Observable<ContentLang[]> {
    return this.resourceCache.get(
      'web-content:languages:web',
      () => this.dataHandler.get<ContentLang[]>('languages/web'),
      this.LANG_TTL_MS
    ).pipe(
      map((res: any) => ((Array.isArray(res) ? res : []) as ContentLang[]).filter(l => l.active !== false)),
      catchError(() => of([] as ContentLang[]))
    );
  }

  /** @description Stores the drafts of the API rows and their snapshot. */
  private setEntries(rows: any[]): void {
    this.entries = this.fromApi(rows);
    this.snapshot = JSON.stringify(this.toPayload(this.entries));
    this.emitDirty();
  }

  /**
   * @description Removes the texts of deleted languages from the drafts and from the saved state
   *   (the API removed them already); unsaved edits of the other languages and the expanded
   *   entries stay.
   * @param codes Codes of the deleted languages.
   */
  private forgetLanguages(codes: string[]): void {
    const strip = (rows: unknown[]) => JSON.parse(JSON.stringify(rows), (key, value) =>
      key.endsWith('_i18n') && value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).filter(([code]) => !codes.includes(code)))
        : value);
    const open = this.entries.map(entry => entry.open);
    const saved = strip(this.snapshotRows());
    this.entries = this.fromApi(strip(this.toPayload(this.entries)));
    this.entries.forEach((entry, index) => {
      if (index < open.length) entry.open = open[index];
    });
    this.snapshot = JSON.stringify(this.toPayload(this.fromApi(saved)));
    this.emitDirty();
  }

  /** @description Reports a change of the unsaved state to the host page. */
  private emitDirty(): void {
    const dirty = this.isDirty;
    if (dirty !== this.lastDirty) {
      this.lastDirty = dirty;
      this.dirtyChange.emit(dirty);
    }
  }

  /** @description Called after every edit: updates the unsaved state. */
  changed(): void {
    this.emitDirty();
    this.cd.markForCheck();
  }

  /** @description New client-side key of an entry. */
  protected newKey(): number {
    return this.nextKey++;
  }

  /**
   * @description Text per language of an API value, every language of the module present.
   * @param value `{ lang: text }` of the API (anything else = empty).
   */
  protected i18nOf(value: unknown): I18nText {
    const text: I18nText = {};
    const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    for (const [code, item] of Object.entries(source)) {
      if (typeof item === 'string') text[code] = item;
    }
    for (const l of this.languages) {
      if (typeof text[l.code] !== 'string') text[l.code] = '';
    }
    return text;
  }

  /** @description An empty text in every language of the module. */
  protected emptyText(): I18nText {
    return this.i18nOf({});
  }

  switchLang(code: string): void {
    this.lang = code;
    this.cd.markForCheck();
  }

  /**
   * @description Whether a text is missing in the edited language (see CheckedText).
   * @param text Text per language.
   * @param optional An optional field.
   */
  isMissing(text: I18nText, optional = false): boolean {
    return this.isMissingIn(text, this.lang, optional);
  }

  /**
   * @description How many checked texts miss the language (badge of the language tab).
   * @param code Language code.
   */
  missingCount(code: string): number {
    return this.checkedTexts().filter(c => this.isMissingIn(c.text, code, !!c.optional)).length;
  }

  /** "In English 3 texts are missing - ..." warning of the edited language ('' = none missing). */
  get missingWarning(): string {
    const count = this.missingCount(this.lang);
    return count ? (this.strings?.missing_warning ?? '').replace('{lang}', this.langName).replace('{count}', String(count)) : '';
  }

  private isMissingIn(text: I18nText, code: string, optional: boolean): boolean {
    const filled = (value: string | undefined) => typeof value === 'string' && value.trim() !== '';
    if (filled(text?.[code])) return false;
    return !optional || Object.values(text ?? {}).some(filled);
  }

  /**
   * @description Moves an entry of a list up / down.
   * @param list The list.
   * @param index Position of the entry.
   * @param delta -1 = up, 1 = down.
   */
  move<E>(list: E[], index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    this.changed();
  }

  /**
   * @description Removes an entry of a list (saved only with "Save").
   * @param list The list.
   * @param index Position of the entry.
   */
  remove<E>(list: E[], index: number): void {
    list.splice(index, 1);
    this.changed();
  }

  /** @description Reverts every unsaved edit to the last loaded state. */
  discard(): void {
    this.entries = this.fromApi(this.snapshotRows());
    this.changed();
  }

  /**
   * @description Validation of the subclass before saving ('' = fine, otherwise the message).
   */
  protected validate(): string {
    return '';
  }

  /** @description Saves the whole content; the API returns the fresh state. */
  save(): void {
    if (!this.canUpdate || this.saving || !this.isDirty) return;
    const problem = this.validate();
    if (problem) {
      this.alertDialog.open(this.strings.invalid_title, problem, 'warning');
      return;
    }

    this.saving = true;
    this.cd.markForCheck();
    // The answer comes in the saved order - the expanded entries stay expanded.
    const open = this.entries.map(entry => entry.open);
    this.dataHandler.put<any[]>(this.endpoint, { [this.payloadKey]: this.toPayload(this.entries) } as any).subscribe({
      next: (rows: any) => {
        this.setEntries(Array.isArray(rows) ? rows : this.snapshotRows());
        this.entries.forEach((entry, index) => {
          if (index < open.length) entry.open = open[index];
        });
        this.saving = false;
        this.alertDialog.open(this.strings.saved_title, this.strings.saved_message, 'success');
        this.cd.markForCheck();
      },
      error: () => {
        // The reason is shown by DataHandler.handleError() (validation, stale data).
        this.saving = false;
        this.cd.markForCheck();
      },
    });
  }

  /** @description Rows of the last snapshot (same shape as the API rows). */
  private snapshotRows(): any[] {
    try {
      return JSON.parse(this.snapshot || '[]');
    } catch {
      return [];
    }
  }
}
