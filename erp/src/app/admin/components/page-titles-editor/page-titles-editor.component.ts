/**
 * @file page-titles-editor.component.ts
 * @path src/app/admin/components/page-titles-editor/page-titles-editor.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Editor of the browser page titles (<title>, the headline in search results) of
 * ONE area. Every application manages its own pages in its texts page (area = its id, e.g.
 * web/edit-website, shop/edit-eshop, project-portal settings) - removing an application removes
 * its page titles with it. The administration has none (its tab title is a text of the admin
 * UI, PageTitleStrategy). Languages of the application, a live browser tab preview, one input
 * per page; only changed rows are saved.
 * @usage `<app-page-titles-editor area="web" endpoint="web/page-titles"
 *   updatePermission="web-edit-website-update" labelSection="edit-website"
 *   (dirtyChange)="titlesDirty = $event">`
 * @note Page names come from `pt_page_{area}_{page_key}` of `labelSection` (the host page's own
 *   i18n section), the URL when missing; the generic texts from the section `page-titles`.
 *   The favicon of the preview: `logoSrc` when given, otherwise the logo of the public site
 *   configuration (`public/legal/config`, needs no permission).
 * @dependencies
 * - DataHandler: GET / PUT of the endpoint, languages, public configuration.
 * - ResourceCacheService: languages cached 10 minutes.
 * - RowButtonBuilderComponent: the language tabs.
 * - PermissionService: the update permission.
 * - AdminLocalizationService (redrawn on a switch of the admin language), AlertDialogService.
 * - AdminNotificationsService: asked again after a save (the orange dot of the missing titles).
 */

import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StickyBarDirective } from '../../../shared/directives/sticky-bar.directive';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DataHandler } from '../../../core/services/data-handler.service';
import type { FocusLangRequest } from '../translation-editor/focus-lang';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { PermissionService } from '../../../core/auth/services/permission.service';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { AdminNotificationsService } from '../../../core/services/admin-notifications.service';
import { RowButtonBuilderComponent } from '../builders/row-button-builder/row-button-builder.component';
import { RowButton, RowButtonItems, languageRowButtons } from '../builders/row-button-builder/row-button';
import { environment } from '../../../../environments/environment';
import { PageTitleArea, PageTitleLang, PageTitleRow, PageTitlesUpdatePayload } from './page-titles.model';

/** @description Languages when the module has none (or they cannot be loaded). */
const FALLBACK_LANGUAGES: PageTitleLang[] = [{ code: 'cz', name: 'Čeština', active: true, isBuiltIn: true }];

@Component({
  selector: 'app-page-titles-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, StickyBarDirective, RowButtonBuilderComponent],
  templateUrl: './page-titles-editor.component.html',
  styleUrl: './page-titles-editor.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageTitlesEditorComponent implements OnInit {
  /** Area of the pages. */
  @Input({ required: true }) area!: PageTitleArea;
  /** API endpoint of the area, e.g. 'web/page-titles'. */
  @Input({ required: true }) endpoint!: string;
  /** Permission needed to save (without it the inputs are read-only). */
  @Input({ required: true }) updatePermission!: string;
  /** i18n section of the host page with the page names (`pt_page_{area}_{page_key}`). */
  @Input({ required: true }) labelSection!: string;
  /** Favicon of the preview; undefined = the logo of the public site configuration. */
  @Input() logoSrc: string | null | undefined = undefined;

  /** Language asked for by the texts page (window Jazyky → a part); applied once it is offered. */
  private focusCode: string | null = null;

  /**
   * Show this language (a click on a part of what a language lacks in the window Jazyky) - as
   * soon as the editor offers it.
   */
  @Input() set focusLang(request: FocusLangRequest | null | undefined) {
    this.focusCode = request?.code ?? null;
    this.applyFocusLang();
  }

  /** @description Switches to the asked language when it is offered (otherwise it stays pending). */
  private applyFocusLang(): void {
    if (this.focusCode && this.languages.some(l => l.code === this.focusCode)) {
      this.switchLang(this.focusCode);
      this.focusCode = null;
    }
  }

  /** Whether there are unsaved changes (for a dot on the host page's tab). */
  @Output() dirtyChange = new EventEmitter<boolean>();

  /** Google shows roughly this many characters, longer titles get cut. */
  readonly RECOMMENDED_LENGTH = 60;
  /** Hard limit, same as backend validation (PageTitleController::MAX_LENGTH). */
  readonly MAX_LENGTH = 120;
  private readonly LANG_TTL_MS = 10 * 60 * 1000;

  rows: PageTitleRow[] = [];
  languages: PageTitleLang[] = [];
  lang = 'cz';
  loading = true;
  saving = false;
  loadError = false;
  /** Row shown in the browser-tab preview (last focused input). */
  previewRowId: number | null = null;

  /** Logo of the public configuration (used when no logoSrc is given). */
  private publicLogo: string | null = null;
  /** Original JSON of every row's title_i18n – base for dirty detection. */
  private snapshot = new Map<number, string>();
  private lastDirty = false;

  private readonly dataHandler = inject(DataHandler);
  private readonly resourceCache = inject(ResourceCacheService);
  private readonly permissionService = inject(PermissionService);
  private readonly alertDialog = inject(AlertDialogService);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  public readonly i18n = inject(AdminLocalizationService);
  private readonly notifications = inject(AdminNotificationsService);

  /** @description Generic texts (section `page-titles` + shared). */
  get strings(): any {
    return this.i18n.getMergedSection('page-titles');
  }

  ngOnInit(): void {
    // OnPush: redraw the labels at once when the admin language is switched (otherwise they
    // changed only with the next interaction inside the editor).
    this.i18n.translations$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cd.markForCheck());
    this.load();
  }

  /** @description Loads the languages of the area, its rows and (if needed) the logo. */
  private load(): void {
    this.loading = true;
    this.loadError = false;
    this.cd.markForCheck();

    forkJoin({
      langs: this.loadLanguages(this.area),
      data: this.dataHandler.get<PageTitleRow[]>(this.endpoint),
      logo: this.logoSrc === undefined ? this.loadPublicLogo() : of(null),
    }).subscribe({
      next: ({ langs, data, logo }) => {
        this.languages = langs.length ? langs : FALLBACK_LANGUAGES;
        if (!this.languages.find(l => l.code === this.lang)) this.lang = this.languages[0].code;
        this.applyFocusLang();
        this.publicLogo = logo;
        this.setRows(Array.isArray(data) ? data : []);
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

  /**
   * @description Languages of an application (the switched off ones too); a failure = empty
   *   list (fallback above).
   * @param module Application id.
   */
  private loadLanguages(module: string): Observable<PageTitleLang[]> {
    const endpoint = `languages/${module}`;
    return this.resourceCache.get(
      `page-titles:${endpoint}`,
      () => this.dataHandler.get<PageTitleLang[]>(endpoint),
      this.LANG_TTL_MS
    ).pipe(
      // the switched off languages too: their titles are filled in before they are switched on
      map((res: any) => (Array.isArray(res) ? res : []) as PageTitleLang[]),
      catchError(() => of([] as PageTitleLang[]))
    );
  }

  /** @description Logo of the public site configuration, null without one or on an error. */
  private loadPublicLogo(): Observable<string | null> {
    return this.dataHandler.get<any>('public/legal/config').pipe(
      map(res => res?.settings?.logo_path ? `${environment.public_storage_url}/${res.settings.logo_path}` : null),
      catchError(() => of(null))
    );
  }

  /** @description Stores rows, fills missing languages with '' and snapshots them. */
  private setRows(rows: PageTitleRow[]): void {
    this.rows = rows.map(r => {
      const titles: Record<string, string> = { ...(r.title_i18n ?? {}) };
      for (const l of this.languages) {
        if (typeof titles[l.code] !== 'string') titles[l.code] = '';
      }
      return { ...r, title_i18n: titles };
    });

    this.snapshot.clear();
    for (const r of this.rows) this.snapshot.set(r.id, JSON.stringify(r.title_i18n));
    this.previewRowId = null;
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

  get canUpdate(): boolean {
    return this.permissionService.hasPermission(this.updatePermission);
  }

  /** Favicon of the preview. */
  get faviconSrc(): string | null {
    return this.logoSrc === undefined ? this.publicLogo : this.logoSrc;
  }

  get dirtyCount(): number {
    return this.rows.filter(r => this.isRowDirty(r)).length;
  }

  get isDirty(): boolean {
    return this.dirtyCount > 0;
  }

  /** "Unsaved changes: 3" badge text. */
  get unsavedLabel(): string {
    return (this.strings?.pt_unsaved_count ?? '').replace('{count}', String(this.dirtyCount));
  }

  /** Tab preview text: last focused row, otherwise the first one. */
  get previewText(): string {
    const row = this.rows.find(r => r.id === this.previewRowId) ?? this.rows[0];
    const text = row?.title_i18n[this.lang]?.trim();
    return text || this.strings?.pt_preview_empty || '';
  }

  /**
   * @description Page name from the host page's section ('pt_page_web_about_us'), fallback = URL.
   * @param row Page.
   */
  labelFor(row: PageTitleRow): string {
    const value = this.i18n.getMergedSection(this.labelSection)?.[`pt_page_${row.area}_${row.page_key.replace(/-/g, '_')}`];
    return typeof value === 'string' && value ? value : row.route_path;
  }

  placeholderFor(): string {
    const name = this.languages.find(l => l.code === this.lang)?.name ?? this.lang.toUpperCase();
    return (this.strings?.pt_input_placeholder ?? '').replace('{lang}', name);
  }

  lengthOf(row: PageTitleRow): number {
    return (row.title_i18n[this.lang] ?? '').length;
  }

  isRowDirty(row: PageTitleRow): boolean {
    return JSON.stringify(row.title_i18n) !== this.snapshot.get(row.id);
  }

  /** Stable buttons of the language tabs. */
  private readonly langButtons = new RowButtonItems();

  /**
   * @description Language tabs (flag + upper-case code) with the orange number of pages without
   *   a title in that language - counted from the edited rows, so it follows the typing.
   */
  get langItems(): RowButton[] {
    return this.langButtons.update(languageRowButtons(this.languages, {
      inactiveTitle: this.i18n.getValue('shared.inactive_language_title'),
      count: code => this.missingCount(code) || null,
      title: code => this.missingCount(code) ? (this.strings?.pt_missing_lang_title ?? '').replace('{count}', String(this.missingCount(code))) : '',
    }));
  }

  /**
   * @description Pages without a title in a language (empty or only spaces) - the visitor then
   *   sees the title of another language (Czech).
   * @param code Language code.
   */
  missingCount(code: string): number {
    return this.rows.filter(row => this.isMissing(row, code)).length;
  }

  /**
   * @description Whether a page has no title in a language.
   * @param row Page.
   * @param code Language code (the edited one by default).
   */
  isMissing(row: PageTitleRow, code: string = this.lang): boolean {
    return !(row.title_i18n?.[code] ?? '').trim();
  }

  /**
   * @description Banner of the edited language: how many titles are missing ('' when none) - in
   *   a switched off language "fill them in before switching it on" (visitors do not see it).
   */
  get missingBanner(): string {
    const count = this.missingCount(this.lang);
    if (!count) return '';
    const lang = this.languages.find(l => l.code === this.lang);
    const key = lang?.active === false ? 'pt_missing_banner_inactive' : 'pt_missing_banner';
    return (this.strings?.[key] ?? '').replace('{count}', String(count)).replace('{lang}', lang?.name ?? this.lang.toUpperCase());
  }

  /**
   * @description Switches the language of the edited titles.
   * @param code Language code.
   */
  switchLang(code: string): void {
    this.lang = code;
    this.cd.markForCheck();
  }

  onFocus(row: PageTitleRow): void {
    this.previewRowId = row.id;
    this.cd.markForCheck();
  }

  onInput(row: PageTitleRow): void {
    this.previewRowId = row.id;
    this.emitDirty();
    this.cd.markForCheck();
  }

  /** @description Reverts all unsaved edits to the last loaded state. */
  discard(): void {
    this.rows = this.rows.map(r => ({ ...r, title_i18n: JSON.parse(this.snapshot.get(r.id) ?? '{}') }));
    this.emitDirty();
    this.cd.markForCheck();
  }

  /** @description Sends only changed rows; the API returns the fresh list of the area. */
  save(): void {
    if (!this.canUpdate || this.saving || !this.isDirty) return;

    const payload: PageTitlesUpdatePayload = {
      titles: this.rows.filter(r => this.isRowDirty(r)).map(r => ({ id: r.id, title_i18n: r.title_i18n })),
    };

    this.saving = true;
    this.cd.markForCheck();

    this.dataHandler.put<PageTitleRow[]>(this.endpoint, payload as any).subscribe({
      next: (res: any) => {
        this.setRows(Array.isArray(res) ? res : this.rows);
        this.saving = false;
        // The orange dot of the menu / the count of the page tab follow at once.
        this.notifications.refresh();
        this.alertDialog.open(this.strings.pt_saved_title, this.strings.pt_saved_message, 'success');
        this.cd.markForCheck();
      },
      error: () => {
        // Toast already shown by DataHandler.handleError().
        this.saving = false;
        this.cd.markForCheck();
      },
    });
  }
}
