/**
 * @file table-builder.component.spec.ts
 * @path src/app/admin/components/builders/table-builder/table-builder.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of TableBuilderComponent – the main admin data table: cell formatting,
 *   button visibility by permission, row actions, delete with confirmation, bulk selection /
 *   bulk delete, and export (columns, excluded and redacted values, CSV/JSON/TXT, audit log).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, confirm/alert spies, auth & permission stubs)
 */

import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
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
     * @description Dotted keys read nested values; booleans become Yes/No.
     * @input  getCellValue({ role: { name: 'admin' } }, 'role.name'); boolean 1 / 0
     * @output 'admin', 'Yes', 'No'
     */
    it('reads nested values and formats booleans', () => {
      expect(component.getCellValue({ role: { name: 'admin' } }, { key: 'role.name' } as any)).toBe('admin');
      expect(component.getCellValue({ a: 1 }, { key: 'a', type: 'boolean' } as any)).toBe('Yes');
      expect(component.getCellValue({ a: 0 }, { key: 'a', type: 'boolean' } as any)).toBe('No');
    });

    /**
     * @description Dates use d.M.yyyy by default; empty dates are ''.
     * @input  '2026-03-04' and null with type 'date'
     * @output '4.3.2026', ''
     */
    it('formats dates', () => {
      expect(component.getCellValue({ d: '2026-03-04' }, { key: 'd', type: 'date' } as any)).toBe('4.3.2026');
      expect(component.getCellValue({ d: null }, { key: 'd', type: 'date' } as any)).toBe('');
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
     * @description Bulk delete is available only with an active, permitted delete button and when not disabled.
     * @input  buttons [deleteButton]; granted 'x-delete' / none; bulkDeleteDisabled true
     * @output true; false without permission; false when disabled
     */
    it('canBulkDelete depends on the delete button and permission', () => {
      component.buttons = [deleteButton];
      ctx.permissions.granted = new Set(['x-delete']);
      expect(component.canBulkDelete).toBeTrue();
      ctx.permissions.granted = new Set();
      expect(component.canBulkDelete).toBeFalse();
      ctx.permissions.granted = 'all';
      component.bulkDeleteDisabled = true;
      expect(component.canBulkDelete).toBeFalse();
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
      expect((ctx.dataHandler as any).getCollection).toHaveBeenCalledWith('core/users', { no_pagination: 'true', sort_by: 'id', sort_direction: 'desc' });
      expect(downloads[0].name).toBe('users.csv');
      const csv = await downloads[0].blob.text();
      expect(csv.split('\n')[0]).toBe('ID;Name;Meta');
      expect(csv).toContain('"A""x"');
      expect(csv).toContain('••••••••');
      expect(csv).not.toContain('"t"');
    });

    /**
     * @description Exporting selected rows uses only the loaded selected rows (no API call) and adds '-vybrane'.
     * @input  selection [2]; onBulkExportClick(); JSON export
     * @output getCollection not called; file 'users-vybrane.json' with 1 row (Name 'B')
     */
    it('exports only the selected rows', async () => {
      component.selectedIds = new Set([2]);
      component.onBulkExportClick();
      await component.handleExportFormatSelected({ format: 'json', columnKeys: ['name'], rawFormat: false });
      expect((ctx.dataHandler as any).getCollection).not.toHaveBeenCalled();
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
     * @description Every export is written to the audit log.
     * @input  CSV export of 1 row
     * @output POST 'web/logs' with event_type 'export_csv', module 'core/users', user from the session
     */
    it('logs the export', async () => {
      (ctx.dataHandler as any).getCollection.and.returnValue(of([{ id: 1, name: 'A' }]));
      await component.handleExportFormatSelected({ format: 'csv', columnKeys: null, rawFormat: false });
      const [url, body] = (ctx.dataHandler as any).post.calls.mostRecent().args;
      expect(url).toBe('web/logs');
      expect(body).toEqual(jasmine.objectContaining({ event_type: 'export_csv', module: 'core/users', user_id_plain: '1', user_plain: 'admin@example.test' }));
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
        { Flag: 'true', Role: 'Admin', Day: '4.3.2026', List: '[{"password":"••••••••","a":1}]' },
        { Flag: 'false', Role: 9, Day: 'bad-date', List: '' }
      ]);
      await component.handleExportFormatSelected({ format: 'json', columnKeys: null, rawFormat: true });
      expect(JSON.parse(await downloads[1].blob.text())).toEqual([{ list: '[{"password":"x","a":1}]' }, { list: '' }]);
    });

    /**
     * @description XLSX export writes a workbook download named after the table; a failing
     *   audit log is only logged; popup close / import popup state.
     * @input XLSX export (anchor download captured); log POST failing; closeExportPopup; importData / closeImportPopup.
     * @output a download 'users.xlsx'; console.error; popup closed; import popup open → closed; hasImportableColumns true.
     */
    it('exports XLSX and handles the popups', async () => {
      component.tableCaption = 'users';
      component.detailsColumns = [{ key: 'name', displayName: 'Name', importable: true }] as any;
      const names: string[] = [];
      spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) { names.push(this.download); });
      spyOn(HTMLAnchorElement.prototype, 'dispatchEvent').and.callFake(function (this: HTMLAnchorElement) { names.push(this.download); return true; });
      spyOn(URL, 'createObjectURL').and.returnValue('blob:x');
      spyOn(console, 'error');
      (ctx.dataHandler as any).getCollection.and.returnValue(of([{ id: 1, name: 'A' }]));
      (ctx.dataHandler as any).post.and.returnValue(throwError(() => new Error('log down')));
      await component.handleExportFormatSelected({ format: 'xlsx', columnKeys: null, rawFormat: false });
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(names).toContain('users.xlsx');
      expect(console.error).toHaveBeenCalledWith('Failed to log export:', jasmine.anything());

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
});
