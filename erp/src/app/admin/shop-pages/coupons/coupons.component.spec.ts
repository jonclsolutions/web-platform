/**
 * @file coupons.component.spec.ts
 * @path src/app/admin/shop-pages/coupons/coupons.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of CouponsComponent and coupons.config.ts – discount coupons:
 *   configuration, code validation, chartable / importable columns, toolbar by permission and
 *   view, toolbar actions (incl. import), loading and create / update; all texts come from the
 *   `shop-coupons` translation section (finding #16, the i18n double returns the key path).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';

import { CouponsComponent } from './coupons.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('CouponsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<CouponsComponent>;
  let component: CouponsComponent;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
  const field = (name: string) => component.formFields.find(f => f.column_name === name) as any;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [CouponsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(CouponsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description Table, form, filter and detail configuration.
   * @input  component created
   * @output row buttons with shop-coupons-* permissions; 10 form fields; 7 + 3 columns; 3 filters; 13 detail columns;
   *   caption, headers and labels are shop-coupons keys; discount type filter with translated labels
   */
  it('builds the configuration', () => {
    expect(component.tableCaption).toBe('shop-coupons.table_header');
    expect(component.buttons.map(b => b.header_name)).toEqual(['shop-coupons.btn_details', 'shop-coupons.btn_edit', 'shop-coupons.btn_delete']);
    expect(component.couponColumns[1].header).toBe('shop-coupons.col_code');
    expect(field('code').label).toBe('shop-coupons.field_code_label');
    expect((component.filterColumns[2] as any).options).toEqual([
      { value: 'percent', label: 'shop-coupons.discount_type_percent' }, { value: 'fixed', label: 'shop-coupons.discount_type_fixed' }
    ]);
    expect(field('is_active').options.map((o: any) => o.label)).toEqual(['shared.yes', 'shared.no']);
    expect(component.buttons.map(b => b.permission)).toEqual([undefined, 'shop-coupons-update', 'shop-coupons-delete']);
    expect(component.formFields.length).toBe(10);
    expect(component.couponColumns.length).toBe(7);
    expect(component.trashCouponColumns.map(c => c.key)).toEqual(['id', 'code', 'deleted_at']);
    expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'code', 'discount_type']);
    expect(component.detailsColumns.length).toBe(13);
  });

  /**
   * @description The coupon code is 3–50 letters, digits, '_' or '-' without spaces; type, value, scope and state are required.
   * @input  code pattern; required fields; options
   * @output 'LETO20' ok, 'ab' / 'LE TO' rejected; required code, discount_type, discount_value, applies_to, is_active; types percent / fixed
   */
  it('validates the coupon form', () => {
    const re = new RegExp(field('code').pattern);
    expect(re.test('LETO20')).toBeTrue();
    expect(re.test('summer_sale-1')).toBeTrue();
    expect(re.test('ab')).toBeFalse();
    expect(re.test('LE TO')).toBeFalse();
    expect(component.formFields.filter(f => f.required).map(f => f.column_name)).toEqual(['code', 'discount_type', 'discount_value', 'applies_to', 'is_active']);
    expect(field('discount_type').options.map((o: any) => o.value)).toEqual(['percent', 'fixed']);
    expect(field('applies_to').options.map((o: any) => o.value)).toEqual(['all', 'products', 'categories']);
  });

  /**
   * @description Discount type, scope and state can be charted; everything except created_at is importable.
   * @input  graphColumns; detailsColumns
   * @output discount_type, applies_to, is_active (count); 12 importable columns
   */
  it('offers chartable and importable columns', () => {
    expect(component.graphColumns.map(g => [g.key, g.aggregation, g.possibleValues])).toEqual([
      ['discount_type', 'count', ['percent', 'fixed']], ['applies_to', 'count', ['all', 'products', 'categories']], ['is_active', 'count', ['1', '0']]
    ]);
    expect(component.detailsColumns.filter(c => c.importable).length).toBe(12);
  });

  /**
   * @description Toolbar by permission and view.
   * @input  granted []; then all; then trash view with open filters
   * @output create / report / trash hidden without permission; trash view: create, export hidden; labels toolbar_show_active / toolbar_hide_filters
   */
  it('builds the toolbar by permission and view', () => {
    ctx.permissions.granted = new Set();
    let t = toolbar();
    expect(['handleCreateFormOpened', 'openGraphBuilder', 'toggleTable'].map(a => t[a].showIf)).toEqual([false, false, false]);
    ctx.permissions.granted = 'all';
    t = toolbar();
    expect(['handleCreateFormOpened', 'exportActiveTable'].map(a => t[a].showIf)).toEqual([true, true]);
    expect(t['toggleTable'].label).toBe('shop-coupons.toolbar_show_trash');
    expect(t['toggleFilters'].label).toBe('shop-coupons.toolbar_filters');
    component.showTrashTable = true;
    component.isFilterVisible = true;
    t = toolbar();
    expect(['handleCreateFormOpened', 'exportActiveTable'].map(a => t[a].showIf)).toEqual([false, false]);
    expect(t['toggleTable'].label).toBe('shop-coupons.toolbar_show_active');
    expect(t['toggleTable'].isActive).toBeTrue();
    expect(t['toggleFilters'].label).toBe('shop-coupons.toolbar_hide_filters');
  });

  /**
   * @description No import button: the API has no coupon import (finding #25, the button answered 404).
   * @input  toolbarButtons with all permissions
   * @output no 'triggerImport' action
   */
  it('offers no import', () => {
    expect(component.toolbarButtons.map(b => b.action)).not.toContain('triggerImport');
  });

  /**
   * @description shop/coupons is loaded after the auth check; refresh keeps the filters.
   * @input  ngOnInit(); filters { code: 'LETO' }; refreshData()
   * @output getPaginatedData('shop/coupons', …) twice; refresh with code 'LETO'
   */
  it('loads the coupons', fakeAsync(() => {
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.allArgs().map(a => a[0])).toEqual(['shop/coupons', 'shop/coupons']);
    component.filters = { code: 'LETO' };
    component.refreshData();
    expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[3]).toEqual(jasmine.objectContaining({ code: 'LETO' }));
    discardPeriodicTasks();
  }));

  /**
   * @description A coupon with id is updated, a new one created; each shows its message and reloads.
   * @input  handleFormSubmitted({ id: 2, code: 'X' }), ({ code: 'NEW' })
   * @output put('shop/coupons/2', …) + crud_updated_message; post('shop/coupons', …) + crud_created_message; form closed
   */
  it('updates and creates coupons', () => {
    component.showCreateForm = true;
    component.handleFormSubmitted({ id: 2, code: 'X' });
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('shop/coupons/2', { id: 2, code: 'X' });
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'shop-coupons.crud_updated_message', 'success');
    component.handleFormSubmitted({ code: 'NEW' });
    expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('shop/coupons', { code: 'NEW' });
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'shop-coupons.crud_created_message', 'success');
    expect(component.showCreateForm).toBeFalse();
  });

  /**
   * @description The page renders.
   * @input  detectChanges()
   * @output text contains the translated header, no hardcoded Czech header
   */
  it('renders the page', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('shop-coupons.table_header');
    expect(fixture.nativeElement.textContent).not.toContain('Slevové kupóny');
    discardPeriodicTasks();
  }));
});
