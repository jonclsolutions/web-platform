/**
 * @file payment-methods.component.spec.ts
 * @path src/app/admin/shop-pages/payment-methods/payment-methods.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of PaymentMethodsComponent and payment-methods.config.ts – the fixed
 *   payment methods (edited only, never created or deleted here): translated configuration,
 *   variable symbol / provider options, chartable columns, toolbar, sorting, saving and details
 *   with error messages.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { PaymentMethodsComponent } from './payment-methods.component';
import { PROVIDER_VALUES, VARIABLE_SYMBOL_TYPE_VALUES } from './payment-methods.config';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('PaymentMethodsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<PaymentMethodsComponent>;
  let component: PaymentMethodsComponent;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
  const field = (name: string) => component.formFields.find(f => f.column_name === name) as any;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [PaymentMethodsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(PaymentMethodsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The configuration is built from the 'shop-payment-methods' translations; only details and edit exist.
   * @input  component created
   * @output caption; row buttons details / edit (shop-payment-methods-update); 9 form fields; 7 columns; 3 filters; 13 detail columns
   */
  it('builds the configuration from translations', () => {
    expect(component.tableCaption).toBe('shop-payment-methods.table_header');
    expect(component.buttons.map(b => [b.action, b.permission])).toEqual([['details', undefined], ['edit', 'shop-payment-methods-update']]);
    expect(component.formFields.length).toBe(9);
    expect(component.columns.map(c => c.key)).toEqual(['id', 'name', 'code', 'provider', 'price', 'sort_order', 'is_active']);
    expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'name', 'provider']);
    expect(component.detailsColumns.length).toBe(13);
    expect(component.t('btn_edit')).toBe('shop-payment-methods.btn_edit');
  });

  /**
   * @description Variable symbol types, providers and yes / no are translated; name, price, symbol type and state are required.
   * @input  variable_symbol_type, is_active options; provider filter; required fields
   * @output VARIABLE_SYMBOL_TYPE_VALUES; ['shared.yes', 'shared.no']; PROVIDER_VALUES; required name, price, variable_symbol_type, is_active
   */
  it('offers translated options', () => {
    expect(field('variable_symbol_type').options.map((o: any) => o.value)).toEqual(VARIABLE_SYMBOL_TYPE_VALUES);
    expect(field('variable_symbol_type').options.every((o: any) => !o.label.includes('undefined'))).toBeTrue();
    expect(field('is_active').options.map((o: any) => o.label)).toEqual(['shared.yes', 'shared.no']);
    expect((component.filterColumns.find(c => c.key === 'provider') as any).options.map((o: any) => o.value)).toEqual(PROVIDER_VALUES);
    expect(component.formFields.filter(f => f.required).map(f => f.column_name)).toEqual(['name', 'price', 'variable_symbol_type', 'is_active']);
  });

  /**
   * @description Provider, variable symbol type and state can be charted (count).
   * @input  graphColumns
   * @output provider, variable_symbol_type, is_active with their value lists
   */
  it('offers chartable columns', () => {
    expect(component.graphColumns.map(g => [g.key, g.aggregation, g.possibleValues])).toEqual([
      ['provider', 'count', PROVIDER_VALUES], ['variable_symbol_type', 'count', VARIABLE_SYMBOL_TYPE_VALUES], ['is_active', 'count', ['1', '0']]
    ]);
  });

  /**
   * @description A language change rebuilds the configuration.
   * @input  getValue returns 'EN:<path>'; translations$.next({})
   * @output tableCaption 'EN:shop-payment-methods.table_header'
   */
  it('rebuilds the configuration when translations change', () => {
    ctx.i18n.getValue.and.callFake((p: string) => `EN:${p}`);
    ctx.i18n.translations$.next({});
    expect(component.tableCaption).toBe('EN:shop-payment-methods.table_header');
  });

  /**
   * @description The toolbar has filters, reports (shop-view-reports) and export only.
   * @input  toolbarButtons with granted []; then all with filters open
   * @output actions ['toggleFilters', 'openGraphBuilder', 'exportActiveTable']; reports hidden without permission; 'shop-payment-methods.toolbar_hide_filters' active
   */
  it('builds the toolbar', () => {
    ctx.permissions.granted = new Set();
    expect(component.toolbarButtons.map(b => b.action)).toEqual(['toggleFilters', 'openGraphBuilder', 'exportActiveTable']);
    expect(toolbar()['openGraphBuilder'].showIf).toBeFalse();
    ctx.permissions.granted = 'all';
    expect(toolbar()['toggleFilters'].label).toBe('shop-payment-methods.toolbar_filters');
    component.isFilterVisible = true;
    expect(toolbar()['toggleFilters'].label).toBe('shop-payment-methods.toolbar_hide_filters');
    expect(toolbar()['toggleFilters'].isActive).toBeTrue();
  });

  /**
   * @description Toolbar actions call their handlers; create is not available.
   * @input  handleToolbarAction(toggleFilters | openGraphBuilder | exportActiveTable | handleCreateFormOpened)
   * @output the three handlers called once; create form not opened
   */
  it('dispatches the toolbar actions', () => {
    const names = ['toggleFilters', 'openGraphBuilder', 'exportActiveTable'];
    const spies = names.map(n => spyOn(component as any, n));
    names.forEach(a => component.handleToolbarAction(a));
    spies.forEach(s => expect(s).toHaveBeenCalledTimes(1));
    component.handleToolbarAction('handleCreateFormOpened');
    expect(component.showCreateForm).toBeFalse();
  });

  /**
   * @description Methods are sorted by sort_order (also after clearing filters) and loaded from shop/payment_methods.
   * @input  new component; ngOnInit(); clearFilters() on page 2
   * @output filters { sort_by: 'sort_order', sort_direction: 'asc' }; getPaginatedData('shop/payment_methods', …); page 1
   */
  it('sorts by sort_order and loads the methods', fakeAsync(() => {
    expect(component.filters).toEqual({ sort_by: 'sort_order', sort_direction: 'asc' });
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.first().args[0]).toBe('shop/payment_methods');
    component.filters = { name: 'x' };
    component.currentPage = 2;
    component.clearFilters();
    expect(component.filters).toEqual({ sort_by: 'sort_order', sort_direction: 'asc' });
    expect(component.currentPage).toBe(1);
    discardPeriodicTasks();
  }));

  /**
   * @description Only existing methods are saved; success reloads, a failure shows the server message or a generic one.
   * @input  handleFormSubmitted({ name: 'x' }) without id; ({ id: 2 }); then put fails with / without a message
   * @output nothing without id; put('shop/payment_methods/2', …) + 'shop-payment-methods.crud_updated_message'; errors 'Invalid IBAN' / 'shop-payment-methods.update_failed_message'
   */
  it('saves an edited method', () => {
    component.handleFormSubmitted({ name: 'x' });
    expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();
    expect((ctx.dataHandler as any).post).not.toHaveBeenCalled();
    component.showCreateForm = true;
    component.handleFormSubmitted({ id: 2, price: 0 });
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('shop/payment_methods/2', { id: 2, price: 0 });
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'shop-payment-methods.crud_updated_message', 'success');
    expect(component.showCreateForm).toBeFalse();
    (ctx.dataHandler as any).put.and.returnValue(throwError(() => ({ error: { message: 'Invalid IBAN' } })));
    component.handleFormSubmitted({ id: 2 });
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'Invalid IBAN', 'danger');
    (ctx.dataHandler as any).put.and.returnValue(throwError(() => ({})));
    component.handleFormSubmitted({ id: 2 });
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'shop-payment-methods.update_failed_message', 'danger');
  });

  /**
   * @description Details are loaded by id; failures show the server message or a generic one; rows without id are ignored.
   * @input  handleViewDetails({ id: 2 }); ({}); then getOne fails with / without a message
   * @output getOne('shop/payment_methods/2'); details shown; errors 'Not found' / 'shop-payment-methods.load_details_failed_message'
   */
  it('shows the details', () => {
    (ctx.dataHandler as any).getOne.and.returnValue(of({ id: 2, name: 'Bank transfer' }));
    component.handleViewDetails({ id: 2 });
    expect((ctx.dataHandler as any).getOne).toHaveBeenCalledWith('shop/payment_methods/2');
    expect(component.showDetails).toBeTrue();
    component.handleViewDetails({});
    expect((ctx.dataHandler as any).getOne).toHaveBeenCalledTimes(1);
    (ctx.dataHandler as any).getOne.and.returnValue(throwError(() => ({ error: { message: 'Not found' } })));
    component.handleViewDetails({ id: 3 });
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'Not found', 'danger');
    (ctx.dataHandler as any).getOne.and.returnValue(throwError(() => ({})));
    component.handleViewDetails({ id: 3 });
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'shop-payment-methods.load_details_failed_message', 'danger');
  });

  /**
   * @description The page renders.
   * @input  detectChanges()
   * @output text contains 'shop-payment-methods.table_header'
   */
  it('renders the page', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('shop-payment-methods.table_header');
    discardPeriodicTasks();
  }));
});
