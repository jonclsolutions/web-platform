/**
 * @file external-links.component.spec.ts
 * @path src/app/admin/core-pages/external-links/external-links.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ExternalLinksComponent – the core "external links" table page:
 *   configuration from translations, toolbar buttons by permission and state, default sorting
 *   by name, loading after the auth check.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles)
 */

import { ComponentFixture, TestBed, fakeAsync, discardPeriodicTasks } from '@angular/core/testing';

import { ExternalLinksComponent } from './external-links.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('ExternalLinksComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ExternalLinksComponent>;
  let component: ExternalLinksComponent;

  const toolbar = () => Object.fromEntries(component.toolbarButtons.map(b => [b.action, b]));

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [ExternalLinksComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(ExternalLinksComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description Table, form, filter and detail configuration is built from the translations.
   * @input  component created
   * @output tableCaption 'external-links.table_header'; buttons, formFields, linkColumns, filterColumns, detailsColumns not empty
   */
  it('builds the page configuration', () => {
    expect(component.tableCaption).toBe('external-links.table_header');
    expect(component.buttons.length).toBeGreaterThan(0);
    expect(component.formFields.length).toBeGreaterThan(0);
    expect(component.linkColumns.length).toBeGreaterThan(0);
    expect(component.filterColumns.length).toBeGreaterThan(0);
    expect(component.detailsColumns.length).toBeGreaterThan(0);
  });

  /**
   * @description Links are sorted by name A–Z by default and after clearing filters.
   * @input  new component; clearFilters()
   * @output filters { sort_by: 'name', sort_direction: 'asc' } both times; reload with those filters
   */
  it('sorts by name by default', () => {
    expect(component.filters).toEqual({ sort_by: 'name', sort_direction: 'asc' });
    component.filters = { sort_by: 'id', sort_direction: 'desc', name: 'x' };
    component.clearFilters();
    expect(component.filters).toEqual({ sort_by: 'name', sort_direction: 'asc' });
    expect(ctx.genericTable.getPaginatedData.calls.mostRecent().args[3]).toEqual(jasmine.objectContaining({ sort_by: 'name' }));
  });

  /**
   * @description Toolbar buttons without the matching permission are hidden.
   * @input  granted [] (none)
   * @output create, report and trash buttons have showIf false; filter and export stay visible
   */
  it('hides toolbar buttons without permission', () => {
    ctx.permissions.granted = new Set();
    const t = toolbar();
    expect(t['handleCreateFormOpened'].showIf).toBeFalse();
    expect(t['openGraphBuilder'].showIf).toBeFalse();
    expect(t['toggleTable'].showIf).toBeFalse();
    expect(t['toggleFilters'].showIf).not.toBeFalse();
    expect(t['exportActiveTable'].showIf).toBeTrue();
  });

  /**
   * @description In the trash view create/export are hidden and the trash button switches label.
   * @input  showTrashTable true; isFilterVisible true
   * @output create/export showIf false; toggleTable label 'external-links.toolbar_show_active' active; filter label 'external-links.toolbar_hide_filters'
   */
  it('adapts the toolbar to the trash view and open filters', () => {
    component.showTrashTable = true;
    component.isFilterVisible = true;
    const t = toolbar();
    expect(t['handleCreateFormOpened'].showIf).toBeFalse();
    expect(t['exportActiveTable'].showIf).toBeFalse();
    expect(t['toggleTable'].label).toBe('external-links.toolbar_show_active');
    expect(t['toggleTable'].isActive).toBeTrue();
    expect(t['toggleFilters'].label).toBe('external-links.toolbar_hide_filters');
  });

  /**
   * @description After login the active and trashed links of core/external_links are loaded.
   * @input  ngOnInit() logged in
   * @output getPaginatedData('core/external_links', …) for active and trash
   */
  it('loads the links after the auth check', fakeAsync(() => {
    component.ngOnInit();
    const endpoints = ctx.genericTable.getPaginatedData.calls.allArgs().map(a => a[0]);
    expect(endpoints).toEqual(['core/external_links', 'core/external_links']);
    discardPeriodicTasks();
  }));

  /**
   * @description t() reads the page's own translation section.
   * @input  t('toolbar_filters')
   * @output 'external-links.toolbar_filters'
   */
  it('t() reads the external-links section', () => {
    expect(component.t('toolbar_filters')).toBe('external-links.toolbar_filters');
  });

  /**
   * @description The page renders its table title.
   * @input  detectChanges()
   * @output page text contains 'external-links.table_header'
   */
  it('renders the page', fakeAsync(() => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('external-links.table_header');
    discardPeriodicTasks();
  }));
});
