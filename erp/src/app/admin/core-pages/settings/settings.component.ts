/**
 * @file settings.component.ts
 * @path src/app/admin/core-pages/settings/settings.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Company profile (route core/settings, label "Firemní profil") in three tabs:
 *   Company details (name, IDs, contacts), Brand and texts (logo, tagline, copyright and footer
 *   text - the tagline and the copyright per language) and Social media and measuring (social
 *   links with their order, Google Analytics ID). The tab is in the address (`?tab=brand`,
 *   `?tab=social`; the company details without it).
 * @note Every tab has one Save button in the sticky header of its card; it saves only that tab.
 *   The unsaved edits of the other tabs stay in the form (the body of the company details is
 *   "stored values + this tab", settings-form.ts). A tab with unsaved edits has an amber dot.
 * @note A reload (the global "Refresh all", the background refresh, a new login) merges the loaded
 *   data into the form - a tab or a social link with unsaved edits keeps them. Saving or deleting
 *   never reloads the page; it updates the stored values from the API answer.
 * @note Leaving the page with unsaved edits asks first (unsavedTextsGuard of the route,
 *   `confirmLeave()`); closing / reloading the browser tab is asked by the browser (beforeunload).
 * @note The administration has no editable browser titles (2026-11): its tab title is a text of
 *   the admin UI (`shared.page_title_*`) with the company name - PageTitleStrategy.
 * @note Data retention (RetentionSettingsComponent, GDPR) is on the legal documents page
 *   (core/edit-legal, tab "Retence dat").
 * @dependencies
 * - BaseDataComponent: permissions, translations, alerts, the refresh hooks.
 * - ConfirmDialogService: deleting a social link, leaving with unsaved edits.
 * - ResourceCacheService: TTL cache of the languages (10 min) / settings (2 min) fetch; the
 *   settings key is invalidated after every saved change.
 * - RowButtonBuilderComponent / RowButtonItems: the page tabs and the language tabs.
 * - settings-form.ts: the fields of the tabs, unsaved-changes checks, save bodies, merges.
 */

import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { StickyBarDirective } from '../../../shared/directives/sticky-bar.directive';
import * as Core from '../../../shared/imports/core-providers';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ResourceCacheService } from '../../../core/services/resource-cache.service';
import { environment } from '../../../../environments/environment';
import { CompanyOptionalField, LangMeta, SiteSetting, SocialLink } from './';
import {
  SETTINGS_TABS, SettingsTab, TAB_TOGGLES, fieldOn, isWebUrl, mergeSocialLinks, settingsForTab,
  settingsTabDirty, socialLinkDirty, takeSavedTab,
} from './settings-form';
import { PageHeaderComponent } from '../../components/page-header/page-header.component';
import { RowButtonBuilderComponent } from '../../components/builders/row-button-builder/row-button-builder.component';
import { RowButton, RowButtonItems, languageRowButtons } from '../../components/builders/row-button-builder/row-button';
import { AdminIconName } from '../../components/admin-icon/admin-icon.component';
import { LeaveConfirmable } from '../../components/translation-editor/unsaved-texts.guard';

/** Icon types of a social network the API takes (`image` rule; SVG is refused - it can carry scripts). */
export const SOCIAL_ICON_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Image types of the logo (the `accept` of its input). */
export const LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Largest logo / social icon (bytes) - the `max:2048` rule of the API. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Format of a Google Analytics 4 measurement ID (the regex rule of the API). */
const GA_ID_PATTERN = /^G-[A-Z0-9]{6,10}$/;

/** Icon of every tab. */
const TAB_ICONS: Record<SettingsTab, AdminIconName> = { company: 'building', brand: 'image', social: 'link' };

/** Tabs that have a parameter in the address (the company details have none). */
const ADDRESS_TABS: readonly SettingsTab[] = ['brand', 'social'];

/** How long the "Uloženo" mark stays in the card header (ms). */
const SAVED_MARK_MS = 2500;

/** Answer of one request of a save (a failed one keeps its edits in the form). */
type SaveResult =
  | { kind: 'settings'; res: any; failed?: false }
  | { kind: 'social'; key: number; res: any; failed?: false }
  | { kind: 'settings' | 'social'; key?: number; failed: true };

/** @returns Empty company details (before the first load). */
function emptySettings(): SiteSetting {
  return {
    company_name: '', ico: '', dic: '',
    google_analytics_id: null,
    contact_email: '', contact_phone: '',
    address: '', footer_text: '',
    logo_path: null,
    brand_tagline: '', brand_tagline_i18n: {},
    copyright_text: '', copyright_text_i18n: {},
    hidden_fields: [],
  };
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, RowButtonBuilderComponent, StickyBarDirective],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent extends BaseDataComponent<any> implements OnInit, OnDestroy, LeaveConfirmable {
  /** `accept` of the social icon input - only the types the API takes. */
  readonly socialIconAccept = SOCIAL_ICON_TYPES.join(',');
  /** `accept` of the logo input. */
  readonly logoAccept = LOGO_TYPES.join(',');

  override apiEndpoint = 'legal/config';
  /** One settings object (no paginated list) - loaded by `refreshData()`. */
  override usesPaginatedList = false;
  protected override translationSection: string = 'settings';

  private readonly LANG_TTL_MS = 10 * 60 * 1000;
  private readonly SETTINGS_TTL_MS = 2 * 60 * 1000;
  private readonly LANG_CACHE_KEY = 'settings:languages';
  private readonly SETTINGS_CACHE_KEY = 'settings:all';

  private resourceCache = inject(ResourceCacheService);
  /** Route of the page - the open tab is its `tab` query parameter. */
  private readonly tabRoute = inject(ActivatedRoute);

  public override t(key: string): string {
    return this.i18n.getValue(`settings.${key}`);
  }

  /** Open tab - from the address. */
  activeTab: SettingsTab = 'company';

  languages: LangMeta[] = [];
  currentLang: string = 'cz';

  /** Company details in the form (what the user typed). */
  settings: SiteSetting = emptySettings();
  /** Stored company details (last load / save) - the base of the unsaved-changes checks. */
  private saved: SiteSetting = emptySettings();

  /** Label key (strings.field_*) of every optional field - order of the validation message. */
  private readonly optionalFieldLabels: Record<CompanyOptionalField, string> = {
    brand_tagline: 'field_brand_tagline',
    copyright_text: 'field_copyright_text',
    ico: 'field_ico',
    dic: 'field_dic',
    google_analytics_id: 'field_ga_label',
    contact_phone: 'field_phone',
    address: 'field_address',
    footer_text: 'field_footer_text',
  };

  /** The data were loaded at least once (a reload keeps the form on the screen). */
  loaded = false;
  /** First load running (skeletons). */
  loading = true;
  /** Tab being saved (null = none). */
  saving: SettingsTab | null = null;
  /** Tab whose card shows the "Uloženo" mark (null = none). */
  savedTab: SettingsTab | null = null;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;

  logoFile: File | null = null;
  logoPreview: string | null = null;

  socialLinks: SocialLink[] = [];
  /** Next key of a row of the social links. */
  private nextKey = 1;

  /** Stable buttons of the page tabs and of the language tabs. */
  private readonly tabButtons = new RowButtonItems();
  private readonly langButtons = new RowButtonItems();

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router,
    private confirmDialog: ConfirmDialogService
  ) {
    super(dataHandler, cd, genericTableService);
  }

  /** @description Follows the tab of the address and loads the data (initWithAuthCheck → refreshData). */
  override ngOnInit(): void {
    this.tabRoute.queryParamMap.pipe(Core.takeUntil(this.destroy$)).subscribe(params => {
      const tab = params.get('tab') as SettingsTab | null;
      this.activeTab = tab && ADDRESS_TABS.includes(tab) ? tab : 'company';
      this.cd.markForCheck();
    });
    this.initWithAuthCheck(this.router);
  }

  /** @description Frees the previews of the chosen images and the timer of the "Uloženo" mark. */
  override ngOnDestroy(): void {
    if (this.logoPreview) URL.revokeObjectURL(this.logoPreview);
    for (const link of this.socialLinks) {
      if (link._iconPreview) URL.revokeObjectURL(link._iconPreview);
    }
    if (this.savedTimer) clearTimeout(this.savedTimer);
    super.ngOnDestroy();
  }

  // ── Tabs, unsaved changes, leaving ─────────────────────────────

  /** @description Page tabs; a tab with unsaved edits has an amber dot. */
  get tabItems(): RowButton[] {
    return this.tabButtons.update(SETTINGS_TABS.map(tab => {
      const dirty = this.tabDirty(tab);
      return {
        value: tab,
        label: this.t(`tab_${tab}`),
        icon: TAB_ICONS[tab],
        dot: dirty,
        title: dirty ? this.t('tab_unsaved_title') : undefined,
      };
    }));
  }

  /**
   * @description Opens a tab through the address (a new history entry - Back returns to the
   *   previous tab). The edits of the other tabs stay in the form.
   * @param tab Tab to open.
   */
  switchTab(tab: SettingsTab): void {
    if (tab === this.activeTab) return;
    this.router.navigate([], {
      relativeTo: this.tabRoute,
      queryParams: { tab: tab === 'company' ? null : tab },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * @description Whether a tab holds unsaved edits: its fields and checkboxes, the chosen logo
   *   (brand) or a new / changed / moved social link (social).
   * @param tab Tab to check.
   * @returns True when the tab has something to save.
   */
  tabDirty(tab: SettingsTab): boolean {
    if (!this.loaded) return false;
    if (settingsTabDirty(this.settings, this.saved, tab)) return true;
    if (tab === 'brand') return !!this.logoFile;
    if (tab === 'social') return this.socialLinks.some(socialLinkDirty);
    return false;
  }

  /** @returns Whether any tab holds unsaved edits. */
  get hasUnsavedChanges(): boolean {
    return SETTINGS_TABS.some(tab => this.tabDirty(tab));
  }

  /**
   * @description Leaving the page (unsavedTextsGuard): at once without unsaved edits, otherwise
   *   after the answer of the confirmation, which names the tabs with unsaved edits.
   * @returns true = leave, false = stay; a promise while the confirmation is open.
   */
  confirmLeave(): boolean | Promise<boolean> {
    const tabs = SETTINGS_TABS.filter(tab => this.tabDirty(tab));
    if (!tabs.length) return true;
    return this.confirmDialog.open(
      this.t('leave_confirm_title'),
      this.t('leave_confirm_message').replace('{tabs}', tabs.map(tab => this.t(`tab_${tab}`)).join(', ')),
      { confirm: this.t('leave_confirm_button'), cancel: this.t('leave_stay_button') },
    );
  }

  /**
   * @description The browser asks before closing / reloading the tab with unsaved edits.
   * @param event beforeunload.
   */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  // ── Permissions ────────────────────────────────────────────────

  /** @returns May edit and save the company details and the stored social links. */
  get canUpdate(): boolean {
    return this.hasAnyPermission('core-legal-config-update');
  }

  /** @returns May add social links. */
  get canCreate(): boolean {
    return this.hasAnyPermission('core-legal-config-create');
  }

  /** @returns May delete stored social links. */
  get canDelete(): boolean {
    return this.hasAnyPermission('core-legal-config-delete');
  }

  /**
   * @description Whether the Save button of a tab is shown (the social tab also for adding only).
   * @param tab Tab of the card.
   * @returns True with the permission to save something of the tab.
   */
  canSaveTab(tab: SettingsTab): boolean {
    return tab === 'social' ? this.canUpdate || this.canCreate : this.canUpdate;
  }

  /**
   * @description Whether a social link row may be edited (a new one needs the create permission).
   * @param link Row of the form.
   * @returns True when its fields are editable.
   */
  rowEditable(link: SocialLink): boolean {
    return link._isNew ? this.canCreate : this.canUpdate;
  }

  // ── Loading ────────────────────────────────────────────────────

  /**
   * @description Loads the page data: the first time from the cache, later (the global "Refresh
   *   all", the background refresh, a new login) fresh - merged into the form without losing
   *   unsaved edits.
   */
  override refreshData(): void {
    this.load(this.loaded);
  }

  /** @description "Zkusit znovu" of a failed first load. */
  retryLoad(): void {
    this.load(true);
  }

  /**
   * @description Loads the languages and the settings.
   * @param force true = past the cache.
   */
  private load(force: boolean): void {
    if (force) {
      this.resourceCache.invalidate(this.LANG_CACHE_KEY);
      this.resourceCache.invalidate(this.SETTINGS_CACHE_KEY);
    }
    if (!this.loaded) {
      this.loading = true;
      this.errorMessage = null;
      this.cd.markForCheck();
    }

    forkJoin({
      // the switched off languages too: their texts are filled in before they are switched on
      languages: this.resourceCache.get(this.LANG_CACHE_KEY, () => this.dataHandler.get<LangMeta[]>('languages'), this.LANG_TTL_MS)
        .pipe(catchError(() => of(null))),
      config: this.resourceCache.get(this.SETTINGS_CACHE_KEY, () => this.dataHandler.get<any>('legal/config'), this.SETTINGS_TTL_MS),
    }).subscribe({
      next: ({ languages, config }) => this.applyLoaded(languages, config),
      error: () => {
        // a failed reload keeps the form; the toast came from DataHandler
        this.loading = false;
        if (!this.loaded) this.errorMessage = this.t('load_error_message');
        this.cd.markForCheck();
      },
    });
  }

  /**
   * @description Puts loaded data into the page: the stored values are replaced, the form takes
   *   the tabs without unsaved edits, the social links are merged (settings-form.ts).
   * @param languages Languages of the API (null = failed - the previous / Czech stay).
   * @param config Answer of GET legal/config ({ settings, social_links }).
   */
  private applyLoaded(languages: LangMeta[] | null, config: any): void {
    if (languages) this.languages = Array.isArray(languages) ? languages : [];
    if (!this.languages.length) this.languages = [{ code: 'cz', name: 'Čeština', active: true, isBuiltIn: true }];
    if (!this.languages.find(l => l.code === this.currentLang)) this.currentLang = this.languages[0].code;

    const dirtyTabs = SETTINGS_TABS.filter(tab => settingsTabDirty(this.settings, this.saved, tab));
    this.saved = this.normalize(config?.settings);
    let form = this.withI18nDefaults(this.settings);
    for (const tab of SETTINGS_TABS) {
      if (!dirtyTabs.includes(tab)) form = takeSavedTab(form, this.saved, tab);
    }
    this.settings = form;

    const keyOf = new Map(this.socialLinks.filter(link => !link._isNew).map(link => [link.id, link._key]));
    const loadedLinks = (config?.social_links ?? []).map((raw: any) => this.socialRow(raw, keyOf.get(raw.id)));
    this.socialLinks = mergeSocialLinks(this.socialLinks, loadedLinks);

    this.loaded = true;
    this.loading = false;
    this.errorMessage = null;
    this.cd.markForCheck();
  }

  /**
   * @description Stored company details from the API with every language present (Czech falls
   *   back to the base column, as the API keeps it).
   * @param raw `settings` of the API (null on an empty database).
   * @returns Company details.
   */
  private normalize(raw: Partial<SiteSetting> | null | undefined): SiteSetting {
    return this.withI18nDefaults({
      ...emptySettings(),
      ...(raw ?? {}),
      brand_tagline_i18n: { ...(raw?.brand_tagline_i18n ?? {}) },
      copyright_text_i18n: { ...(raw?.copyright_text_i18n ?? {}) },
      hidden_fields: [...(raw?.hidden_fields ?? [])],
    });
  }

  /**
   * @description Adds an empty text of every language missing in the translated fields.
   * @param values Company details.
   * @returns A copy with complete language maps.
   */
  private withI18nDefaults(values: SiteSetting): SiteSetting {
    const tagline = { ...(values.brand_tagline_i18n ?? {}) };
    const copyright = { ...(values.copyright_text_i18n ?? {}) };
    for (const lang of this.languages) {
      if (tagline[lang.code] === undefined) tagline[lang.code] = lang.code === 'cz' ? (values.brand_tagline ?? '') : '';
      if (copyright[lang.code] === undefined) copyright[lang.code] = lang.code === 'cz' ? (values.copyright_text ?? '') : '';
    }
    return { ...values, brand_tagline_i18n: tagline, copyright_text_i18n: copyright };
  }

  /**
   * @description Row of the form for a stored social link.
   * @param raw Link of the API.
   * @param key Key of its row (kept across reloads), a new one when missing.
   * @returns Row with its stored version.
   */
  private socialRow(raw: any, key?: number): SocialLink {
    const name = raw?.name ?? '';
    const url = raw?.url ?? '';
    const position = raw?.position ?? 0;
    return {
      id: raw?.id,
      name, url, position,
      icon_path: raw?.icon_path ?? '',
      _key: key ?? this.nextKey++,
      _saved: { name, url, position },
      _iconFile: null,
      _iconPreview: null,
      _isNew: false,
    };
  }

  // ── Languages ──────────────────────────────────────────────────

  /** @description Language tabs of the translated fields (brand tab). */
  get langItems(): RowButton[] {
    return this.langButtons.update(languageRowButtons(this.languages, { inactiveTitle: this.i18n.getValue('shared.inactive_language_title') }));
  }

  /**
   * @description Switches the language of the translated fields.
   * @param code Language code.
   */
  switchLang(code: string): void {
    if (this.currentLang === code) return;
    this.currentLang = code;
    this.cd.markForCheck();
  }

  getLangName(code: string): string {
    return this.languages.find(l => l.code === code)?.name ?? code.toUpperCase();
  }

  // ── Optional fields ────────────────────────────────────────────

  /**
   * @description Whether an optional field is switched on (shown on the public pages).
   * @param field Optional field key.
   * @returns True unless the field is in `settings.hidden_fields`.
   */
  isFieldOn(field: CompanyOptionalField): boolean {
    return fieldOn(this.settings, field);
  }

  /**
   * @description Switches an optional field on / off (checkbox next to its label).
   * @param field Optional field key.
   * @param on New state of the checkbox.
   */
  setFieldOn(field: CompanyOptionalField, on: boolean): void {
    const hidden = (this.settings.hidden_fields ?? []).filter(f => f !== field);
    this.settings = { ...this.settings, hidden_fields: on ? hidden : [...hidden, field] };
    this.cd.markForCheck();
  }

  /**
   * @description Labels of the empty required fields of a tab in the given values: company name
   *   and contact e-mail (company tab) and every switched-on optional field of the tab (an i18n
   *   field needs a text in at least one language; the GA ID also its format).
   * @param values Company details to check (the body of a save).
   * @param tab Tab whose fields are checked.
   * @returns Labels without the "*" mark; empty when everything is filled in.
   */
  missingFieldLabels(values: SiteSetting, tab: SettingsTab): string[] {
    const filled = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';
    const anyText = (texts: Record<string, string> | undefined): boolean => Object.values(texts ?? {}).some(filled);
    const label = (key: string): string => (this.strings[key] ?? key).replace(/\s*\*$/, '');

    const missing: string[] = [];
    if (tab === 'company') {
      if (!filled(values.company_name)) missing.push(label('field_company_name'));
      if (!filled(values.contact_email)) missing.push(label('field_email'));
    }
    for (const field of TAB_TOGGLES[tab]) {
      if (!fieldOn(values, field)) continue;
      if (field === 'google_analytics_id' && filled(values.google_analytics_id) && !GA_ID_PATTERN.test(values.google_analytics_id!.trim())) {
        missing.push(label('field_ga_invalid'));
        continue;
      }
      const ok = field === 'brand_tagline' ? anyText(values.brand_tagline_i18n)
        : field === 'copyright_text' ? anyText(values.copyright_text_i18n)
        : filled(values[field]);
      if (!ok) missing.push(label(this.optionalFieldLabels[field]));
    }
    return missing;
  }

  /**
   * @description Checks the body of a save: the fields of the saved tab, then the stored fields of
   *   the other tabs (the API checks the whole company details - an empty stored name blocks the
   *   save of the brand tab, for example).
   * @param body Company details to send.
   * @param tab Tab being saved.
   * @returns True when the body can be sent; otherwise a warning was shown.
   */
  private validateSettings(body: SiteSetting, tab: SettingsTab): boolean {
    const here = this.missingFieldLabels(body, tab);
    if (here.length) {
      this.alertDialogService.open(
        this.t('validation_required_title'),
        this.t('validation_required_message').replace('{fields}', here.join(', ')),
        'warning',
      );
      return false;
    }
    for (const other of SETTINGS_TABS.filter(t => t !== tab)) {
      const missing = this.missingFieldLabels(body, other);
      if (missing.length) {
        this.alertDialogService.open(
          this.t('validation_required_title'),
          this.t('validation_other_tab_message').replace('{tab}', this.t(`tab_${other}`)).replace('{fields}', missing.join(', ')),
          'warning',
        );
        return false;
      }
    }
    return true;
  }

  // ── Saving ─────────────────────────────────────────────────────

  /**
   * @description Saves one tab (the Save button in its card header): the company details of the
   *   tab (with the chosen logo on the brand tab) and the new / changed social links (social tab).
   *   The other tabs and the rest of the form stay as they are - nothing is reloaded.
   * @param tab Tab to save (the open one by default).
   */
  saveTab(tab: SettingsTab = this.activeTab): void {
    if (this.saving || !this.canSaveTab(tab)) return;

    const settingsDirty = (this.canUpdate && settingsTabDirty(this.settings, this.saved, tab)) || (tab === 'brand' && !!this.logoFile);
    const rows = tab === 'social' ? this.socialLinks.filter(link => socialLinkDirty(link) && this.rowEditable(link)) : [];
    if (!settingsDirty && !rows.length) return;

    const body = settingsForTab(this.settings, this.saved, tab);
    if (settingsDirty && !this.validateSettings(body, tab)) return;
    if (rows.length && !this.validateSocialRows(rows)) return;

    this.saving = tab;
    this.savedTab = null;
    this.cd.markForCheck();

    const requests: Observable<SaveResult>[] = [];
    if (settingsDirty) {
      requests.push(this.settingsRequest(body, tab === 'brand' ? this.logoFile : null).pipe(
        map(res => ({ kind: 'settings' as const, res })),
        catchError(() => of({ kind: 'settings' as const, failed: true as const })),
      ));
    }
    for (const row of rows) {
      const key = row._key!;
      requests.push(this.socialRequest(row).pipe(
        map(res => ({ kind: 'social' as const, key, res })),
        catchError(() => of({ kind: 'social' as const, key, failed: true as const })),
      ));
    }
    forkJoin(requests).subscribe(results => this.applySaveResults(tab, results));
  }

  /**
   * @description Request that saves the company details (multipart with a logo, JSON otherwise).
   * @param body Company details to send.
   * @param logo Chosen logo file, or null.
   * @returns Stored company details of the API.
   */
  private settingsRequest(body: SiteSetting, logo: File | null): Observable<SiteSetting> {
    if (logo) {
      const fd = new FormData();
      fd.append('company_name', body.company_name ?? '');
      fd.append('brand_tagline_i18n', JSON.stringify(body.brand_tagline_i18n ?? {}));
      fd.append('copyright_text_i18n', JSON.stringify(body.copyright_text_i18n ?? {}));
      fd.append('ico', body.ico ?? '');
      fd.append('dic', body.dic ?? '');
      fd.append('google_analytics_id', body.google_analytics_id ?? '');
      fd.append('contact_email', body.contact_email ?? '');
      fd.append('contact_phone', body.contact_phone ?? '');
      fd.append('address', body.address ?? '');
      fd.append('footer_text', body.footer_text ?? '');
      fd.append('hidden_fields', JSON.stringify(body.hidden_fields ?? []));
      fd.append('logo_file', logo, logo.name);
      fd.append('_method', 'PUT');
      return this.dataHandler.upload<SiteSetting>('legal/config/settings', fd);
    }
    return this.dataHandler.put<SiteSetting>('legal/config/settings', {
      company_name: body.company_name,
      brand_tagline_i18n: body.brand_tagline_i18n ?? {},
      copyright_text_i18n: body.copyright_text_i18n ?? {},
      ico: body.ico,
      dic: body.dic,
      google_analytics_id: body.google_analytics_id || null,
      contact_email: body.contact_email,
      contact_phone: body.contact_phone,
      address: body.address,
      footer_text: body.footer_text,
      hidden_fields: body.hidden_fields ?? [],
    } as any);
  }

  /**
   * @description Request that saves one social link (multipart for a new one or a new icon).
   * @param link Row of the form.
   * @returns Stored link of the API.
   */
  private socialRequest(link: SocialLink): Observable<SocialLink> {
    if (link._isNew || link._iconFile) {
      const fd = new FormData();
      fd.append('name', link.name.trim());
      fd.append('url', link.url.trim());
      fd.append('position', String(link.position));
      if (link._iconFile) fd.append('icon_file', link._iconFile, link._iconFile.name);
      return link._isNew
        ? this.dataHandler.upload<SocialLink>('legal/config/social', fd)
        : this.dataHandler.uploadPut<SocialLink>(`legal/config/social/${link.id}`, fd);
    }
    return this.dataHandler.put<SocialLink>(`legal/config/social/${link.id}`, {
      name: link.name.trim(),
      url: link.url.trim(),
      position: link.position,
      icon_path: link.icon_path,
    } as any);
  }

  /**
   * @description Puts the answers of a save into the page: stored values of the saved parts, the
   *   form of the saved tab; failed parts keep their edits (the toast came from DataHandler).
   * @param tab Saved tab.
   * @param results Answers of the requests.
   */
  private applySaveResults(tab: SettingsTab, results: SaveResult[]): void {
    let allSaved = true;
    for (const result of results) {
      if (result.failed) {
        allSaved = false;
        continue;
      }
      if (result.kind === 'settings') {
        this.saved = this.normalize(result.res);
        this.settings = this.withI18nDefaults(takeSavedTab(this.settings, this.saved, tab));
        if (tab === 'brand') this.cancelLogoSelection();
      } else {
        this.socialLinks = this.socialLinks.map(link => {
          if (link._key !== result.key) return link;
          if (link._iconPreview) URL.revokeObjectURL(link._iconPreview);
          return this.socialRow(result.res, link._key);
        });
      }
    }

    this.saving = null;
    this.resourceCache.invalidate(this.SETTINGS_CACHE_KEY);
    if (allSaved) this.showSavedMark(tab);
    this.cd.markForCheck();
  }

  /**
   * @description Shows the "Uloženo" mark in the card header of a tab for a while.
   * @param tab Saved tab.
   */
  private showSavedMark(tab: SettingsTab): void {
    this.savedTab = tab;
    if (this.savedTimer) clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => {
      this.savedTab = null;
      this.savedTimer = null;
      this.cd.markForCheck();
    }, SAVED_MARK_MS);
  }

  // ── Logo ───────────────────────────────────────────────────────

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      this.alertDialogService.open(this.t('logo_too_large_title'), this.t('logo_too_large_message'), 'warning');
      input.value = '';
      return;
    }
    if (!LOGO_TYPES.includes(file.type)) {
      this.alertDialogService.open(this.t('logo_invalid_format_title'), this.t('logo_invalid_format_message'), 'warning');
      input.value = '';
      return;
    }

    if (this.logoPreview) URL.revokeObjectURL(this.logoPreview);
    this.logoFile = file;
    this.logoPreview = URL.createObjectURL(file);
    // the same file can be chosen again after "Zrušit výběr"
    input.value = '';
    this.cd.markForCheck();
  }

  cancelLogoSelection(): void {
    if (this.logoPreview) URL.revokeObjectURL(this.logoPreview);
    this.logoFile = null;
    this.logoPreview = null;
    this.cd.markForCheck();
  }

  get logoSrc(): string | null {
    if (this.logoPreview) return this.logoPreview;
    if (this.settings.logo_path) return environment.public_storage_url + `/${this.settings.logo_path}`;
    return null;
  }

  get hasLogo(): boolean {
    return !!(this.logoPreview || this.settings.logo_path);
  }

  // ── Social links ───────────────────────────────────────────────

  /** @description Adds an empty row at the end and moves the focus to its name. */
  addSocialLink(): void {
    const key = this.nextKey++;
    const position = this.socialLinks.reduce((max, link) => Math.max(max, link.position), 0) + 1;
    this.socialLinks = [...this.socialLinks, {
      name: '', url: '', icon_path: '', position,
      _key: key,
      _saved: null,
      _iconFile: null,
      _iconPreview: null,
      _isNew: true,
    }];
    this.cd.markForCheck();

    setTimeout(() => {
      document.getElementById(`social-row-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (document.getElementById(`social-name-${key}`) as HTMLInputElement | null)?.focus({ preventScroll: true });
    }, 60);
  }

  /**
   * @description Moves a social link up / down; the positions are numbered again in the order of
   *   the list (the moved rows wait for Save).
   * @param index Row index.
   * @param delta -1 = up, 1 = down.
   */
  moveSocialLink(index: number, delta: -1 | 1): void {
    const target = index + delta;
    if (target < 0 || target >= this.socialLinks.length) return;
    const rows = [...this.socialLinks];
    [rows[index], rows[target]] = [rows[target], rows[index]];
    this.socialLinks = rows.map((link, i) => link.position === i + 1 ? link : { ...link, position: i + 1 });
    this.cd.markForCheck();
  }

  onIconSelected(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      this.alertDialogService.open(this.t('logo_too_large_title'), this.t('social_icon_too_large_message'), 'warning');
      input.value = '';
      return;
    }
    if (!SOCIAL_ICON_TYPES.includes(file.type)) {
      this.alertDialogService.open(this.t('logo_invalid_format_title'), this.t('social_icon_invalid_format_message'), 'warning');
      input.value = '';
      return;
    }
    const updated = [...this.socialLinks];
    if (updated[index]._iconPreview) URL.revokeObjectURL(updated[index]._iconPreview!);
    updated[index] = { ...updated[index], _iconFile: file, _iconPreview: URL.createObjectURL(file) };
    this.socialLinks = updated;
    input.value = '';
    this.cd.markForCheck();
  }

  /**
   * @description Whether a typed address of a link is not a web address (shown under the field).
   * @param link Row of the form.
   * @returns True for a filled-in, invalid address.
   */
  urlInvalid(link: SocialLink): boolean {
    return !!link.url?.trim() && !isWebUrl(link.url);
  }

  /**
   * @description Checks the rows to save: a name and a full web address in each.
   * @param rows Rows to save.
   * @returns True when all can be sent; otherwise a warning was shown.
   */
  private validateSocialRows(rows: SocialLink[]): boolean {
    if (rows.some(row => !row.name?.trim())) {
      this.alertDialogService.open(this.t('social_validation_title'), this.t('social_validation_name_message'), 'warning');
      return false;
    }
    if (rows.some(row => !isWebUrl(row.url))) {
      this.alertDialogService.open(this.t('social_validation_title'), this.t('social_validation_url_message'), 'warning');
      return false;
    }
    return true;
  }

  /**
   * @description Removes a social link: a new row at once, a stored one after a confirmation
   *   (deleted on the server). The other rows keep their unsaved edits.
   * @param index Row index.
   */
  async deleteSocialLink(index: number): Promise<void> {
    const link = this.socialLinks[index];
    if (!link) return;

    if (link._isNew) {
      if (link._iconPreview) URL.revokeObjectURL(link._iconPreview);
      this.socialLinks = this.socialLinks.filter(row => row._key !== link._key);
      this.cd.markForCheck();
      return;
    }

    const name = link._saved?.name || link.name;
    const confirmed = await this.confirmDialog.open(
      this.t('social_delete_confirm_title'),
      this.t('social_delete_confirm_message').replace('{name}', name)
    );
    if (!confirmed) return;

    this.dataHandler.delete(`legal/config/social/${link.id}`).subscribe({
      next: () => {
        const removed = this.socialLinks.find(row => row._key === link._key);
        if (removed?._iconPreview) URL.revokeObjectURL(removed._iconPreview);
        this.socialLinks = this.socialLinks.filter(row => row._key !== link._key);
        this.resourceCache.invalidate(this.SETTINGS_CACHE_KEY);
        this.alertDialogService.open(this.t('social_deleted_title'), this.t('social_deleted_message').replace('{name}', name), 'success');
        this.cd.markForCheck();
      }
    });
  }

  iconSrc(link: SocialLink): string | null {
    if (link._iconPreview) return link._iconPreview;
    if (link.icon_path) return environment.public_storage_url + `/${link.icon_path}`;
    return null;
  }

  /**
   * @description Whether a row of the social links waits for Save (amber edge of the row).
   * @param link Row of the form.
   * @returns True for a changed stored row (new rows have their own green look).
   */
  rowDirty(link: SocialLink): boolean {
    return !link._isNew && socialLinkDirty(link);
  }
}
