/**
 * @file sales-orders.component.ts
 * @path src/app/admin/web-pages/sales-orders/sales-orders.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Administrative component for managing sales orders, providing capabilities for status tracking, detail viewing, and data export.
 * @dependencies
 * - BaseDataComponent: Standardized CRUD and state management.
 * - TableBuilderComponent: Handling tabular views and CSV exports.
 * - Config.create* factory functions: Domain-specific, i18n-aware definitions for UI
 *   columns, form fields, and toolbar actions.
 * - EmailTemplateEditorComponent: modal editor of the order confirmation e-mail (sent in the
 *   language of the page, VT-15).
 * @note `createProject(item)` is only a navigation to ProjectsComponent with the `order_id` /
 * `open_project` query parameter - no own API call here.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './sales-orders.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';
import { EmailTemplateEditorComponent, EmailTemplateRow } from '../../components/email-template-editor/email-template-editor.component';
import { PageHelpComponent } from '../../components/page-help/page-help.component';

/**
 * @description Manages the lifecycle and administrative view of sales orders.
 * @usage Provides a data-driven interface to review order submissions, edit order details, and export reports via CSV.
 * @note Extends BaseDataComponent to maintain consistent API interactions and UI states across the web administration module.
 */
@Component({
  selector: 'app-sales-orders',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent, GraphBuilderComponent, EmailTemplateEditorComponent, PageHelpComponent],
  templateUrl: './sales-orders.component.html',
  styleUrls: ['../../shared-styles/page.css', '../shared-styles/page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SalesOrdersComponent extends BaseDataComponent<any> implements Core.OnInit {

  protected override translationSection: string = 'sales-orders';

  public override t(key: string): string {
    return this.i18n.getValue(`sales-orders.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'web/sales_orders';

  columns: Core.ColumnDefinition[] = [];
  trashColumns: Core.ColumnDefinition[] = [];

  graphColumns: GraphColumnOption[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createSalesOrderButtons(this.i18n);
      this.formFields = Config.createSalesOrderFormFields(this.i18n);
      this.columns = Config.createSalesOrderColumns(this.i18n);
      this.trashColumns = Config.createSalesOrderTrashColumns(this.i18n);
      this.filterColumns = Config.createSalesOrderFilterColumns(this.i18n);
      this.detailsColumns = Config.createSalesOrderDetailsColumns(this.i18n);
      this.graphColumns = this.detailsColumns
        .filter(col => col.chartable === true)
        .map(col => ({
          key: col.key,
          label: col.displayName,
          aggregation: col.chartAggregation ?? 'count',
          possibleValues: col.chartPossibleValues,
        }));
      this.cd.markForCheck();
    });
  }

  // ── Confirmation e-mail template (modal, EmailTemplateEditorComponent) ──
  showEmailTemplateModal = false;
  /** Rows of the summary table of the order e-mail with the preview sample values. */
  emailTemplateRows: EmailTemplateRow[] = [];

  /**
   * @description Opens the template editor of the order confirmation with its summary rows and
   * a fictional sample order for the preview (never sent or stored; the date in the admin locale).
   */
  openEmailTemplateEditor(): void {
    const date = new Date(2026, 7, 21, 15, 32).toLocaleString(this.i18n.getDateLocale(), {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    this.emailTemplateRows = [
      { key: 'label_name', sample: 'Acme s.r.o.' },
      { key: 'label_ico', sample: '12345678' },
      { key: 'label_email', sample: 'customer@example.com' },
      { key: 'label_phone', sample: '+420 123 456 789' },
      { key: 'label_address', sample: this.t('email_tpl_preview_address') },
      { key: 'label_description', sample: this.t('email_tpl_preview_description') },
      { key: 'label_attachments', sample: 'brief.pdf, logo.png' },
      { key: 'label_date', sample: date },
    ];
    this.showEmailTemplateModal = true;
    this.cd.markForCheck();
  }

  /** @description Closes the template editor. */
  closeEmailTemplateEditor(): void {
    this.showEmailTemplateModal = false;
    this.cd.markForCheck();
  }

  get toolbarButtons(): Core.Button[] {
    return Config.createSalesOrderToolbarButtons(this.i18n).map(btn => {
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
        case 'exportActiveTable':
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

  override handleToolbarAction(action: string): void {
    const actions: { [key: string]: () => void } = {
      toggleFilters: () => this.toggleFilters(),
      exportActiveTable: () => this.exportActiveTable(),
      openGraphBuilder: () => this.openGraphBuilder(),
      openEmailTemplateEditor: () => this.openEmailTemplateEditor(),
      toggleTable: () => this.toggleTable(),
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

  createProject(item: any): void {
    if (!item?.id) return;
    if (item.project_id) {
      this.router.navigate(['/admin/web/projects', item.project_id]);
    } else {
      this.router.navigate(['/admin/web/projects'], { queryParams: { order_id: item.id } });
    }
  }

  override handleFormSubmitted(formData: any): void {
    this.updateData(formData.id, formData).pipe(
      Core.finalize(() => {
        this.showCreateForm = false;
        this.cd.markForCheck();
      })
    ).subscribe({
      next: () => {
        this.alertDialogService.open(
          this.i18n.getValue('shared.success'),
          this.t('crud_updated_message'),
          'success'
        );
        this.refreshData();
      }
    });
  }

}