/**
 * @file table-builder.component.spec.ts
 * @path src/app/admin/components/builders/table-builder/table-builder.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of TableBuilderComponent – the main admin data table: cell formatting,
 *   button visibility by permission, row actions, delete with confirmation, bulk selection /
 *   bulk delete, locale-aware formatting (finding #50) and export (columns, excluded and redacted values, CSV/JSON/TXT, audit log).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, confirm/alert spies, auth & permission stubs)
 */

import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { SimpleChange, Component, ViewChild, TemplateRef } from '@angular/core';
import { of, throwError } from 'rxjs';

import { TableBuilderComponent } from './table-builder.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';


describe('TableBuilderComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<TableBuilderComponent>;
  let component: TableBuilderComponent;
  let downloads: { name: string; blob: Blob }[];

  const deleteButton: any = { type: 'delete_button', action: 'delete', isActive: true, display_name: 'Delete', permission: 'x-delete' };

  beforeEach(async () => {
    ctx = createAdminTestContext();
    ctx.i18n.getMergedSection.and.returnValue({ select_row_aria: 'Select {id}', bulk_count_label: '{count} selected' });
    await TestBed.configureTestingModule({ imports: [TableBuilderComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(TableBuilderComponent);
    component = fixture.componentInstance;
    component.apiEndpoint = 'core/users';
    component.data = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }];
    downloads = [];
    spyOn(component as any, 'triggerDownload').and.callFake((blob: Blob, name: string) => downloads.push({ name, blob }));
  });

  describe('cell values', () => {
    /**
     * @description Dotted keys read nested values; booleans are translated (`shared.yes` /
     *   `shared.no`, finding #50 - were English 'Yes' / 'No' in every language).
     * @input  getCellValue({ role: { name: 'admin' } }, 'role.name'); boolean 1 / 0
     * @output 'admin', 'shared.yes', 'shared.no' (the i18n stub returns the key)
     */
    it('reads nested values and formats booleans', () => {
      expect(component.getCellValue({ role: { name: 'admin' } }, { key: 'role.name' } as any)).toBe('admin');
      expect(component.getCellValue({ a: 1 }, { key: 'a', type: 'boolean' } as any)).toBe('shared.yes');
      expect(component.getCellValue({ a: 0 }, { key: 'a', type: 'boolean' } as any)).toBe('shared.no');
    });

    /**
     * @description Dates use the ONE admin format (admin-date-format.ts): the day by default, the
     *   day with time for a column with a time ('short', an own pattern with hours); a table
     *   never shows seconds ('medium'); empty dates are ''.
     * @input  '2026-03-04T05:06:07' with no format, 'short', 'd.M.yyyy H:mm', 'medium'; null
     * @output '4. 3. 2026', '4. 3. 2026 05:06' (3×), ''
     */
    it('formats dates', () => {
      const cell = (format?: string) => component.getCellValue({ d: '2026-03-04T05:06:07' }, { key: 'd', type: 'date', format } as any);
      expect(cell()).toBe('4. 3. 2026');
      expect(cell('short')).toBe('4. 3. 2026 05:06');
      expect(cell('d.M.yyyy H:mm')).toBe('4. 3. 2026 05:06');
      expect(cell('medium')).toBe('4. 3. 2026 05:06');
      expect(component.getCellValue({ d: null }, { key: 'd', type: 'date' } as any)).toBe('');
    });

    /**
     * @description Dates and currency follow the admin language (finding #50 - were always cs-CZ).
     * @input  getDateLocale() → 'en-US', English date pattern of the texts; date '2026-03-04'; 1234.5 EUR
     * @output '4 Mar 2026'; '€1,234.50'
     */
    it('formats dates and currency in the admin locale', () => {
      ctx.i18n.getDateLocale.and.returnValue('en-US');
      ctx.i18n.getValue.and.callFake((p: string) => ({ 'shared.date_format': 'd MMM yyyy' } as any)[p] ?? p);
      expect(component.getCellValue({ d: '2026-03-04' }, { key: 'd', type: 'date' } as any)).toBe('4 Mar 2026');
      expect(component.getCellValue({ p: 1234.5 }, { key: 'p', type: 'currency' } as any)).toBe('€1,234.50');
    });

    /**
     * @description Currency uses the column currency (default EUR) with 2 decimals; empty values are ''.
     * @input  12.5 with currencyCode 'czk'; 12.5 without code; ''
     * @output text with 'Kč'; text with '€'; ''
     */
    it('formats currency', () => {
      expect(component.getCellValue({ p: 12.5 }, { key: 'p', type: 'currency', currencyCode: 'czk' } as any)).toContain('Kč');
      expect(component.getCellValue({ p: 12.5 }, { key: 'p', type: 'currency' } as any)).toContain('€');
      expect(component.getCellValue({ p: '' }, { key: 'p', type: 'currency' } as any)).toBe('');
    });

    /**
     * @description Images get the uploads base URL prefix.
     * @input  uploadsBaseUrl 'https://cdn/'; value 'a.png'
     * @output 'https://cdn/a.png'
     */
    it('prefixes image paths', () => {
      component.uploadsBaseUrl = 'https://cdn/';
      expect(component.getCellValue({ img: 'a.png' }, { key: 'img', type: 'image' } as any)).toBe('https://cdn/a.png');
    });

    /**
     * @description An avatar column renders the photo of its signed URL as is, the default image
     *   without one.
     * @input  rows with avatar_url '/p.webp' and null; column type 'avatar'.
     * @output getCellValue '/p.webp' / null; first row img, second row default svg; the cell has
     *   the class without vertical padding (same row height as a text row).
     */
    it('renders avatar columns', () => {
      expect(component.getCellValue({ a: '/p.webp' }, { key: 'a', type: 'avatar' } as any)).toBe('/p.webp');
      expect(component.getCellValue({ a: '' }, { key: 'a', type: 'avatar' } as any)).toBeNull();
      component.data = [{ id: 1, a: '/p.webp' }, { id: 2, a: null }];
      component.columnDefinitions = [{ key: 'a', header: 'Photo', type: 'avatar' } as any];
      fixture.detectChanges();
      const rows = fixture.nativeElement.querySelectorAll('tbody tr');
      expect(rows[0].querySelector('app-user-avatar img').getAttribute('src')).toBe('/p.webp');
      expect(rows[1].querySelector('app-user-avatar svg.user-avatar--default')).not.toBeNull();
      expect(rows[0].querySelector('app-user-avatar').closest('td').classList).toContain('table-cell-avatar');
    });

    /**
     * @description Select values show the option label.
     * @input  inputDefinitions role options { 1: 'Admin' }; value 1
     * @output 'Admin'
     */
    it('shows option labels for select columns', () => {
      component.inputDefinitions = [{ column_name: 'role', options: [{ value: 1, label: 'Admin' }] } as any];
      expect(component.getCellValue({ role: 1 }, { key: 'role' } as any)).toBe('Admin');
    });
  });

  describe('buttons', () => {
    /**
     * @description Buttons with a permission are visible only when it (or one of "a|b") is granted.
     * @input  granted ['b']; buttons with permission 'a', 'a|b', none
     * @output false, true, true
     */
    it('checks button permissions', () => {
      ctx.permissions.granted = new Set(['b']);
      expect(component.isButtonVisible({ permission: 'a' } as any)).toBeFalse();
      expect(component.isButtonVisible({ permission: 'a|b' } as any)).toBeTrue();
      expect(component.isButtonVisible({} as any)).toBeTrue();
    });

    /**
     * @description visibleWhen hides a button for rows that do not match; the column hides when no row matches.
     * @input  button visibleWhen(item => item.id === 2)
     * @output row 1 false, row 2 true; column visible; with data [{id: 1}] column hidden
     */
    it('applies visibleWhen per row and per column', () => {
      const btn: any = { visibleWhen: (i: any) => i.id === 2 };
      expect(component.isButtonVisibleForItem(btn, { id: 1 })).toBeFalse();
      expect(component.isButtonVisibleForItem(btn, { id: 2 })).toBeTrue();
      expect(component.isButtonColumnVisible(btn)).toBeTrue();
      component.data = [{ id: 1 }];
      expect(component.isButtonColumnVisible(btn)).toBeFalse();
    });

    /**
     * @description Row actions emit the matching event (asynchronously).
     * @input  handleAction(row, 'edit'), ('details'), ('password_reset') with different rows
     * @output editFormOpened, viewDetailsOpened, resetPasswordFormOpened each emit their row
     */
    it('handleAction() emits the matching event', fakeAsync(() => {
      const got: string[] = [];
      component.editFormOpened.subscribe(i => got.push(`edit:${i.id}`));
      component.viewDetailsOpened.subscribe(i => got.push(`details:${i.id}`));
      component.resetPasswordFormOpened.subscribe(i => got.push(`pwd:${i.id}`));
      component.handleAction({ id: 1 }, 'edit');
      component.handleAction({ id: 2 }, 'details');
      component.handleAction({ id: 3 }, 'password_reset');
      tick(600);
      expect(got).toEqual(['edit:1', 'details:2', 'pwd:3']);
    }));

    /**
     * @description A second click on the same row within 500 ms is ignored (no double action).
     * @input  handleAction(row 1, 'edit') twice immediately; then again after 600 ms
     * @output editFormOpened emitted twice in total (first and third call)
     */
    it('handleAction() ignores double clicks on the same row', fakeAsync(() => {
      let count = 0;
      component.editFormOpened.subscribe(() => count++);
      component.handleAction({ id: 1 }, 'edit');
      component.handleAction({ id: 1 }, 'edit');
      tick(600);
      component.handleAction({ id: 1 }, 'edit');
      tick(600);
      expect(count).toBe(2);
    }));
  });

  describe('delete', () => {
    /**
     * @description Confirmed delete calls the API, removes the row and shows success.
     * @input  confirm → true; onDeleteAction(row 2)
     * @output DELETE 'core/users/2'; row 2 removed; itemDeleted emitted; success alert
     */
    it('deletes a row after confirmation', fakeAsync(() => {
      let deleted: any;
      component.itemDeleted.subscribe(i => (deleted = i));
      component.onDeleteAction({ id: 2 });
      flush();
      expect(ctx.confirm.open).toHaveBeenCalledWith('table-builder.confirm_delete_title', 'table-builder.confirm_delete_message');
      expect((ctx.dataHandler as any).delete).toHaveBeenCalledWith('core/users/2');
      expect(component.data.map(d => d.id)).toEqual([1, 3]);
      expect(deleted).toEqual({ id: 2 });
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'table-builder.delete_success_message', 'success');
    }));

    /**
     * @description Cancelled delete does not call the API.
     * @input  confirm → false; onDeleteAction(row 2)
     * @output delete not called; 3 rows remain
     */
    it('keeps the row when the delete is cancelled', fakeAsync(() => {
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      component.onDeleteAction({ id: 2 });
      flush();
      expect((ctx.dataHandler as any).delete).not.toHaveBeenCalled();
      expect(component.data.length).toBe(3);
    }));
  });

  describe('bulk selection', () => {
    // Bulk deletion is opt-in (VT-14); the tests below run on a table that has the endpoint.
    beforeEach(() => { component.bulkDeleteEnabled = true; });

    /**
     * @description In the administrators table the logged-in user cannot be selected.
     * @input  isAdminTable true, logged-in user id '2'
     * @output selectableIds [1, 3]; isSelectionDisabled(row 2) true
     */
    it('excludes the logged-in admin from selection', () => {
      component.isAdminTable = true;
      ctx.auth.session.userId = '2';
      expect(component.selectableIds).toEqual([1, 3]);
      expect(component.isSelectionDisabled({ id: 2 })).toBeTrue();
    });

    /**
     * @description Select-all selects every selectable row; the partial state is detected.
     * @input  toggleSelection(1, checked); then toggleSelectAllOnPage(checked)
     * @output isSomeOnPageSelected true after the first; isAllOnPageSelected true after select-all
     */
    it('select-all and partial selection', () => {
      component.toggleSelection(1, { target: { checked: true } } as any);
      expect(component.isSomeOnPageSelected).toBeTrue();
      component.toggleSelectAllOnPage({ target: { checked: true } } as any);
      expect(component.isAllOnPageSelected).toBeTrue();
      expect(component.isSomeOnPageSelected).toBeFalse();
      component.toggleSelectAllOnPage({ target: { checked: false } } as any);
      expect(component.selectedIds.size).toBe(0);
    });

    /**
     * @description New data (next page, reload) clears the selection.
     * @input  2 selected; ngOnChanges(data change, not first)
     * @output selectedIds empty; showBulkMenu false
     */
    it('clears the selection when the data changes', () => {
      component.selectedIds.add(1);
      component.showBulkMenu = true;
      component.ngOnChanges({ data: new SimpleChange([], [], false) });
      expect(component.selectedIds.size).toBe(0);
      expect(component.showBulkMenu).toBeFalse();
    });

    /**
     * @description Bulk delete is available only when the table enables it (opt-in, VT-14 - only
     *   resources with a bulk-delete endpoint) AND has an active, permitted delete button.
     * @input  buttons [deleteButton]; granted 'x-delete' / none; bulkDeleteEnabled false (the default of a new component)
     * @output true; false without permission; false when not enabled, also with the permission
     */
    it('canBulkDelete depends on the delete button and permission', () => {
      component.buttons = [deleteButton];
      ctx.permissions.granted = new Set(['x-delete']);
      expect(component.canBulkDelete).toBeTrue();
      ctx.permissions.granted = new Set();
      expect(component.canBulkDelete).toBeFalse();
      ctx.permissions.granted = 'all';
      component.bulkDeleteEnabled = false;
      expect(component.canBulkDelete).toBeFalse();
      expect(TestBed.createComponent(TableBuilderComponent).componentInstance.bulkDeleteEnabled).toBeFalse();
    });

    /**
     * @description Bulk delete posts the ids, removes the rows and reports full success.
     * @input  selected [1, 3]; API { deleted_count: 2, skipped_count: 0, requested: 2 }
     * @output POST 'core/users/bulk-delete' { ids: [1, 3] }; rows [2] left; success alert; itemDeleted emits [1, 3]
     */
    it('bulk deletes the selected rows', async () => {
      component.buttons = [deleteButton];
      component.selectedIds = new Set([1, 3]);
      (ctx.dataHandler as any).post.and.returnValue(of({ deleted_count: 2, skipped_count: 0, requested: 2 }));
      let emitted: any;
      component.itemDeleted.subscribe(v => (emitted = v));
      await component.onBulkDeleteClick();
      expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('core/users/bulk-delete', { ids: [1, 3] });
      expect(component.data.map(d => d.id)).toEqual([2]);
      expect(ctx.alert.open.calls.mostRecent().args[2]).toBe('success');
      expect(emitted).toEqual([1, 3]);
      expect(component.bulkDeleting).toBeFalse();
    });

    /**
     * @description Partial and failed bulk deletes show warning / danger.
     * @input  API { deleted_count: 1, skipped_count: 1 }, then { deleted_count: 0, skipped_count: 2 }
     * @output alert type 'warning', then 'danger'
     */
    it('reports partial and failed bulk deletes', async () => {
      component.buttons = [deleteButton];
      component.selectedIds = new Set([1, 2]);
      (ctx.dataHandler as any).post.and.returnValue(of({ deleted_count: 1, skipped_count: 1, requested: 2 }));
      await component.onBulkDeleteClick();
      expect(ctx.alert.open.calls.mostRecent().args[2]).toBe('warning');
      component.selectedIds = new Set([3]);
      (ctx.dataHandler as any).post.and.returnValue(of({ deleted_count: 0, skipped_count: 1, requested: 1 }));
      await component.onBulkDeleteClick();
      expect(ctx.alert.open.calls.mostRecent().args[2]).toBe('danger');
    });

    /**
     * @description Bulk delete does nothing when cancelled or nothing is selected.
     * @input  no selection → click; selection + confirm false → click
     * @output post never called
     */
    it('bulk delete needs a selection and a confirmation', async () => {
      component.buttons = [deleteButton];
      await component.onBulkDeleteClick();
      component.selectedIds = new Set([1]);
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.onBulkDeleteClick();
      expect((ctx.dataHandler as any).post).not.toHaveBeenCalled();
    });

    /**
     * @description The labels use the selected count and row id.
     * @input  2 selected; rowSelectAriaLabel(7)
     * @output bulkCountLabel '2 selected'; aria 'Select 7'
     */
    it('builds the bulk and row labels', () => {
      component.selectedIds = new Set([1, 2]);
      expect(component.bulkCountLabel).toBe('2 selected');
      expect(component.rowSelectAriaLabel(7)).toBe('Select 7');
    });
  });

  describe('export', () => {
    beforeEach(() => {
      component.tableCaption = 'users';
      component.detailsColumns = [
        { key: 'id', displayName: 'ID', importable: false },
        { key: 'name', displayName: 'Name', importable: true },
        { key: 'password', displayName: 'Password' },
        { key: 'meta', displayName: 'Meta' }
      ];
    });

    /**
     * @description Opening the export offers all detail columns except sensitive ones.
     * @input  exportToCSV()
     * @output showExportPopup true; exportable columns ['id', 'name', 'meta'] (password excluded); importable ['name']
     */
    it('exportToCSV() opens the popup without sensitive columns', () => {
      component.exportToCSV();
      expect(component.showExportPopup).toBeTrue();
      expect(component.exportableColumnOptions.map(c => c.key)).toEqual(['id', 'name', 'meta']);
      expect(component.importableColumnOptions.map(c => c.key)).toEqual(['name']);
    });

    /**
     * @description CSV export loads all rows (no pagination) and writes ';'-separated, quoted values.
     * @input  API returns [{ id: 1, name: 'A"x', password: 's', meta: { token: 't', ok: 1 } }]; CSV, columns id/name/meta
     * @output getCollection('core/users', { no_pagination: 'true', sort_by: 'id', sort_direction: 'desc' }); file 'users.csv'; header 'ID;Name;Meta'; quote escaped; token redacted
     */
    it('exports CSV with redacted JSON and escaped quotes', async () => {
      (ctx.dataHandler as any).getCollection.and.returnValue(of([{ id: 1, name: 'A"x', password: 's', meta: { token: 't', ok: 1 } }]));
      await component.handleExportFormatSelected({ format: 'csv', columnKeys: ['id', 'name', 'meta'], rawFormat: false });
      expect((ctx.dataHandler as any).getCollection).toHaveBeenCalledWith('core/users', { no_pagination: 'true', export: 'csv', sort_by: 'id', sort_direction: 'desc' });
      expect(downloads[0].name).toBe('users.csv');
      const csv = await downloads[0].blob.text();
      expect(csv.split('\n')[0]).toBe('ID;Name;Meta');
      expect(csv).toContain('"A""x"');
      expect(csv).toContain('••••••••');
      expect(csv).not.toContain('"t"');
    });

    /**
     * @description SECURITY (CSV injection): a value that would start a spreadsheet formula is
     *   exported as text (apostrophe in front) in CSV and TXT; numbers stay unchanged.
     * @input  API returns [{ id: -1, name: '=HYPERLINK("http://x","y")' }]; CSV, then TXT, columns id/name
     * @output CSV cell "'=HYPERLINK(""http://x"",""y"")" and "-1"; TXT line "-1\t'=HYPERLINK(…)"
     */
    it('neutralises formulas in CSV and TXT exports', async () => {
      (ctx.dataHandler as any).getCollection.and.returnValue(of([{ id: -1, name: '=HYPERLINK("http://x","y")' }]));
      await component.handleExportFormatSelected({ format: 'csv', columnKeys: ['id', 'name'], rawFormat: false });
      const csv = await downloads[0].blob.text();
      expect(csv.split('\n')[1]).toBe(`"-1";"'=HYPERLINK(""http://x"",""y"")"`);

      await component.handleExportFormatSelected({ format: 'txt', columnKeys: ['id', 'name'], rawFormat: false });
      const txt = await downloads[1].blob.text();
      expect(txt.split('\n')[1]).toBe(`-1\t'=HYPERLINK("http://x","y")`);
    });

    /**
     * @description Exporting selected rows loads the data from the API with `export` (the server
     *   logs the export), keeps only the selected rows and adds the translated suffix
     *   `table-builder.export_selected_suffix` (finding #50 - was always '-vybrane').
     * @input  selection [2]; API rows A (1), B (2); suffix 'vybrane'; onBulkExportClick(); JSON export
     * @output getCollection with export 'json'; file 'users-vybrane.json' with 1 row (Name 'B')
     */
    it('exports only the selected rows', async () => {
      ctx.i18n.getValue.and.callFake((p: string) => (p === 'table-builder.export_selected_suffix' ? 'vybrane' : p));
      (ctx.dataHandler as any).getCollection.and.returnValue(of([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]));
      component.selectedIds = new Set([2]);
      component.onBulkExportClick();
      await component.handleExportFormatSelected({ format: 'json', columnKeys: ['name'], rawFormat: false });
      expect((ctx.dataHandler as any).getCollection.calls.mostRecent().args[1].export).toBe('json');
      expect(downloads[0].name).toBe('users-vybrane.json');
      expect(JSON.parse(await downloads[0].blob.text())).toEqual([{ Name: 'B' }]);
    });

    /**
     * @description Raw export uses column keys (import-compatible) and only importable columns.
     * @input  TXT raw export, API rows [{ id: 1, name: 'A' }]
     * @output file 'users-raw.txt'; header 'name'; row 'A'
     */
    it('raw export writes importable columns by key', async () => {
      (ctx.dataHandler as any).getCollection.and.returnValue(of([{ id: 1, name: 'A' }]));
      await component.handleExportFormatSelected({ format: 'txt', columnKeys: null, rawFormat: true });
      expect(downloads[0].name).toBe('users-raw.txt');
      expect(await downloads[0].blob.text()).toBe('name\nA\n');
    });

    /**
     * @description Every export is audited by the server: the data is loaded with `export`
     *   (`raw_<format>` for the import-compatible variant); the browser writes no log.
     * @input  CSV export; raw TXT export
     * @output getCollection('core/users', {…, no_pagination, export 'csv'}), then export 'raw_txt'; no POST
     */
    it('loads the export data with the export parameter (logged by the server)', async () => {
      (ctx.dataHandler as any).getCollection.and.returnValue(of([{ id: 1, name: 'A' }]));
      await component.handleExportFormatSelected({ format: 'csv', columnKeys: null, rawFormat: false });
      const [url, params] = (ctx.dataHandler as any).getCollection.calls.mostRecent().args;
      expect(url).toBe('core/users');
      expect(params).toEqual(jasmine.objectContaining({ no_pagination: 'true', export: 'csv' }));
      await component.handleExportFormatSelected({ format: 'txt', columnKeys: null, rawFormat: true });
      expect((ctx.dataHandler as any).getCollection.calls.mostRecent().args[1].export).toBe('raw_txt');
      expect((ctx.dataHandler as any).post).not.toHaveBeenCalled();
    });

    /**
     * @description An empty result shows a warning and downloads nothing.
     * @input  API returns []
     * @output alert ('table-builder.export_no_data_title', …, 'warning'); no download; popup closed
     */
    it('warns when there is nothing to export', async () => {
      component.showExportPopup = true;
      await component.handleExportFormatSelected({ format: 'csv', columnKeys: null, rawFormat: false });
      expect(ctx.alert.open).toHaveBeenCalledWith('table-builder.export_no_data_title', 'table-builder.export_no_data_message', 'warning');
      expect(downloads.length).toBe(0);
      expect(component.showExportPopup).toBeFalse();
    });

    /**
     * @description A non-HTTP export failure shows the generic export error.
     * @input  getCollection throws Error('x')
     * @output alert ('shared.error', 'table-builder.export_error_message', 'danger'); isExporting false
     */
    it('reports export errors', async () => {
      (ctx.dataHandler as any).getCollection.and.returnValue(throwError(() => new Error('x')));
      spyOn(console, 'error');
      await component.handleExportFormatSelected({ format: 'csv', columnKeys: null, rawFormat: false });
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.error', 'table-builder.export_error_message', 'danger');
      expect(component.isExporting).toBeFalse();
    });

    /**
     * @description The popup cannot be closed while an export runs.
     * @input  isExporting true → closeExportPopup()
     * @output showExportPopup stays true
     */
    it('closeExportPopup() is blocked while exporting', () => {
      component.showExportPopup = true;
      component.isExporting = true;
      component.closeExportPopup();
      expect(component.showExportPopup).toBeTrue();
    });
  });

  describe('misc', () => {
    /**
     * @description Import hints list importable select columns with their options.
     * @input  detailsColumns role (importable) + inputDefinitions role options
     * @output [{ key: 'role', label: 'Role', options: [...] }]
     */
    it('builds import enum hints', () => {
      component.detailsColumns = [{ key: 'role', displayName: 'Role', importable: true }, { key: 'x', displayName: 'X', importable: true }];
      component.inputDefinitions = [{ column_name: 'role', options: [{ value: '1', label: 'Admin' }] } as any];
      expect(component.importEnumHints).toEqual([{ key: 'role', label: 'Role', options: [{ value: '1', label: 'Admin' }] }]);
    });

    /**
     * @description colspan = checkbox column + data columns + visible active button columns.
     * @input  2 columns, buttons [active, inactive]
     * @output 1 + 2 + 1 = 4
     */
    it('computes the colspan', () => {
      component.columnDefinitions = [{ key: 'a' }, { key: 'b' }] as any;
      component.buttons = [{ isActive: true } as any, { isActive: false } as any];
      expect(component.colspanValue).toBe(4);
    });

    /**
     * @description Refresh and import buttons forward their events.
     * @input  onRefreshClick(); importData(); onImportCompleted()
     * @output refreshRequested emitted; showImportPopup true; importCompleted emitted
     */
    it('forwards refresh and import events', () => {
      let refresh = 0, imported = 0;
      component.refreshRequested.subscribe(() => refresh++);
      component.importCompleted.subscribe(() => imported++);
      component.onRefreshClick();
      component.importData();
      component.onImportCompleted();
      expect(refresh).toBe(1);
      expect(component.showImportPopup).toBeTrue();
      expect(imported).toBe(1);
    });

    /**
     * @description The table renders one row per data item.
     * @input  3 rows, column 'name'
     * @output 3 body rows containing 'A', 'B', 'C'
     */
    it('renders the rows', () => {
      component.columnDefinitions = [{ key: 'name', header: 'Name' } as any];
      fixture.detectChanges();
      const text = fixture.nativeElement.querySelector('tbody')?.textContent ?? '';
      expect(text).toContain('A');
      expect(text).toContain('B');
      expect(text).toContain('C');
    });
  });
  describe('remaining actions and exports', () => {
    /**
     * @description Every other row action emits its own event; unknown actions only warn.
     * @input handleAction with generate_form, resend_activation, custom_prod_var, custom_prod_img, customer_orders, anonymize, unknown.
     * @output Each event emitted once with the row; console.warn for 'unknown'.
     */
    it('emits the remaining row action events', fakeAsync(() => {
      const got: string[] = [];
      component.generateFormOpened.subscribe(() => got.push('generate_form'));
      component.resendActivationOpened.subscribe(() => got.push('resend_activation'));
      component.openVariantsModal.subscribe(() => got.push('custom_prod_var'));
      component.openImagesModal.subscribe(() => got.push('custom_prod_img'));
      component.customerOrdersOpened.subscribe(() => got.push('customer_orders'));
      component.anonymizeRequested.subscribe(() => got.push('anonymize'));
      spyOn(console, 'warn');
      ['generate_form', 'resend_activation', 'custom_prod_var', 'custom_prod_img', 'customer_orders', 'anonymize', 'unknown']
        .forEach((action, i) => component.handleAction({ id: 10 + i }, action));
      tick(600);
      expect(got).toEqual(['generate_form', 'resend_activation', 'custom_prod_var', 'custom_prod_img', 'customer_orders', 'anonymize']);
      expect(console.warn).toHaveBeenCalledWith('Unknown action type:', 'unknown');
    }));

    /**
     * @description A failed delete and a rejected confirm release the row lock (row stays).
     * @input delete API error; confirm promise rejected.
     * @output 3 rows; processing set empty both times.
     */
    it('releases the row after a failed or aborted delete', fakeAsync(() => {
      (ctx.dataHandler as any).delete.and.returnValue(throwError(() => new Error('x')));
      (component as any).processingItemIds.add(2);
      component.onDeleteAction({ id: 2 });
      flush();
      expect(component.data.length).toBe(3);
      expect((component as any).processingItemIds.size).toBe(0);

      ctx.confirm.open.and.returnValue(Promise.reject(new Error('closed')));
      (component as any).processingItemIds.add(3);
      component.onDeleteAction({ id: 3 });
      flush();
      expect((component as any).processingItemIds.size).toBe(0);
    }));

    /**
     * @description Selection helpers: untick a row, clear all, bulk menu toggled and closed by a document click.
     * @input select 1 + 2, untick 2; toggleBulkMenu; document click; clearSelection.
     * @output {1}; menu open → closed on click; selection empty and menu closed.
     */
    it('manages the selection and the bulk menu', () => {
      component.toggleSelection(1, { target: { checked: true } } as any);
      component.toggleSelection(2, { target: { checked: true } } as any);
      component.toggleSelection(2, { target: { checked: false } } as any);
      expect([...component.selectedIds]).toEqual([1]);
      component.toggleBulkMenu();
      expect(component.showBulkMenu).toBeTrue();
      component.onDocumentClick();
      expect(component.showBulkMenu).toBeFalse();
      component.onDocumentClick();
      component.toggleBulkMenu();
      component.clearSelection();
      expect([component.selectedIds.size, component.showBulkMenu]).toEqual([0, false]);
    });

    /**
     * @description Currency that cannot be formatted falls back to "value CODE".
     * @input value 'abc' with currency.
     * @output 'abc EUR'.
     */
    it('falls back for unformattable currency values', () => {
      expect(component.getCellValue({ p: 'abc' }, { key: 'p', type: 'currency' } as any)).toBe('abc EUR');
    });

    /**
     * @description Export values: checkbox → 'true' / 'false', select → option label, dates
     *   formatted (invalid kept), nested arrays redacted; raw export keeps objects as JSON.
     * @input Rows with flag 1 / 0, role 1, date valid / invalid, list [{password}]; JSON + raw JSON.
     * @output 'true', 'false', 'Admin', '4.3.2026', 'bad-date', redacted list; raw: object JSON string.
     */
    it('maps values for the export', async () => {
      component.tableCaption = 'users';
      component.detailsColumns = [
        { key: 'flag', displayName: 'Flag' }, { key: 'role', displayName: 'Role' },
        { key: 'day', displayName: 'Day', type: 'date' }, { key: 'list', displayName: 'List', importable: true }
      ] as any;
      component.inputDefinitions = [{ column_name: 'flag', type: 'checkbox' }, { column_name: 'role', options: [{ value: 1, label: 'Admin' }] }] as any;
      (ctx.dataHandler as any).getCollection.and.returnValue(of([
        { id: 1, flag: 1, role: 1, day: '2026-03-04', list: [{ password: 'x', a: 1 }] },
        { id: 2, flag: 0, role: 9, day: 'bad-date', list: null }
      ]));
      await component.handleExportFormatSelected({ format: 'json', columnKeys: null, rawFormat: false });
      expect(JSON.parse(await downloads[0].blob.text())).toEqual([
        { Flag: 'true', Role: 'Admin', Day: '4. 3. 2026', List: '[{"password":"••••••••","a":1}]' },
        { Flag: 'false', Role: 9, Day: 'bad-date', List: '' }
      ]);
      await component.handleExportFormatSelected({ format: 'json', columnKeys: null, rawFormat: true });
      expect(JSON.parse(await downloads[1].blob.text())).toEqual([{ list: '[{"password":"x","a":1}]' }, { list: '' }]);
    });

    /**
     * @description XLSX export writes a workbook download named after the table; popup close /
     *   import popup state.
     * @input XLSX export (anchor download captured); closeExportPopup; importData / closeImportPopup.
     * @output a download 'users.xlsx'; popup closed; import popup open → closed; hasImportableColumns true.
     */
    it('exports XLSX and handles the popups', async () => {
      component.tableCaption = 'users';
      component.detailsColumns = [{ key: 'name', displayName: 'Name', importable: true }] as any;
      const names: string[] = [];
      spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) { names.push(this.download); });
      spyOn(HTMLAnchorElement.prototype, 'dispatchEvent').and.callFake(function (this: HTMLAnchorElement) { names.push(this.download); return true; });
      spyOn(URL, 'createObjectURL').and.returnValue('blob:x');
      (ctx.dataHandler as any).getCollection.and.returnValue(of([{ id: 1, name: 'A' }]));
      await component.handleExportFormatSelected({ format: 'xlsx', columnKeys: null, rawFormat: false });
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(names).toContain('users.xlsx');

      component.showExportPopup = true;
      component.exportSelectedOnly = true;
      component.closeExportPopup();
      expect([component.showExportPopup, component.exportSelectedOnly]).toEqual([false, false]);
      expect(component.hasImportableColumns).toBeTrue();
      component.importData();
      expect(component.showImportPopup).toBeTrue();
      component.closeImportPopup();
      expect(component.showImportPopup).toBeFalse();
    });
  });

  describe('clickable rows (record popup)', () => {
    const columns: any[] = [
      { key: 'id', header: 'ID', type: 'text' },
      { key: 'name', header: 'Name', type: 'text' },
      { key: 'mail', header: 'Mail', type: 'link' },
    ];
    const buttons: any[] = [
      { type: 'info_button', action: 'details', isActive: true, display_name: 'Detail' },
      { type: 'neutral_button', action: 'edit', isActive: true, display_name: 'Edit', permission: 'x-update', visibleWhen: (i: any) => i.id !== 3 },
      deleteButton,
      { type: 'neutral_button', action: 'resend_activation', isActive: true, display_name: 'Resend', visibleWhen: (i: any) => i.id === 2 },
    ];
    const render = (open = true) => {
      fixture.componentRef.setInput('columns', columns);
      fixture.componentRef.setInput('buttons', buttons);
      fixture.componentRef.setInput('openOnRowClick', open);
      fixture.componentRef.setInput('data', [{ id: 1, name: 'A', mail: 'https://a.test' }, { id: 2, name: 'B' }]);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    /**
     * @description With `openOnRowClick` the row button columns are gone, the rows are focusable
     *   and the main column is the first after id (or the one marked primary); without it the
     *   table is unchanged.
     * @input render with / without openOnRowClick; a column marked primary.
     * @output no .button-header / .action-button-cell, tr.row-clickable tabindex 0, td.table-cell-primary
     *   on 'name'; primary 'mail' when marked; without the flag the 4 button columns are back.
     */
    it('hides the row buttons and marks the main column', () => {
      const el = render();
      expect(el.querySelectorAll('.button-header, .action-button-cell').length).toBe(0);
      const row = el.querySelector('tbody tr') as HTMLElement;
      expect(row.classList).toContain('row-clickable');
      expect(row.getAttribute('tabindex')).toBe('0');
      expect(component.primaryColumnKey).toBe('name');
      expect(row.querySelector('td.table-cell-primary')!.textContent!.trim()).toBe('A');
      expect(component.colspanValue).toBe(1 + columns.length);
      fixture.componentRef.setInput('columns', [columns[0], columns[1], { ...columns[2], primary: true }]);
      expect(component.primaryColumnKey).toBe('mail');

      fixture.componentRef.setInput('columns', columns);
      const plain = render(false);
      expect(plain.querySelectorAll('thead .button-header').length).toBe(4);
      expect(plain.querySelector('tbody tr')!.getAttribute('tabindex')).toBeNull();
    });

    /**
     * @description A click on a row opens it; a click on its checkbox or link, or the end of a text
     *   selection inside the row does not; Enter on the focused row opens it, Enter on a control
     *   inside does not; without the flag nothing is emitted.
     * @input clicks on the main cell, the checkbox, the link; a selection; Enter on the row / input.
     * @output rowOpened once for the cell click and once for Enter; nothing else.
     */
    it('opens a row by click or Enter but not from its controls', () => {
      const el = render();
      const opened = spyOn(component.rowOpened, 'emit');
      const row = el.querySelector('tbody tr') as HTMLElement;
      (row.querySelector('td.table-cell-primary') as HTMLElement).click();
      expect(opened).toHaveBeenCalledOnceWith(jasmine.objectContaining({ id: 1 }));
      (row.querySelector('.checkbox-cell input') as HTMLElement).click();
      (row.querySelector('a') as HTMLElement).addEventListener('click', e => e.preventDefault());
      (row.querySelector('a') as HTMLElement).click();
      expect(opened).toHaveBeenCalledTimes(1);

      const cell = row.querySelector('td.table-cell-primary') as HTMLElement;
      const range = document.createRange();
      range.selectNodeContents(cell);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(range);
      cell.click();
      expect(opened).toHaveBeenCalledTimes(1);
      window.getSelection()!.removeAllRanges();

      row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(opened).toHaveBeenCalledTimes(2);
      (row.querySelector('.checkbox-cell input') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(opened).toHaveBeenCalledTimes(2);

      fixture.componentRef.setInput('openOnRowClick', false);
      component.onRowClick(new MouseEvent('click'), { id: 1 });
      expect(opened).toHaveBeenCalledTimes(2);
    });

    /**
     * @description The record popup gets the same rules as the row buttons: edit = the edit button
     *   with its permission and visibleWhen; actions = the other buttons the user may use on the
     *   record (not details / edit); the own account of an admin table cannot be deleted.
     * @input permissions x-update + x-delete, then none; records 1, 2, 3; admin table with own id 1.
     * @output canEditRecord 1 true, 3 false (visibleWhen), without permission false; actions of 1
     *   [delete], of 2 [delete, resend_activation], without permission [] / [resend]; admin own [].
     */
    it('gives the record popup the rules of the row buttons', () => {
      render();
      ctx.permissions.granted = new Set(['x-update', 'x-delete']);
      expect(component.canEditRecord({ id: 1 })).toBeTrue();
      expect(component.canEditRecord({ id: 3 })).toBeFalse();
      expect(component.recordActions({ id: 1 }).map(b => b.action)).toEqual(['delete']);
      expect(component.recordActions({ id: 2 }).map(b => b.action)).toEqual(['delete', 'resend_activation']);
      ctx.permissions.granted = new Set();
      expect(component.canEditRecord({ id: 1 })).toBeFalse();
      expect(component.recordActions({ id: 1 })).toEqual([]);
      expect(component.recordActions({ id: 2 }).map(b => b.action)).toEqual(['resend_activation']);
      ctx.permissions.granted = 'all';
      fixture.componentRef.setInput('isAdminTable', true);
      expect(component.recordActions({ id: 1 }).map(b => b.action)).toEqual([]);
      expect(component.recordActions({ id: 5 }).map(b => b.action)).toEqual(['delete']);
      fixture.componentRef.setInput('buttons', []);
      expect(component.canEditRecord({ id: 1 })).toBeFalse();
    });
  });

  describe('coloured labels', () => {
    /**
     * @description A column with tones shows its (translated) text in a coloured label with the
     *   tone of the raw value - also when the cell shows a label of another field (toneKey);
     *   an empty value and a column without tones have no label.
     * @input columns priority (tones), status_label (toneKey status), name; rows high / empty.
     * @output label 'warning' with 'High'; label 'success' with 'Paid'; empty priority without a
     *   label; plain text for name; export value stays the text.
     */
    it('shows status and priority values as coloured labels', () => {
      const tones = { high: 'warning', paid: 'success' } as any;
      fixture.componentRef.setInput('columns', [
        { key: 'priority', header: 'P', type: 'text', tones },
        { key: 'status_label', header: 'S', type: 'text', tones, toneKey: 'status' },
        { key: 'name', header: 'N', type: 'text' },
      ]);
      fixture.componentRef.setInput('inputDefinitions', [{ column_name: 'priority', type: 'select', options: [{ value: 'high', label: 'High' }] }]);
      fixture.componentRef.setInput('data', [{ id: 1, priority: 'high', status: 'paid', status_label: 'Paid', name: 'A' }, { id: 2, priority: '', status: null, status_label: '', name: 'B' }]);
      fixture.detectChanges();
      const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'));
      const badges = Array.from(rows[0].querySelectorAll('.table-badge')) as HTMLElement[];
      expect(badges.map(b => [b.dataset['tone'], b.textContent!.trim()])).toEqual([['warning', 'High'], ['success', 'Paid']]);
      expect(rows[1].querySelectorAll('.table-badge').length).toBe(0);
      expect(component.badgeTone({ name: 'A' }, { key: 'name' } as any)).toBeNull();
      expect(component.getCellValue({ priority: 'high' }, { key: 'priority', tones } as any)).toBe('High');
    });
  });

  describe('one-row footer', () => {
    /**
     * @description The time of the last update shows hours and minutes only (no seconds), like
     *   the clock of the header.
     * @input  lastUpdatedAt 2026-11-25 09:05:42
     * @output '09:05' in .table-last-updated, no ':42'
     */
    it('shows the update time without seconds', () => {
      fixture.componentRef.setInput('lastUpdatedAt', new Date(2026, 10, 25, 9, 5, 42));
      fixture.detectChanges();
      const text = (fixture.nativeElement as HTMLElement).querySelector('.table-last-updated')!.textContent!;
      expect(text).toContain('09:05');
      expect(text).not.toContain(':42');
    });

    /**
     * @description The footer is one row: the freshness on the left, the page's footer template
     *   (paging) on the right; the full-width checkbox became an icon toggle with aria-pressed.
     * @input  footer template with a marker; click on the width toggle
     * @output marker inside .table-footer-pager; aria-pressed true → false, isFullWidth false
     */
    it('renders the paging template on the right and toggles the width', () => {
      @Component({ standalone: true, template: '<ng-template #pager><span class="pager-marker">P</span></ng-template>' })
      class HostPagerComponent { @ViewChild('pager', { static: true }) pager!: TemplateRef<unknown>; }
      const host = TestBed.createComponent(HostPagerComponent);
      host.detectChanges();
      fixture.componentRef.setInput('footer', host.componentInstance.pager);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.table-footer .table-footer-pager .pager-marker')).not.toBeNull();
      expect(el.querySelector('.checkbox-container')).toBeNull();
      const toggle = el.querySelector('.table-width-toggle') as HTMLButtonElement;
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      toggle.click();
      fixture.detectChanges();
      expect(component.isFullWidth).toBeFalse();
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('phone cards', () => {
    const columns = [
      { key: 'id', header: 'ID', type: 'text' },
      { key: 'thema', header: 'Topic', type: 'text', primary: true },
      { key: 'contact_email', header: 'E-mail', type: 'text' },
      { key: 'note', header: 'Note', type: 'text' },
      { key: 'status', header: 'Status', type: 'text', tones: { new: 'info' } },
      { key: 'created_at', header: 'Created', type: 'date' },
    ] as any[];
    const rows = [
      { id: 7, thema: 'Support', contact_email: 'a@b.cz', note: 'Call back', status: 'new', created_at: '2026-11-20T10:05:00Z' },
      { id: 8, thema: '', contact_email: 'c@d.cz', note: '', status: 'new', created_at: null },
    ];
    const phone = () => {
      fixture.componentRef.setInput('columns', columns);
      fixture.componentRef.setInput('data', rows);
      fixture.componentRef.setInput('mobileCards', true);
      fixture.componentRef.setInput('openOnRowClick', true);
      component.isPhone = true;
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    /**
     * @description The layout of a card: the main column is the title, the coloured column a
     *   label, the first date the date, the rest (not the ID) up to 2 values; `mobile` overrides
     *   it (false = never, 'title' = the heading).
     * @input  columns id, thema (primary), contact_email, note, status (tones), created_at; then
     *   note mobile 'title' and contact_email mobile false
     * @output title thema, badges [status], date created_at, meta [contact_email, note]; then
     *   title note, meta [thema]
     */
    it('picks the title, labels, date and values of a card', () => {
      fixture.componentRef.setInput('columns', columns);
      fixture.detectChanges();
      const layout = component.cardLayout;
      expect([layout.title?.key, layout.badges.map(c => c.key), layout.date?.key, layout.meta.map(c => c.key)])
        .toEqual(['thema', ['status'], 'created_at', ['contact_email', 'note']]);
      fixture.componentRef.setInput('columns', columns.map(c => c.key === 'note' ? { ...c, mobile: 'title' } : c.key === 'contact_email' ? { ...c, mobile: false } : c));
      fixture.detectChanges();
      expect([component.cardLayout.title?.key, component.cardLayout.meta.map(c => c.key)]).toEqual(['note', ['thema']]);
    });

    /**
     * @description On a phone with `mobileCards` the rows are cards instead of the table: title,
     *   date, label and values - the e-mail without its header, other values with it; an empty
     *   title falls back to the ID. Without a phone or without `mobileCards` the table stays.
     * @input  2 rows on a phone; then isPhone false
     * @output 2 cards, no table; card 1 'Support', label 'info', 'a@b.cz' unlabelled, 'Note:'
     *   labelled; card 2 title '#8'; then the table again
     */
    it('shows the rows as compact cards on a phone', () => {
      const el = phone();
      expect(el.querySelector('table')).toBeNull();
      const cards = Array.from(el.querySelectorAll('.table-card')) as HTMLElement[];
      expect(cards.length).toBe(2);
      expect(cards[0].querySelector('.table-card-title')!.textContent!.trim()).toBe('Support');
      expect(cards[0].querySelector('.table-card-date')!.textContent!.trim()).not.toBe('');
      expect((cards[0].querySelector('.table-badge') as HTMLElement).dataset['tone']).toBe('info');
      const metas = Array.from(cards[0].querySelectorAll('.table-card-meta')).map(m => m.textContent!.replace(/\s+/g, ' ').trim());
      expect(metas).toEqual(['a@b.cz', 'Note: Call back']);
      expect(cards[1].querySelector('.table-card-title')!.textContent!.trim()).toBe('#8');

      component.isPhone = false;
      (component as any).cd.markForCheck();
      fixture.detectChanges();
      expect(el.querySelector('table')).not.toBeNull();
      expect(el.querySelector('.table-card')).toBeNull();
    });

    /**
     * @description A tap (or Enter) opens the record; in the selection mode a tap selects and
     *   unselects instead, "Hotovo" leaves the mode and clears the selection.
     * @input  click card 1; Enter on card 2; Vybrat; click card 1 twice + card 2; Hotovo
     * @output rowOpened 7 and 8; selection [7] → [] → [8]; aria-checked; the bulk actions in the
     *   one row of the cards (no big bulk bar); after Hotovo no selection
     */
    it('opens a record on tap and selects in the selection mode', () => {
      const el = phone();
      const opened: any[] = [];
      component.rowOpened.subscribe((item: any) => opened.push(item.id));
      const cards = () => Array.from(el.querySelectorAll('.table-card')) as HTMLElement[];
      cards()[0].click();
      cards()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(opened).toEqual([7, 8]);

      (el.querySelector('.table-cards-select-btn') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(cards()[0].getAttribute('role')).toBe('checkbox');
      cards()[0].click();
      fixture.detectChanges();
      expect(cards()[0].getAttribute('aria-checked')).toBe('true');
      cards()[0].click();
      cards()[1].click();
      fixture.detectChanges();
      expect([...component.selectedIds]).toEqual([8]);
      expect(opened).toEqual([7, 8]);
      // One row: the count and the bulk actions are in the bar of the cards, no big bulk bar.
      expect(el.querySelector('.bulk-actions-bar')).toBeNull();
      expect(el.querySelector('.table-cards-bar .bulk-actions-dropdown')).not.toBeNull();

      (el.querySelector('.table-cards-select-btn') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(component.selectMode).toBeFalse();
      expect(component.selectedIds.size).toBe(0);
    });
  });
});
