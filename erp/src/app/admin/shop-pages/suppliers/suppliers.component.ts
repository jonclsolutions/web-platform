/**
 * @file suppliers.component.ts
 * @path src/app/admin/shop-pages/suppliers/suppliers.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the administration of store suppliers, including CRUD operations, archive management, and data filtering.
 * @dependencies
 * - BaseDataComponent: Provides the base logic for API interactions, pagination, and entity state management.
 * - TableBuilderComponent: Used for displaying supplier data and handling CSV exports.
 * - Config.create* factory functions: i18n-aware definitions - viz refactor-note
 *   (2026-09-09) níže.
 *
 * (Earlier bugfix-note 2026-08-31 for duplicate error toasts is unchanged.)
 *
 * @refactor-note (2026-09-09) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `Config.SUPPLIER_*` konstanty nahrazeny `Config.create*()` factory funkcemi.
 * `graphColumns` přestalo být `readonly`. `'Úspěch'`/`'Požadavek byl upraven.'`/
 * `'Požadavek byl vytvořen.'` (dřív natvrdo česky) nahrazeny `t()` voláním.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './suppliers.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent, GraphBuilderComponent],
  templateUrl: './suppliers.component.html',
  styleUrls: ['../../shared-styles/page.css', '../shared-styles/page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SuppliersComponent extends BaseDataComponent<any> implements Core.OnInit {

  protected override translationSection: string = 'shop-suppliers';

  public override t(key: string): string {
    return this.i18n.getValue(`shop-suppliers.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'shop/suppliers';

  supplierColumns: Core.ColumnDefinition[] = [];
  trashSupplierColumns: Core.ColumnDefinition[] = [];

  /** @refactor-note (2026-09-09) Přestalo být `readonly` - viz hlavička souboru. */
  graphColumns: GraphColumnOption[] = [];

  constructor(
    protected override dataHandler: Core.DataHandler,
    protected override cd: Core.ChangeDetectorRef,
    protected override genericTableService: Core.GenericTableService,
    private router: Core.Router
  ) {
    super(dataHandler, cd, genericTableService);

    this.i18n.translations$.subscribe(() => {
      this.tableCaption = this.t('table_header');
      this.buttons = Config.createSupplierButtons(this.i18n);
      this.formFields = Config.createSupplierFormFields(this.i18n);
      this.supplierColumns = Config.createSupplierColumns(this.i18n);
      this.trashSupplierColumns = Config.createSupplierTrashColumns(this.i18n);
      this.filterColumns = Config.createSupplierFilterColumns(this.i18n);
      this.detailsColumns = Config.createSupplierDetailsColumns(this.i18n);
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

  get toolbarButtons(): Core.Button[] {
    return Config.createSupplierToolbarButtons(this.i18n).map(btn => {
      let updatedBtn = { ...btn };

      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }

      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible ? this.t('toolbar_hide_filters') : this.t('toolbar_filters');
          updatedBtn.isActive = this.isFilterVisible;
          break;
        // @bugfix-note (2026-10-22) Import was offered in the trash view and the trash button was
        // never highlighted – same rules as the other shop pages now.
        case 'handleCreateFormOpened':
        case 'exportActiveTable':
        case 'triggerImport':
          if (updatedBtn.showIf !== false) {
            updatedBtn.showIf = !this.showTrashTable;
          }
          break;
        case 'toggleTable':
          updatedBtn.label = this.showTrashTable ? this.t('toolbar_show_active') : this.t('toolbar_show_trash');
          updatedBtn.isActive = this.showTrashTable;
          break;
      }

      return updatedBtn;
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.initWithAuthCheck(this.router);
  }

  override refreshData(): void {
    this.forceFullRefresh(this.filters);
  }

}