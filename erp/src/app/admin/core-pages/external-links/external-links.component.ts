/**
 * @file external-links.component.ts
 * @path src/app/admin/web-pages/external-links/external-links.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Spravuje seznam externích odkazů zobrazovaných v adminu (Google Analytics
 * dashboard, webmail, Search Console apod.) - CRUD s košem, žádné živé statistiky.
 * @dependencies
 * - BaseDataComponent: Provides the base logic for API interactions, pagination, and entity state management.
 * - TableBuilderComponent: Used for displaying supplier data and handling CSV exports.
 * - SHARED_UI_BUILDERS: Collection of reusable UI components for the dashboard.
 * - Config.create* factory functions: i18n-aware definitions for UI columns, form
 *   fields, and toolbar actions - see refactor-note (2026-09-08) below.
 * @note Struktura je záměrně 1:1 stejná jako u SuppliersComponent, aby zůstala konzistentní
 * s ostatními jednoduchými CRUD stránkami v adminu.
 *
 * (Earlier bugfix-notes for the sort_by 'position' 500 error and the duplicate toast
 * removal are unchanged - see version history.)
 *
 * @refactor-note (2026-09-08) BACKLOG "vícejazyčná administrace, žádné hardcoded texty":
 * `Config.EXTERNAL_LINK_*` konstanty nahrazeny `Config.create*()` factory funkcemi -
 * stejný vzor jako web-pages stránky. `graphColumns` přestalo být `readonly`.
 * `'Úspěch'`/`'Požadavek byl upraven.'`/`'Požadavek byl vytvořen.'` (dřív natvrdo česky)
 * nahrazeny `t()` voláním.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './external-links.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

/**
 * @description Component for managing the list of external admin links.
 * @usage Provides a comprehensive interface for administrators to list, create, edit, and archive external link records.
 * @note Extends BaseDataComponent to utilize standardized service patterns for fetching and mutating data.
 */
@Component({
  selector: 'app-external-links',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent, GraphBuilderComponent],
  templateUrl: './external-links.component.html',
  styleUrls: ['../../shared-styles/page.css', '../shared-styles/page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExternalLinksComponent extends BaseDataComponent<any> implements Core.OnInit {

  protected override translationSection: string = 'external-links';

  public override t(key: string): string {
    return this.i18n.getValue(`external-links.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'core/external_links';

  linkColumns: Core.ColumnDefinition[] = [];
  trashLinkColumns: Core.ColumnDefinition[] = [];

  override filters: Core.FilterParams = {
    sort_by: 'name',
    sort_direction: 'asc'
  };

  /** @refactor-note (2026-09-08) Přestalo být `readonly` - viz hlavička souboru. */
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
      this.buttons = Config.createExternalLinkButtons(this.i18n);
      this.formFields = Config.createExternalLinkFormFields(this.i18n);
      this.linkColumns = Config.createExternalLinkColumns(this.i18n);
      this.trashLinkColumns = Config.createExternalLinkTrashColumns(this.i18n);
      this.filterColumns = Config.createExternalLinkFilterColumns(this.i18n);
      this.detailsColumns = Config.createExternalLinkDetailsColumns(this.i18n);
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

  /**
   * @description Computes the toolbar configuration.
   * @returns List of buttons updated based on user permissions, current view state (active/trash), and UI filter state.
   */
  get toolbarButtons(): Core.Button[] {
    return Config.createExternalLinkToolbarButtons(this.i18n).map(btn => {
      let updatedBtn = { ...btn };

      if (updatedBtn.permission && !this.permissionService.hasPermission(updatedBtn.permission)) {
        updatedBtn.showIf = false;
      }

      switch (btn.action) {
        case 'toggleFilters':
          updatedBtn.label = this.isFilterVisible ? this.t('toolbar_hide_filters') : this.t('toolbar_filters');
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

  /**
   * @description Resets filter configuration to initial sorting criteria.
   */
  override clearFilters(): void {
    this.filters = { sort_by: 'name', sort_direction: 'asc' };
    this.currentPage = 1;
    this.refreshData();
  }

}