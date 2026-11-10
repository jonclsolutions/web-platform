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
 * - EmailTemplateEditorComponent: modal editor of the confirmation e-mail template.
 * - USER_REQUEST Config: Domain-specific definitions for form fields, table columns, and button configurations.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { EmailTemplateEditorComponent, EmailTemplateRow } from '../../components/email-template-editor/email-template-editor.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './user-request.config';
import { PageHelpComponent } from '../../components/page-help/page-help.component';

/**
 * @description Manages the administration of user request commissions.
 * @usage Enables staff to monitor, edit, and audit incoming raw requests from the frontend.
 * @note Implements standard CRUD operations while utilizing custom configurations for display and interaction logic.
 */
@Component({
  selector: 'app-user-request',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent, GraphBuilderComponent, EmailTemplateEditorComponent, PageHelpComponent],
  templateUrl: './user-request.component.html',
  styleUrls: ['../../shared-styles/page.css', '../shared-styles/page.css'],
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

  // ── Confirmation e-mail template (modal, EmailTemplateEditorComponent) ──
  showEmailTemplateModal = false;
  /** Rows of the summary table of the inquiry e-mail with the preview sample values. */
  emailTemplateRows: EmailTemplateRow[] = [];
  /** Preview subject suffix - the real subject ends with ' – <topic>'. */
  emailTemplateSubjectSuffix = '';

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
   * @description Opens the template editor with the summary rows of the inquiry e-mail and a
   * fictional sample request for the preview (never sent or stored; the topic reuses the real
   * `thema_new_project` label, the date is in the admin locale).
   */
  openEmailTemplateEditor(): void {
    const thema = this.t('thema_new_project');
    const date = new Date(2026, 7, 21, 15, 32).toLocaleString(this.i18n.getDateLocale(), {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    this.emailTemplateRows = [
      { key: 'label_thema', sample: thema },
      { key: 'label_email', sample: 'customer@example.com' },
      { key: 'label_phone', sample: '+420 123 456 789' },
      { key: 'label_description', sample: this.t('email_tpl_preview_description') },
      { key: 'label_attachments', sample: 'brief.pdf, logo.png' },
      { key: 'label_date', sample: date },
    ];
    this.emailTemplateSubjectSuffix = ` – ${thema}`;
    this.showEmailTemplateModal = true;
    this.cd.markForCheck();
  }

  /** @description Closes the template editor. */
  closeEmailTemplateEditor(): void {
    this.showEmailTemplateModal = false;
    this.cd.markForCheck();
  }

}