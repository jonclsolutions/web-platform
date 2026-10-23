/**
 * @file coupons.component.ts
 * @path src/app/admin/shop-pages/coupons/coupons.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Manages the lifecycle of shop coupons, handling filtering, CRUD operations, and switching between active and trashed views.
 * @dependencies
 * - TableBuilderComponent: Used for rendering the data grids.
 * - BaseDataComponent: Inherits core API interaction and pagination state management.
 * @bugfix-note (2026-08-31) Odstraněny duplicitní `alertDialogService.open('Chyba', ...)`
 * volání z `error:` callbacků (handleFormSubmitted, handleViewDetails) -
 * `DataHandler.handleError()` je jediné autoritativní místo pro chybový toast.
 * @refactor-note (2026-10-23) Localized (open finding #16): texts from the admin translation
 *   section `shop-coupons` (`Config.create*()` factories rebuilt on every language change,
 *   `takeUntilDestroyed()`), the success alerts use `shared.success` + `crud_*_message`.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as Core from '../../../shared/imports/core-providers';
import { SHARED_UI_BUILDERS } from '../../../shared/imports/shared-ui-builders';
import { BaseDataComponent } from '../../components/base-data/base-data.component';
import * as Config from './coupons.config';
import { ActionMenuBuilderComponent } from '../../components/builders/action-menu-builder/action-menu-builder.component';
import { GraphBuilderComponent } from '../../components/builders/graph-builder/graph-builder.component';
import { GraphColumnOption } from '../../../shared/interfaces/graph-format';

@Component({
  selector: 'app-coupons',
  standalone: true,
  imports: [SHARED_UI_BUILDERS, ActionMenuBuilderComponent,GraphBuilderComponent],
  templateUrl: './coupons.component.html',
  styleUrls: ['../../shared-styles/page.css', '../shared-styles/page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CouponsComponent extends BaseDataComponent<any> implements Core.OnInit {
  protected override translationSection: string = 'shop-coupons';

  /**
   * @description Text of the page's translation section.
   * @param key Key inside `shop-coupons`.
   * @returns Translated text.
   */
  public override t(key: string): string {
    return this.i18n.getValue(`shop-coupons.${key}`);
  }

  tableCaption: string = '';

  override apiEndpoint: string = 'shop/coupons';

  couponColumns: Core.ColumnDefinition[] = [];
  trashCouponColumns: Core.ColumnDefinition[] = [];
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
      this.buttons = Config.createCouponButtons(this.i18n);
      this.formFields = Config.createCouponFormFields(this.i18n);
      this.couponColumns = Config.createCouponColumns(this.i18n);
      this.trashCouponColumns = Config.createCouponTrashColumns(this.i18n);
      this.filterColumns = Config.createCouponFilterColumns(this.i18n);
      this.detailsColumns = Config.createCouponDetailsColumns(this.i18n);
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
   * @description Toolbar of the page, by permission and view (active / trash, filters open).
   * @returns Toolbar buttons with labels, visibility and active state.
   */
  get toolbarButtons(): Core.Button[] {
    return Config.createCouponToolbarButtons(this.i18n).map(btn => {
      const updatedBtn = { ...btn };

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

  override refreshData(): void { this.forceFullRefresh(this.filters); }

  /**
   * @description Creates (no id) or updates (id) a coupon, then closes the form and reloads.
   * @param formData Values of the coupon form.
   */
  override handleFormSubmitted(formData: any): void {
    const request$ = formData.id ? this.updateData(formData.id, formData) : this.postData(formData);
    request$.pipe(Core.finalize(() => { this.showCreateForm = false; this.cd.markForCheck(); })).subscribe({
      next: () => {
        this.alertDialogService.open(
          this.i18n.getValue('shared.success'),
          this.t(formData.id ? 'crud_updated_message' : 'crud_created_message'),
          'success'
        );
        this.refreshData();
      }
    });
  }
}
