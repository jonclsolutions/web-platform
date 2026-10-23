/**
 * @file suppliers.component.spec.ts
 * @path src/app/admin/shop-pages/suppliers/suppliers.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of SuppliersComponent and suppliers.config.ts – product suppliers:
 *   translated configuration, name / e-mail validation, chartable columns, toolbar by
 *   permission and view (import hidden in the trash), toolbar actions and loading.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';

import { SuppliersComponent } from './suppliers.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('SuppliersComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<SuppliersComponent>;
  let component: SuppliersComponent;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));
  const field = (name: string) => component.formFields.find(f => f.column_name === name) as any;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [SuppliersComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(SuppliersComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The configuration is built from the 'shop-suppliers' translations.
   * @input  component created
   * @output caption 'shop-suppliers.table_header'; row buttons with shop-suppliers-* permissions; 12 form fields; 6 + 4 columns; 5 filters; 15 detail columns
   */
  it('builds the configuration from translations', () => {
    expect(component.tableCaption).toBe('shop-suppliers.table_header');
    expect(component.buttons.map(b => b.permission)).toEqual([undefined, 'shop-suppliers-update', 'shop-suppliers-delete']);
    expect(component.formFields.length).toBe(12);
    expect(component.supplierColumns.map(c => c.key)).toEqual(['id', 'name', 'ico', 'email', 'is_active', 'created_at']);
    expect(component.trashSupplierColumns.map(c => c.key)).toEqual(['id', 'name', 'email', 'deleted_at']);
    expect(component.filterColumns.map(c => c.key)).toEqual(['id', 'name', 'ico', 'email', 'is_active']);
    expect(component.detailsColumns.length).toBe(15);
    expect(component.t('btn_edit')).toBe('shop-suppliers.btn_edit');
  });

  /**
   * @description Name (2–200 chars incl. Czech letters) and active state are required; the e-mail is checked.
   * @input  name and email patterns; required fields
   * @output 'Dodavatel s.r.o.' ok, 'A' rejected; 'a@firma.cz' ok, 'a@firma' rejected; required ['name', 'is_active']
   */
  it('validates the supplier form', () => {
    const name = new RegExp(field('name').pattern);
    const email = new RegExp(field('email').pattern);
    expect(name.test('Dodavatel Žluťoučký s.r.o.')).toBeTrue();
    expect(name.test('A')).toBeFalse();
    expect(email.test('a@firma.cz')).toBeTrue();
    expect(email.test('a@firma')).toBeFalse();
    expect(component.formFields.filter(f => f.required).map(f => f.column_name)).toEqual(['name', 'is_active']);
  });

  /**
   * @description City, country and state can be charted (count).
   * @input  graphColumns
   * @output city, country, is_active (['1', '0'])
   */
  it('offers chartable columns', () => {
    expect(component.graphColumns.map(g => [g.key, g.aggregation, g.possibleValues])).toEqual([
      ['city', 'count', undefined], ['country', 'count', undefined], ['is_active', 'count', ['1', '0']]
    ]);
  });

  /**
   * @description A language change rebuilds the configuration.
   * @input  getValue returns 'EN:<path>'; translations$.next({})
   * @output tableCaption 'EN:shop-suppliers.table_header'
   */
  it('rebuilds the configuration when translations change', () => {
    ctx.i18n.getValue.and.callFake((p: string) => `EN:${p}`);
    ctx.i18n.translations$.next({});
    expect(component.tableCaption).toBe('EN:shop-suppliers.table_header');
  });

  /**
   * @description Toolbar by permission and view; create, export and import are hidden in the trash.
   * @input  granted []; then all; then trash view with open filters
   * @output create / import / report / trash hidden without permission; trash view: create, export, import hidden; trash button active with 'shop-suppliers.toolbar_show_active'
   */
  it('builds the toolbar by permission and view', () => {
    ctx.permissions.granted = new Set();
    let t = toolbar();
    expect(['handleCreateFormOpened', 'triggerImport', 'openGraphBuilder', 'toggleTable'].map(a => t[a].showIf)).toEqual([false, false, false, false]);
    ctx.permissions.granted = 'all';
    t = toolbar();
    expect(['handleCreateFormOpened', 'exportActiveTable', 'triggerImport'].map(a => t[a].showIf)).toEqual([true, true, true]);
    expect(t['toggleTable'].label).toBe('shop-suppliers.toolbar_show_trash');
    expect(t['toggleTable'].isActive).toBeFalse();
    expect(t['toggleFilters'].label).toBe('shop-suppliers.toolbar_filters');
    component.showTrashTable = true;
    component.isFilterVisible = true;
    t = toolbar();
    expect(['handleCreateFormOpened', 'exportActiveTable', 'triggerImport'].map(a => t[a].showIf)).toEqual([false, false, false]);
    expect(t['toggleTable'].label).toBe('shop-suppliers.toolbar_show_active');
    expect(t['toggleTable'].isActive).toBeTrue();
    expect(t['toggleFilters'].label).toBe('shop-suppliers.toolbar_hide_filters');
  });

  /**
   * @description The import button starts the import of the supplier table.
   * @input  activeTable spy; handleToolbarAction('triggerImport')
   * @output importData() called once
   */
  it('starts the import from the toolbar', () => {
    const table = jasmine.createSpyObj('TableBuilderComponent', ['importData']);
    component.activeTable = table;
    component.handleToolbarAction('triggerImport');
    expect(table.importData).toHaveBeenCalledTimes(1);
  });

  /**
   * @description shop/suppliers is loaded after the auth check; refresh keeps the filters.
   * @input  ngOnInit(); filters { name: 'ACME' }; refreshData()
   * @output getPaginatedData('shop/suppliers', …) twice; refresh with name 'ACME'
   */
  it('loads the suppliers', fakeAsync(() => {
    component.ngOnInit();
    expect(ctx.genericTable.getPaginatedData.calls.allArgs().map(a => a[0])).toEqual(['shop/suppliers', 'shop/suppliers']);
    component.filters = { name: 'ACME' };
    component.refreshData();
    expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[3]).toEqual(jasmine.objectContaining({ name: 'ACME' }));
    discardPeriodicTasks();
  }));

  /**
   * @description The page renders.
   * @input  detectChanges()
   * @output text contains 'shop-suppliers.table_header'
   */
  it('renders the page', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('shop-suppliers.table_header');
    discardPeriodicTasks();
  }));
});
