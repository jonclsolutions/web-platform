/**
 * @file shipping-methods.component.spec.ts
 * @path src/app/admin/shop-pages/shipping-methods/shipping-methods.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ShippingMethodsComponent and shipping-methods.config.ts – shipping
 *   methods: translated configuration, shipping type / yes-no options, code validation,
 *   chartable and importable columns, toolbar by permission and view, sorting by sort_order.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';

import { ShippingMethodsComponent } from './shipping-methods.component';
import { SHIPPING_TYPE_VALUES } from './shipping-methods.config';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('ShippingMethodsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ShippingMethodsComponent>;
  let component: ShippingMethodsComponent;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
  const field = (name: string) => component.formFields.find(f => f.column_name === name) as any;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [ShippingMethodsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(ShippingMethodsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The configuration is built from the 'shop-shipping-methods' translations.
   * @input  component created
   * @output caption; row buttons with shop-shipping-methods-* permissions; 15 form fields; 6 + 3 columns; 3 filters; 16 detail columns
   */
  it('builds the configuration from translations', () => {
    expect(component.tableCaption).toBe('shop-shipping-methods.table_header');
    expect(component.buttons.map(b => b.permission)).toEqual([undefined, 'shop-shipping-methods-update', 'shop-shipping-methods-delete']);
    expect(component.formFields.length).toBe(15);
    expect(component.shippingColumns.map(c => c.key)).toEqual(['id', 'name', 'shipping_type', 'base_price', 'is_active', 'sort_order']);
    expect(component.trashShippingColumns.map(c => c.key)).toEqual(['id', 'name', 'deleted_at']);
    expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'name', 'shipping_type']);
    expect(component.detailsColumns.length).toBe(16);
    expect(component.t('btn_edit')).toBe('shop-shipping-methods.btn_edit');
  });

  /**
   * @description Shipping types and yes / no selects are translated; the code is lower-case 3–50 chars.
   * @input  shipping_type, allows_cod, requires_pickup_point options; code pattern; required fields
   * @output types = SHIPPING_TYPE_VALUES; allows_cod 'shared.yes' / 'shared.no'; pickup yes label own key; 'ppl_cz' ok, 'PPL' rejected
   */
  it('validates the shipping form', () => {
    expect(field('shipping_type').options.map((o: any) => o.value)).toEqual(SHIPPING_TYPE_VALUES);
    expect(field('shipping_type').options.every((o: any) => !o.label.includes('undefined'))).toBeTrue();
    expect(field('allows_cod').options).toEqual([{ value: '1', label: 'shared.yes' }, { value: '0', label: 'shared.no' }]);
    expect(field('requires_pickup_point').options[0]).toEqual({ value: '1', label: 'shop-shipping-methods.requires_pickup_point_yes' });
    const code = new RegExp(field('code').pattern);
    expect(code.test('ppl_cz')).toBeTrue();
    expect(code.test('PPL')).toBeFalse();
    expect(component.formFields.filter(f => f.required).map(f => f.column_name))
      .toEqual(['code', 'name', 'shipping_type', 'base_price', 'allows_cod', 'requires_pickup_point', 'sort_order', 'is_active']);
  });

  /**
   * @description Type, cash on delivery, pickup point and state can be charted; all detail columns but id are importable.
   * @input  graphColumns; detailsColumns
   * @output shipping_type, allows_cod, requires_pickup_point, is_active; 15 importable columns
   */
  it('offers chartable and importable columns', () => {
    expect(component.graphColumns.map(g => [g.key, g.possibleValues])).toEqual([
      ['shipping_type', SHIPPING_TYPE_VALUES], ['allows_cod', ['1', '0']], ['requires_pickup_point', ['1', '0']], ['is_active', ['1', '0']]
    ]);
    expect(component.graphColumns.every(g => g.aggregation === 'count')).toBeTrue();
    expect(component.detailsColumns.filter(c => c.importable).length).toBe(15);
  });

  /**
   * @description A language change rebuilds the configuration.
   * @input  getValue returns 'EN:<path>'; translations$.next({})
   * @output tableCaption 'EN:shop-shipping-methods.table_header'
   */
  it('rebuilds the configuration when translations change', () => {
    ctx.i18n.getValue.and.callFake((p: string) => `EN:${p}`);
    ctx.i18n.translations$.next({});
    expect(component.tableCaption).toBe('EN:shop-shipping-methods.table_header');
  });

  /**
   * @description Toolbar by permission and view.
   * @input  granted []; then all; then trash view with open filters
   * @output create / report / trash hidden without permission, no import (finding #25); trash view: create, export hidden; labels switched
   */
  it('builds the toolbar by permission and view', () => {
    ctx.permissions.granted = new Set();
    let t = toolbar();
    expect(['handleCreateFormOpened', 'openGraphBuilder', 'toggleTable'].map(a => t[a].showIf)).toEqual([false, false, false]);
    expect(t['triggerImport']).toBeUndefined();  // no import in the API (finding #25)
    ctx.permissions.granted = 'all';
    t = toolbar();
    expect(['handleCreateFormOpened', 'exportActiveTable'].map(a => t[a].showIf)).toEqual([true, true]);
    expect(t['toggleTable'].label).toBe('shop-shipping-methods.toolbar_show_trash');
    expect(t['toggleFilters'].label).toBe('shop-shipping-methods.toolbar_filters');
    component.showTrashTable = true;
    component.isFilterVisible = true;
    t = toolbar();
    expect(['handleCreateFormOpened', 'exportActiveTable'].map(a => t[a].showIf)).toEqual([false, false]);
    expect(t['toggleTable'].label).toBe('shop-shipping-methods.toolbar_show_active');
    expect(t['toggleTable'].isActive).toBeTrue();
    expect(t['toggleFilters'].label).toBe('shop-shipping-methods.toolbar_hide_filters');
  });

  /**
   * @description Methods are sorted by sort_order (also after clearing filters) and loaded from shop/shipping_methods.
   * @input  new component; ngOnInit(); filters { name: 'x' }; clearFilters() on page 3
   * @output filters { sort_by: 'sort_order', sort_direction: 'asc' }; getPaginatedData('shop/shipping_methods', …); after clear page 1 and reload with sort_order
   */
  it('sorts by sort_order and loads the methods', fakeAsync(() => {
    expect(component.filters).toEqual({ sort_by: 'sort_order', sort_direction: 'asc' });
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.first().args[0]).toBe('shop/shipping_methods');
    component.filters = { name: 'x' };
    component.currentPage = 3;
    component.clearFilters();
    expect(component.filters).toEqual({ sort_by: 'sort_order', sort_direction: 'asc' });
    expect(component.currentPage).toBe(1);
    expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[3]).toEqual(jasmine.objectContaining({ sort_by: 'sort_order' }));
    discardPeriodicTasks();
  }));

  /**
   * @description The page renders.
   * @input  detectChanges()
   * @output text contains 'shop-shipping-methods.table_header'
   */
  it('renders the page', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('shop-shipping-methods.table_header');
    discardPeriodicTasks();
  }));
});
