/**
 * @file page-titles-editor.component.ts
 * @path src/app/admin/components/page-titles-editor/page-titles-editor.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Editor of the browser page titles (<title>, the headline in search results) of
 * ONE area. Every module manages its own pages: web/edit-website (area 'web'), shop/edit-eshop
 * (area 'shop') and core/web-settings (area 'admin') - removing a module from a branched
 * application removes its page titles with it. Languages of the area's module, a live browser
 * tab preview, one input per page; only changed rows are saved.
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
 * - PermissionService: the update permission.
 * - AdminLocalizationService, AlertDialogService.
 */

import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DataHandler } from '../../../core/services/data-handler.service';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { PermissionService } from '../../../core/auth/services/permission.service';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { AlertDialogService } from '../../../core/services/alert-dialog.service';
import { environment } from '../../../../environments/environment';
import { PageTitleArea, PageTitleLang, PageTitleRow, PageTitlesUpdatePayload } from './page-titles.model';

/** @description Languages when the module has none (or they cannot be loaded). */
const FALLBACK_LANGUAGES: PageTitleLang[] = [{ code: 'cz', name: 'Čeština', active: true, isBuiltIn: true }];

@Component({
  selector: 'app-page-titles-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  public readonly i18n = inject(AdminLocalizationService);

  /** @description Generic texts (section `page-titles` + shared). */
  get strings(): any {
    return this.i18n.getMergedSection('page-titles');
  }

  ngOnInit(): void {
    this.load();
  }

  /** @description Loads the languages of the area's module, its rows and (if needed) the logo. */
  private load(): void {
    this.loading = true;
    this.loadError = false;
    this.cd.markForCheck();

    forkJoin({
      langs: this.loadLanguages(this.area === 'shop' ? 'shop' : 'web'),
      fallback: this.area === 'shop' ? this.loadLanguages('web') : of([] as PageTitleLang[]),
      data: this.dataHandler.get<PageTitleRow[]>(this.endpoint),
      logo: this.logoSrc === undefined ? this.loadPublicLogo() : of(null),
    }).subscribe({
      next: ({ langs, fallback, data, logo }) => {
        this.languages = langs.length ? langs : (fallback.length ? fallback : FALLBACK_LANGUAGES);
        if (!this.languages.find(l => l.code === this.lang)) this.lang = this.languages[0].code;
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
   * @description Active languages of a public module; a failure = empty list (fallback above).
   * @param module 'web' or 'shop'.
   */
  private loadLanguages(module: 'web' | 'shop'): Observable<PageTitleLang[]> {
    return this.resourceCache.get(
      `page-titles:languages:${module}`,
      () => this.dataHandler.get<PageTitleLang[]>(`languages/${module}`),
      this.LANG_TTL_MS
    ).pipe(
      map((res: any) => ((Array.isArray(res) ? res : []) as PageTitleLang[]).filter(l => l.active !== false)),
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
