/**
 * @file base-data.component.spec.ts
 * @path src/app/admin/components/base-data/base-data.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of BaseDataComponent – the abstract base of every admin table page.
 *   A minimal host component supplies the abstract `apiEndpoint`; the real PaginatedListStore and
 *   EntityCrudService run on top of DataHandler / GenericTableService spies, so the tests verify
 *   what actually reaches the API layer (URLs, payloads, pagination) and the page state.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (i18n, auth, permission, DataHandler, GenericTable doubles)
 */

import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError, config as rxjsConfig } from 'rxjs';

import { BaseDataComponent } from './base-data.component';
import { AdminTestContext, createAdminTestContext, paginated } from '../../../../testing/admin-test-helpers';

interface Row { id?: number; deleted_at?: string | null; name?: string; }

@Component({ standalone: true, selector: 'app-base-data-host', template: '' })
class HostComponent extends BaseDataComponent<Row> {
  apiEndpoint = 'core/things';
  protected override translationSection = 'things';
  refreshCalls = 0;
  override refreshData(): void { this.refreshCalls++; }
  init(router: Router): void { this.initWithAuthCheck(router); }
  setUsesPaginatedList(value: boolean): void { this.usesPaginatedList = value; }
  subscribeCollection() { return this.crud.getCollection().subscribe(); }
}

describe('BaseDataComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<HostComponent>;
  let component: HostComponent;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [HostComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  describe('initial state', () => {
    /**
     * @description A new page starts with the table full width and every panel closed.
     * @input  freshly created host component
     * @output isTableFullWidth = true; isFilterVisible, showCreateForm, showDetails, showGraphBuilder = false; errorMessage = null
     */
    it('starts with the table full width and all panels closed', () => {
      expect(component.isTableFullWidth).toBeTrue();
      expect(component.isFilterVisible).toBeFalse();
      expect(component.showCreateForm).toBeFalse();
      expect(component.showDetails).toBeFalse();
      expect(component.showGraphBuilder).toBeFalse();
      expect(component.errorMessage).toBeNull();
    });

    /**
     * @description Default sorting of every table page is "newest id first".
     * @input  freshly created host component
     * @output filters = { sort_by: 'id', sort_direction: 'desc' }; buttons/filterColumns/detailsColumns/formFields = []
     */
    it('has default filters id desc and empty table configuration', () => {
      expect(component.filters).toEqual({ sort_by: 'id', sort_direction: 'desc' });
      expect(component.buttons).toEqual([]);
      expect(component.filterColumns).toEqual([]);
      expect(component.detailsColumns).toEqual([]);
      expect(component.formFields).toEqual([]);
    });
  });

  describe('i18n', () => {
    /**
     * @description `strings` merges 'shared' with the page's own translation section.
     * @input  translationSection = 'things'; template reads strings.title
     * @output getMergedSection('things') called; strings.title = 'things.title'
     */
    it('strings reads the page translation section', () => {
      expect(component.strings.title).toBe('things.title');
      expect(ctx.i18n.getMergedSection).toHaveBeenCalledWith('things');
    });

    /**
     * @description `t(path)` is a full-path lookup (section included by the caller).
     * @input  t('shared.save')
     * @output 'shared.save' (value returned by AdminLocalizationService.getValue)
     */
    it('t() looks up the full path', () => {
      expect(component.t('shared.save')).toBe('shared.save');
      expect(ctx.i18n.getValue).toHaveBeenCalledWith('shared.save');
    });
  });

  describe('initWithAuthCheck()', () => {
    /**
     * @description A logged-in user gets the first active and trash page loaded.
     * @input  isLoggedIn$ = true, usesPaginatedList = true
     * @output getPaginatedData called twice for 'core/things' (active + only_trashed), no navigation
     */
    it('loads active and trash data when the user is logged in', fakeAsync(() => {
      const router = TestBed.inject(Router);
      const nav = spyOn(router, 'navigate');
      component.init(router);
      expect(ctx.genericTable.getPaginatedData).toHaveBeenCalledTimes(2);
      const calls = ctx.genericTable.getPaginatedData.calls.allArgs();
      expect(calls[0][0]).toBe('core/things');
      expect(calls[1][3]).toEqual(jasmine.objectContaining({ only_trashed: 'true' }));
      expect(nav).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description The first load uses the page's own filters, not the base default (finding #13).
     * @input  filters = { sort_by: 'created_at', sort_direction: 'asc' }; isLoggedIn$ = true
     * @output both getPaginatedData calls carry sort_by 'created_at' / sort_direction 'asc'
     */
    it('loads the first page with the page filters', fakeAsync(() => {
      component.filters = { sort_by: 'created_at', sort_direction: 'asc' };
      component.init(TestBed.inject(Router));
      for (const args of ctx.genericTable.getPaginatedData.calls.allArgs()) {
        expect(args[3]).toEqual(jasmine.objectContaining({ sort_by: 'created_at', sort_direction: 'asc' }));
      }
      expect(ctx.genericTable.getPaginatedData).toHaveBeenCalledTimes(2);
      discardPeriodicTasks();
    }));

    /**
     * @description Pages without a paginated list (usesPaginatedList = false) use refreshData().
     * @input  isLoggedIn$ = true, usesPaginatedList = false
     * @output refreshData() called once, getPaginatedData not called
     */
    it('calls refreshData() instead of the list for non-paginated pages', fakeAsync(() => {
      component.setUsesPaginatedList(false);
      component.init(TestBed.inject(Router));
      expect(component.refreshCalls).toBe(1);
      expect(ctx.genericTable.getPaginatedData).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description A logged-out user is sent to the login page.
     * @input  isLoggedIn$ = false
     * @output router.navigate(['/auth/login'])
     */
    it('redirects to /auth/login when the user is not logged in', fakeAsync(() => {
      ctx.auth.isLoggedIn$.next(false);
      const router = TestBed.inject(Router);
      const nav = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
      component.init(router);
      expect(nav).toHaveBeenCalledWith(['/auth/login']);
      discardPeriodicTasks();
    }));

    /**
     * @description The global "refresh all tables" event reloads the page data.
     * @input  refreshAll$ emits once after init
     * @output endpoint cache invalidated and both lists fetched again
     */
    it('reloads on the global refresh event', fakeAsync(() => {
      component.init(TestBed.inject(Router));
      ctx.genericTable.getPaginatedData.calls.reset();
      ctx.refreshAll$.next();
      expect(ctx.genericTable.invalidateEndpoint).toHaveBeenCalledWith('core/things');
      expect(ctx.genericTable.getPaginatedData).toHaveBeenCalledTimes(2);
      discardPeriodicTasks();
    }));

    /**
     * @description Background refresh runs every 15 minutes while the tab is visible.
     * @input  15 minutes pass after init
     * @output invalidateEndpoint('core/things') called once
     */
    it('refreshes in the background every 15 minutes', fakeAsync(() => {
      component.init(TestBed.inject(Router));
      tick(15 * 60 * 1000);
      expect(ctx.genericTable.invalidateEndpoint).toHaveBeenCalledTimes(1);
      discardPeriodicTasks();
    }));
  });

  describe('permissions', () => {
    /**
     * @description hasAnyPermission accepts "a|b" and passes when at least one is granted.
     * @input  granted = ['b']; hasAnyPermission('a|b'), hasAnyPermission('a|c')
     * @output true, false
     */
    it('hasAnyPermission() passes when any of the "|" separated permissions is granted', () => {
      ctx.permissions.granted = new Set(['b']);
      expect(component.hasAnyPermission('a|b')).toBeTrue();
      expect(component.hasAnyPermission('a|c')).toBeFalse();
    });
  });

  describe('filters and paging', () => {
    /**
     * @description Applying filters merges them, goes back to page 1 and reloads.
     * @input  currentPage = 3; applyFilters({ name: 'abc' })
     * @output filters = { sort_by: 'id', sort_direction: 'desc', name: 'abc' }; currentPage = 1; refreshData() called
     */
    it('applyFilters() merges the filters, resets the page and reloads', () => {
      component.currentPage = 3;
      component.applyFilters({ name: 'abc' });
      expect(component.filters).toEqual({ sort_by: 'id', sort_direction: 'desc', name: 'abc' });
      expect(component.currentPage).toBe(1);
      expect(component.refreshCalls).toBe(1);
    });

    /**
     * @description Clearing filters restores the default sorting and reloads from page 1.
     * @input  filters with name 'abc', currentPage = 2; clearFilters()
     * @output filters = { sort_by: 'id', sort_direction: 'desc' }; currentPage = 1; refreshData() called
     */
    it('clearFilters() restores the defaults and reloads', () => {
      component.filters = { sort_by: 'name', sort_direction: 'asc', name: 'abc' };
      component.currentPage = 2;
      component.clearFilters();
      expect(component.filters).toEqual({ sort_by: 'id', sort_direction: 'desc' });
      expect(component.currentPage).toBe(1);
      expect(component.refreshCalls).toBe(1);
    });

    /**
     * @description Page change fetches the requested page with the current filters.
     * @input  totalPages = 5, currentPage = 1, filters { name: 'x' }; handlePageChange(2)
     * @output getPaginatedData('core/things', 2, 15, { name: 'x' }); currentPage = 2
     */
    it('handlePageChange() loads the requested page with the current filters', () => {
      component.totalPages = 5;
      component.filters = { name: 'x' };
      ctx.genericTable.getPaginatedData.and.returnValue(of(paginated<Row>([{ id: 9 }], 2, 5)));
      component.handlePageChange(2);
      expect(ctx.genericTable.getPaginatedData).toHaveBeenCalledWith('core/things', 2, 15, { name: 'x' });
      expect(component.currentPage).toBe(2);
      expect(component.data).toEqual([{ id: 9 }]);
    });

    /**
     * @description Items per page change reloads from page 1 with the new page size.
     * @input  handleItemsPerPageChange(50)
     * @output itemsPerPage = 50; getPaginatedData(..., 1, 50, filters)
     */
    it('handleItemsPerPageChange() reloads page 1 with the new size', () => {
      component.handleItemsPerPageChange(50);
      expect(component.itemsPerPage).toBe(50);
      expect(ctx.genericTable.getPaginatedData).toHaveBeenCalledWith('core/things', 1, 50, component.filters);
    });

    /**
     * @description toggleTable switches between the active table and the trash.
     * @input  showTrashTable = false; toggleTable()
     * @output showTrashTable = true and the lists are reloaded
     */
    it('toggleTable() switches to the trash and reloads', () => {
      component.toggleTable();
      expect(component.showTrashTable).toBeTrue();
      expect(ctx.genericTable.getPaginatedData).toHaveBeenCalled();
    });

    /**
     * @description toggleFilters opens and closes the filter panel.
     * @input  toggleFilters() twice
     * @output isFilterVisible true, then false
     */
    it('toggleFilters() flips the filter panel', () => {
      component.toggleFilters();
      expect(component.isFilterVisible).toBeTrue();
      component.toggleFilters();
      expect(component.isFilterVisible).toBeFalse();
    });
  });

  describe('forms and details', () => {
    /**
     * @description Opening the create form clears any previously edited row.
     * @input  selectedItemForEdit = { id: 1 }; handleCreateFormOpened()
     * @output selectedItemForEdit = null; showCreateForm = true
     */
    it('handleCreateFormOpened() opens an empty form', () => {
      component.selectedItemForEdit = { id: 1 };
      component.handleCreateFormOpened();
      expect(component.selectedItemForEdit).toBeNull();
      expect(component.showCreateForm).toBeTrue();
    });

    /**
     * @description The edit form gets a shallow copy, so editing does not change the table row.
     * @input  row { id: 2, name: 'a' }; handleEditFormOpened(row)
     * @output selectedItemForEdit equals the row but is a different object; showCreateForm = true
     */
    it('handleEditFormOpened() edits a copy of the row', () => {
      const row = { id: 2, name: 'a' };
      component.handleEditFormOpened(row);
      expect(component.selectedItemForEdit).toEqual(row);
      expect(component.selectedItemForEdit).not.toBe(row);
      expect(component.showCreateForm).toBeTrue();
    });

    /**
     * @description Cancelling the form closes it and forgets the edited row.
     * @input  open edit form; onCancelForm()
     * @output showCreateForm = false; selectedItemForEdit = null
     */
    it('onCancelForm() closes the form', () => {
      component.handleEditFormOpened({ id: 3 });
      component.onCancelForm();
      expect(component.showCreateForm).toBeFalse();
      expect(component.selectedItemForEdit).toBeNull();
    });

    /**
     * @description Submitting a row without id creates it (POST) and shows the "created" alert.
     * @input  handleFormSubmitted({ name: 'new' })
     * @output DataHandler.post('core/things', { name: 'new' }); alert ('shared.success', 'crud_created_message', 'success'); form closed; refreshData()
     */
    it('handleFormSubmitted() creates a new row', async () => {
      component.showCreateForm = true;
      component.handleFormSubmitted({ name: 'new' });
      expect(ctx.dataHandler.post).toHaveBeenCalledWith('core/things', { name: 'new' });
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'crud_created_message', 'success');
      expect(component.showCreateForm).toBeFalse();
      expect(component.refreshCalls).toBe(1);
    });

    /**
     * @description Submitting a row with id updates it (PUT .../id) and shows the "updated" alert.
     * @input  handleFormSubmitted({ id: 7, name: 'x' })
     * @output DataHandler.put('core/things/7', row); alert message 'crud_updated_message'; refreshData()
     */
    it('handleFormSubmitted() updates an existing row', () => {
      component.handleFormSubmitted({ id: 7, name: 'x' });
      expect(ctx.dataHandler.put).toHaveBeenCalledWith('core/things/7', { id: 7, name: 'x' });
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'crud_updated_message', 'success');
      expect(component.refreshCalls).toBe(1);
    });

    /**
     * @description A failed save still closes the form but shows no success alert and does not reload.
     * @input  DataHandler.post fails; handleFormSubmitted({ name: 'x' })
     * @output showCreateForm = false; alert not called; refreshData() not called
     */
    it('handleFormSubmitted() closes the form without success alert on error', async () => {
      // the page has no error callback (DataHandler shows the error itself) – silence rxjs' unhandled-error report
      const previous = rxjsConfig.onUnhandledError;
      rxjsConfig.onUnhandledError = () => {};
      try {
        (ctx.dataHandler as any).post.and.returnValue(throwError(() => new Error('fail')));
        component.showCreateForm = true;
        component.handleFormSubmitted({ name: 'x' });
        await new Promise(resolve => setTimeout(resolve)); // rxjs reports unhandled errors in a macrotask
      } finally {
        rxjsConfig.onUnhandledError = previous;
      }
      expect(component.showCreateForm).toBeFalse();
      expect(ctx.alert.open).not.toHaveBeenCalled();
      expect(component.refreshCalls).toBe(0);
    });

    /**
     * @description Viewing details loads the row by id and opens the details panel.
     * @input  getOne returns { id: 5, name: 'd' }; handleViewDetails({ id: 5 })
     * @output getOne('core/things/5'); selectedItemForDetails = { id: 5, name: 'd' }; showDetails = true
     */
    it('handleViewDetails() loads the row and opens the details', () => {
      (ctx.dataHandler as any).getOne.and.returnValue(of({ id: 5, name: 'd' }));
      component.handleViewDetails({ id: 5 });
      expect((ctx.dataHandler as any).getOne).toHaveBeenCalledWith('core/things/5');
      expect(component.selectedItemForDetails).toEqual({ id: 5, name: 'd' });
      expect(component.showDetails).toBeTrue();
    });

    /**
     * @description Rows without id (e.g. placeholder rows) never open details.
     * @input  handleViewDetails({})
     * @output no request; showDetails = false
     */
    it('handleViewDetails() ignores rows without id', () => {
      component.handleViewDetails({});
      expect((ctx.dataHandler as any).getOne).not.toHaveBeenCalled();
      expect(component.showDetails).toBeFalse();
    });

    /**
     * @description Closing details clears the selected row.
     * @input  details open; handleCloseDetails()
     * @output selectedItemForDetails = null; showDetails = false
     */
    it('handleCloseDetails() closes the details', () => {
      component.selectedItemForDetails = { id: 1 };
      component.showDetails = true;
      component.handleCloseDetails();
      expect(component.selectedItemForDetails).toBeNull();
      expect(component.showDetails).toBeFalse();
    });

    /**
     * @description Deleting or restoring a row reloads the page data.
     * @input  handleItemDeleted(), handleItemRestored()
     * @output refreshData() called twice
     */
    it('handleItemDeleted() and handleItemRestored() reload the data', () => {
      component.handleItemDeleted();
      component.handleItemRestored();
      expect(component.refreshCalls).toBe(2);
    });
  });

  describe('toolbar', () => {
    /**
     * @description Toolbar action names map to the page handlers.
     * @input  handleToolbarAction('toggleFilters'), ('handleCreateFormOpened'), ('openGraphBuilder')
     * @output isFilterVisible = true; showCreateForm = true; showGraphBuilder = true
     */
    it('handleToolbarAction() dispatches known actions', () => {
      component.handleToolbarAction('toggleFilters');
      component.handleToolbarAction('handleCreateFormOpened');
      component.handleToolbarAction('openGraphBuilder');
      expect(component.isFilterVisible).toBeTrue();
      expect(component.showCreateForm).toBeTrue();
      expect(component.showGraphBuilder).toBeTrue();
    });

    /**
     * @description Unknown toolbar actions are ignored silently.
     * @input  handleToolbarAction('doesNotExist')
     * @output no exception, state unchanged
     */
    /**
     * @description Export and the active / trash switch are dispatched as well.
     * @input  handleToolbarAction('exportActiveTable'), ('toggleTable')
     * @output exportActiveTable() and toggleTable() called once each
     */
    it('handleToolbarAction() dispatches export and table toggling', () => {
      const exportSpy = spyOn(component, 'exportActiveTable');
      const toggleSpy = spyOn(component, 'toggleTable');
      component.handleToolbarAction('exportActiveTable');
      component.handleToolbarAction('toggleTable');
      expect(exportSpy).toHaveBeenCalledTimes(1);
      expect(toggleSpy).toHaveBeenCalledTimes(1);
    });

    /**
     * @description Unknown toolbar actions are ignored silently.
     * @input  handleToolbarAction('doesNotExist')
     * @output no exception, state unchanged
     */
    it('handleToolbarAction() ignores unknown actions', () => {
      expect(() => component.handleToolbarAction('doesNotExist')).not.toThrow();
      expect(component.isFilterVisible).toBeFalse();
    });

    /**
     * @description The import button opens the import of the active table; without a table nothing happens.
     * @input  handleToolbarAction('triggerImport') with an activeTable spy, then without a table
     * @output importData() called once; no error without a table
     */
    it('handleToolbarAction() starts the import of the active table', () => {
      const table = jasmine.createSpyObj('TableBuilderComponent', ['importData']);
      component.activeTable = table;
      component.handleToolbarAction('triggerImport');
      expect(table.importData).toHaveBeenCalledTimes(1);
      component.activeTable = undefined as any;
      expect(() => component.handleToolbarAction('triggerImport')).not.toThrow();
    });

    /**
     * @description Export calls the table's CSV export; without a table nothing happens.
     * @input  exportActiveTable() without a table, then with a table stub
     * @output no error; then exportToCSV() called once
     */
    it('exportActiveTable() exports the table when it exists', () => {
      expect(() => component.exportActiveTable()).not.toThrow();
      const table = jasmine.createSpyObj('TableBuilderComponent', ['exportToCSV']);
      component.activeTable = table;
      component.exportActiveTable();
      expect(table.exportToCSV).toHaveBeenCalledTimes(1);
    });

    /**
     * @description The graph builder opens and closes.
     * @input  openGraphBuilder(), closeGraphBuilder()
     * @output showGraphBuilder true, then false
     */
    it('openGraphBuilder() / closeGraphBuilder() toggle the graph builder', () => {
      component.openGraphBuilder();
      expect(component.showGraphBuilder).toBeTrue();
      component.closeGraphBuilder();
      expect(component.showGraphBuilder).toBeFalse();
    });
  });

  describe('CRUD helpers', () => {
    /**
     * @description loadData() without endpoint reports an error instead of calling the API.
     * @input  apiEndpoint = ''; loadData()
     * @output errorMessage = 'base-data.api_endpoint_undefined'; getCollection not called
     */
    it('loadData() reports a missing endpoint', () => {
      component.apiEndpoint = '';
      component.loadData();
      expect(component.errorMessage).toBe('base-data.api_endpoint_undefined');
      expect((ctx.dataHandler as any).getCollection).not.toHaveBeenCalled();
    });

    /**
     * @description loadData() stores the collection returned by the API.
     * @input  getCollection returns [{ id: 1 }]; loadData()
     * @output data = [{ id: 1 }]
     */
    it('loadData() stores the loaded collection', () => {
      (ctx.dataHandler as any).getCollection.and.returnValue(of([{ id: 1 }]));
      component.loadData();
      expect(component.data).toEqual([{ id: 1 }]);
    });

    /**
     * @description deleteData() with forceDelete adds ?force_delete=true.
     * @input  deleteData(4) and deleteData(4, true)
     * @output delete('core/things/4') and delete('core/things/4?force_delete=true')
     */
    it('deleteData() builds soft and force delete URLs', () => {
      component.deleteData(4).subscribe();
      component.deleteData(4, true).subscribe();
      expect((ctx.dataHandler as any).delete.calls.allArgs()).toEqual([['core/things/4'], ['core/things/4?force_delete=true']]);
    });

    /**
     * @description updateData()/getItemDetails() without id fail without calling the API.
     * @input  updateData(undefined, {}), getItemDetails(undefined)
     * @output both observables error with 'ID undefined.'; put/getOne not called
     */
    it('updateData() and getItemDetails() reject a missing id', () => {
      const errors: string[] = [];
      component.updateData(undefined, {}).subscribe({ error: e => errors.push(e.message) });
      component.getItemDetails(undefined).subscribe({ error: e => errors.push(e.message) });
      expect(errors).toEqual(['ID undefined.', 'ID undefined.']);
      expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();
    });

    /**
     * @description loadAllData() requests every row without pagination and skips empty filters.
     * @input  loadAllData({ name: 'a', empty: '' })
     * @output getCollection('core/things?no_pagination=true&name=a')
     */
    it('loadAllData() asks for all rows without pagination', () => {
      component.loadAllData({ name: 'a', empty: '' }).subscribe();
      expect((ctx.dataHandler as any).getCollection).toHaveBeenCalledWith('core/things?no_pagination=true&name=a');
    });

    /**
     * @description loadAllData() without endpoint fails with the translated error.
     * @input  apiEndpoint = ''; loadAllData()
     * @output error message 'base-data.api_endpoint_undefined'
     */
    it('loadAllData() fails without endpoint', () => {
      component.apiEndpoint = '';
      let message = '';
      component.loadAllData().subscribe({ error: e => (message = e.message) });
      expect(message).toBe('base-data.api_endpoint_undefined');
    });

    /**
     * @description uploadData() posts the form data to the given URL or the page endpoint.
     * @input  uploadData(fd), uploadData(fd, 'core/things/import')
     * @output upload('core/things', fd), upload('core/things/import', fd)
     */
    it('uploadData() uploads to the endpoint or a custom URL', () => {
      const fd = new FormData();
      component.uploadData(fd).subscribe();
      component.uploadData(fd, 'core/things/import').subscribe();
      expect((ctx.dataHandler as any).upload.calls.allArgs()).toEqual([['core/things', fd], ['core/things/import', fd]]);
    });
  });

  describe('destroy', () => {
    /**
     * @description Destroying the page stops pending requests (destroy$ completes).
     * @input  request in flight (never-completing observable); fixture.destroy()
     * @output subscription closed
     */
    it('ngOnDestroy() cancels running requests', () => {
      const pending = new Subject<Row[]>();
      (ctx.dataHandler as any).getCollection.and.returnValue(pending.asObservable());
      const sub = component.subscribeCollection();
      fixture.destroy();
      expect(sub.closed).toBeTrue();
    });
  });
});
