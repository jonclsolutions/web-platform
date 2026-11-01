/**
 * @file user-request.component.ts
 * @path src/app/admin/web-pages/user-request/user-request.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Administrative component for managing user-submitted requests (raw commissions), handling data lifecycle, filtering, and detail views.
 * @dependencies
 * - BaseDataComponent: Core logic for API interactions and state management.
 * - TableBuilderComponent: UI component for rendering the request data tables and handling CSV exports and imports.
 * - ActionMenuBuilderComponent: Dropdown ("Actions") rendering the `toolbarButtons` config.
 * - GraphBuilderComponent: Generic date-range analytics/report popup (charts + PDF export).
 * - USER_REQUEST Config: Domain-specific definitions for form fields, table columns, and button configurations.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './user-request.config';

/** One language from `GET languages/{module}` - the same shape as used by WebSettingsComponent. */
interface EmailTemplateLang {
  code: string;
  name: string;
  active?: boolean;
}

/** Labels and fixed texts of the template, editable per language (see raw_request_email_labels_i18n). */
interface EmailTemplateLabels {
  greeting: string;
  summary_header: string;
  label_thema: string;
  label_email: string;
  label_phone: string;
  label_description: string;
  label_attachments: string;
  label_date: string;
}

/** i18n text content of the editable confirmation e-mail template. */
interface EmailTemplateState {
  subject_i18n: Record<string, string>;
  title_i18n: Record<string, string>;
  intro_i18n: Record<string, string>;
  outro_i18n: Record<string, string>;
  labels_i18n: Record<string, Partial<EmailTemplateLabels>>;
}

/**
 * @description Manages the administration of user request commissions.
 * @usage Enables staff to monitor, edit, and audit incoming raw requests from the frontend.
 * @note Implements standard CRUD operations while utilizing custom configurations for display and interaction logic.
 */
@Component({
  selector: 'app-user-request',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, FormsModule, ActionMenuBuilderComponent, GraphBuilderComponent],
  templateUrl: './user-request.component.html',
  styleUrls: ['../../shared-styles/page.css', '../shared-styles/page.css', './email-template-modal.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserRequestComponent extends BaseDataComponent<any> implements Core.OnInit {
  protected override translationSection: string = 'user-request';

  public override t(key: string): string {
    return this.i18n.getValue(`user-request.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'web/raw_request_commissions';

  userRequestColumns: Core.ColumnDefinition[] = [];
  trashUserRequestColumns: Core.ColumnDefinition[] = [];

  // ── Confirmation e-mail template (modal) ──────────────────────────────
  showEmailTemplateModal = false;
  emailTemplateLoading = false;
  emailTemplateSaving = false;
  emailTemplateLanguages: EmailTemplateLang[] = [];
  emailTemplateCurrentLang = 'cz';
  emailTemplate: EmailTemplateState = { subject_i18n: {}, title_i18n: {}, intro_i18n: {}, outro_i18n: {}, labels_i18n: {} };

  /**
   * Default texts of the template - MUST match the constants of
   * `App\Support\Mail\RawRequestEmailTemplate` (backend) exactly. Used as (1) placeholders of
   * empty fields and (2) the fallback of the live preview when the admin filled in nothing for
   * the language (nor for 'cz') - the same logic as the really sent e-mail.
   * @note A getter is fine here (NOT an array) - a flat object of primitives, not an array of
   * objects read through `@for` / `track`, so no NG0956 risk.
   */
  private get emailTemplateDefaults() {
    return {
      subject: this.t('email_tpl_default_subject'),
      title: this.t('email_tpl_default_title'),
      intro: this.t('email_tpl_default_intro'),
      outro: this.t('email_tpl_default_outro'),
      greeting: this.t('email_tpl_default_greeting'),
      summaryHeader: this.t('email_tpl_default_summary_header'),
      labelThema: this.t('email_tpl_default_label_thema'),
      labelEmail: this.t('email_tpl_default_label_email'),
      labelPhone: this.t('email_tpl_default_label_phone'),
      labelDescription: this.t('email_tpl_default_label_description'),
      labelAttachments: this.t('email_tpl_default_label_attachments'),
      labelDate: this.t('email_tpl_default_label_date'),
    };
  }

  /**
   * @description Fictional recap data for the live e-mail preview in the template
   * editor modal - never sent or stored anywhere, it only fills the summary block so
   * the admin sees the whole e-mail. Translatable values come from the admin i18n
   * (`thema` reuses the real `thema_new_project` label), the rest is language-neutral.
   */
  private readonly previewSampleAttachments: readonly string[] = ['brief.pdf', 'logo.png'];

  get emailTemplatePreviewSample() {
    return {
      thema: this.t('thema_new_project'),
      email: 'customer@example.com',
      phone: '+420 123 456 789',
      description: this.t('email_tpl_preview_description'),
      attachments: this.previewSampleAttachments,
      date: new Date(2026, 7, 21, 15, 32).toLocaleString(this.i18n.getDateLocale(), {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }),
    };
  }

  /**
   * @description Chartable subset of `detailsColumns` mapped to the minimal shape
   * `GraphBuilderComponent` needs.
   * @note A getter is fine - GraphBuilderComponent checks "same key set = same collection" in
   * `ngOnChanges()` (see `sameColumnKeySet()`), so a new array reference does NOT cause a
   * needless re-render.
   */
  get graphColumns(): GraphColumnOption[] {
    return this.detailsColumns
      .filter(col => col.chartable === true)
      .map(col => ({
        key: col.key,
        label: col.displayName,
        aggregation: col.chartAggregation ?? 'count',
        possibleValues: col.chartPossibleValues
      }));
  }

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createUserRequestButtons(this.i18n);
      this.formFields = Config.createUserRequestFormFields(this.i18n);
      this.userRequestColumns = Config.createUserRequestColumns(this.i18n);
      this.trashUserRequestColumns = Config.createUserRequestTrashColumns(this.i18n);
      this.filterColumns = Config.createUserRequestFilterColumns(this.i18n);
      this.detailsColumns = Config.createUserRequestDetailsColumns(this.i18n);
      this.cd.markForCheck();
    });
  }

  /**
   * @description Dynamically generates toolbar button definitions based on user permissions and component state (e.g., active vs. trash table view).
   * @returns Array of button objects with applied logic for visibility and state labeling.
   */
  get toolbarButtons(): Core.Button[] {
    return Config.createUserRequestToolbarButtons(this.i18n).map(btn => {
      let updatedBtn = { ...btn };

      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }

      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible
            ? this.t('toolbar_hide_filters')
            : this.t('toolbar_filters');
          updatedBtn.isActive = this.isFilterVisible;
          break;
        case 'handleCreateFormOpened':
        case 'exportActiveTable':
        case 'triggerImport':
          if (updatedBtn.showIf !== false) {
            updatedBtn.showIf = !this.showTrashTable;
          }
          break;
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable
            ? this.t('toolbar_show_active')
            : this.t('toolbar_show_trash');
          updatedBtn.isActive = this.showTrashTable;
          break;
      }

      return updatedBtn;
    });
  }

  /**
   * @description Maps incoming action strings from the toolbar to their corresponding component methods.
   * @param action The unique action key from the button configuration.
   */
  override handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      handleCreateFormOpened: () => this.handleCreateFormOpened(),
      exportActiveTable: () => this.exportActiveTable(),
      triggerImport: () => this.activeTable?.importData(),
      openEmailTemplateEditor: () => this.openEmailTemplateEditor(),
      openGraphBuilder: () => this.openGraphBuilder(),
      toggleTable: () => this.toggleTable()
    };
    if (actions[action]) actions[action]();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
  }

  override refreshData(): void {
    this.forceFullRefresh(this.filters);
  }

  /**
   * @description Processes form submission, routing to either create or update API endpoints based on entity ID presence.
   * @param formData The data object derived from the form interaction.
   */
  override handleFormSubmitted(formData: any): void {
    const request$ = formData.id
      ? this.updateData(formData.id, formData)
      : this.postData(formData);

    request$.pipe(
      Core.finalize(() => {
        this.showCreateForm = false;
        this.cd.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.alertDialogService.open(this.t('crud_success_title'), formData.id ? this.t('crud_updated_message') : this.t('crud_created_message'), 'success');
        this.refreshData();
      }
    });
  }

  // ── Confirmation e-mail template (modal) ──────────────────────────────

  /**
   * @description Opens the modal for editing the confirmation e-mail template. Loads
   * independently (1) the available languages (`languages/web`, the same module as
   * WebSettingsComponent) and (2) the stored texts (`GET web/settings/raw-request-email-template`).
   * No TTL cache - the modal is opened occasionally, a fresh fetch on every open is fine.
   */
  openEmailTemplateEditor(): void {
    this.showEmailTemplateModal = true;
    this.emailTemplateLoading = true;
    this.cd.markForCheck();

    this.dataHandler.get<EmailTemplateLang[]>('languages/web').subscribe({
      next: (res) => {
        this.emailTemplateLanguages = (Array.isArray(res) ? res : []).filter(l => l.active !== false);
        if (
          this.emailTemplateLanguages.length > 0 &&
          !this.emailTemplateLanguages.find(l => l.code === this.emailTemplateCurrentLang)
        ) {
          this.emailTemplateCurrentLang = this.emailTemplateLanguages[0].code;
        }
        this.emailTemplateLanguages.forEach(l => this.ensureLabelsForLang(l.code));
        this.ensureLabelsForLang(this.emailTemplateCurrentLang);
        this.cd.markForCheck();
      },
      error: () => {
        // Non-blocking - without the language list at least the default 'cz' tab works.
        // The name of the language itself (e.g. 'Čeština') is NOT translated.
        this.emailTemplateLanguages = [{ code: 'cz', name: 'Čeština' }];
        this.ensureLabelsForLang('cz');
        this.cd.markForCheck();
      }
    });

    this.dataHandler.get<any>('web/settings/raw-request-email-template').subscribe({
      next: (template) => {
        this.emailTemplate = {
          subject_i18n: template?.raw_request_email_subject_i18n ?? {},
          title_i18n: template?.raw_request_email_title_i18n ?? {},
          intro_i18n: template?.raw_request_email_intro_i18n ?? {},
          outro_i18n: template?.raw_request_email_outro_i18n ?? {},
          labels_i18n: template?.raw_request_email_labels_i18n ?? {},
        };
        this.ensureLabelsForLang(this.emailTemplateCurrentLang);
        this.emailTemplateLoading = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.emailTemplateLoading = false;
        this.cd.markForCheck();
      }
    });
  }

  /**
   * @description Ensures `emailTemplate.labels_i18n[lang]` is always a real object (not
   * `undefined`) BEFORE the template binds `[(ngModel)]` to a nested property
   * (`labels_i18n[lang].greeting` etc.) - otherwise reading / writing a property of
   * `undefined` would throw at runtime. Called when the languages load, when the template loads
   * and on a tab switch - regardless of the order in which the two parallel HTTP requests above
   * arrive.
   */
  private ensureLabelsForLang(lang: string): void {
    if (!this.emailTemplate.labels_i18n[lang]) {
      this.emailTemplate.labels_i18n[lang] = {};
    }
  }

  /** @description Switches the language tab of the template modal - only the shown language changes. */
  switchEmailTemplateLang(code: string): void {
    this.ensureLabelsForLang(code);
    this.emailTemplateCurrentLang = code;
    this.cd.markForCheck();
  }

  closeEmailTemplateEditor(): void {
    if (this.emailTemplateSaving) return;
    this.showEmailTemplateModal = false;
  }

  /**
   * @description Saves the confirmation e-mail template. The endpoint deliberately has NO
   * `confirm_password` (unlike the maintenance toggle) - editing the e-mail text is not a
   * security sensitive action, only the `web-user-requests-update` permission on the route.
   */
  saveEmailTemplate(): void {
    if (this.emailTemplateSaving) return;
    this.emailTemplateSaving = true;
    this.cd.markForCheck();

    const payload = {
      raw_request_email_subject_i18n: this.emailTemplate.subject_i18n,
      raw_request_email_title_i18n: this.emailTemplate.title_i18n,
      raw_request_email_intro_i18n: this.emailTemplate.intro_i18n,
      raw_request_email_outro_i18n: this.emailTemplate.outro_i18n,
      raw_request_email_labels_i18n: this.emailTemplate.labels_i18n,
    };

    this.dataHandler.put<any>('web/settings/raw-request-email-template', payload).subscribe({
      next: () => {
        this.emailTemplateSaving = false;
        this.showEmailTemplateModal = false;
        this.alertDialogService.open(this.t('email_tpl_saved_title'), this.t('email_tpl_saved_message'), 'success');
        this.cd.markForCheck();
      },
      error: () => {
        this.emailTemplateSaving = false;
        this.cd.markForCheck();
      }
    });
  }

  // ── Live e-mail preview ─────────────────────────────────────────────────
  // Getters read directly by the modal template - Angular re-evaluates them on every
  // change detection (an OnPush component is also checked on its own DOM events,
  // i.e. on (ngModelChange) of the inputs above), so the preview reacts to every keystroke
  // without anything else (no debounce, no HTTP request). The fallback logic
  // mirrors `RawRequestEmailTemplate::resolve()` / `resolveLabel()` of the backend 1:1 -
  // the preview matches exactly what the customer receives.

  private get currentEmailLabels(): Partial<EmailTemplateLabels> {
    return this.emailTemplate.labels_i18n[this.emailTemplateCurrentLang] || {};
  }

  get previewSubject(): string {
    return this.emailTemplate.subject_i18n[this.emailTemplateCurrentLang] || this.emailTemplateDefaults.subject;
  }
  get previewTitle(): string {
    return this.emailTemplate.title_i18n[this.emailTemplateCurrentLang] || this.emailTemplateDefaults.title;
  }
  get previewIntro(): string {
    return this.emailTemplate.intro_i18n[this.emailTemplateCurrentLang] || this.emailTemplateDefaults.intro;
  }
  get previewOutro(): string {
    return this.emailTemplate.outro_i18n[this.emailTemplateCurrentLang] || this.emailTemplateDefaults.outro;
  }
  get previewGreeting(): string {
    return this.currentEmailLabels.greeting || this.emailTemplateDefaults.greeting;
  }
  get previewSummaryHeader(): string {
    return this.currentEmailLabels.summary_header || this.emailTemplateDefaults.summaryHeader;
  }
  get previewLabelThema(): string {
    return this.currentEmailLabels.label_thema || this.emailTemplateDefaults.labelThema;
  }
  get previewLabelEmail(): string {
    return this.currentEmailLabels.label_email || this.emailTemplateDefaults.labelEmail;
  }
  get previewLabelPhone(): string {
    return this.currentEmailLabels.label_phone || this.emailTemplateDefaults.labelPhone;
  }
  get previewLabelDescription(): string {
    return this.currentEmailLabels.label_description || this.emailTemplateDefaults.labelDescription;
  }
  get previewLabelAttachments(): string {
    return this.currentEmailLabels.label_attachments || this.emailTemplateDefaults.labelAttachments;
  }
  get previewLabelDate(): string {
    return this.currentEmailLabels.label_date || this.emailTemplateDefaults.labelDate;
  }

}