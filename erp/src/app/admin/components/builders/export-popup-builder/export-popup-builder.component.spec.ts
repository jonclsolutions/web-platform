/**
 * @file export-popup-builder.component.spec.ts
 * @path src/app/admin/components/builders/export-popup-builder/export-popup-builder.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ExportPopupBuilderComponent – choosing the export format and the
 *   columns, the "raw (import-compatible) format" switch and what is sent to the table.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (i18n stub), ScrollLockService (spy)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';

import { ExportPopupBuilderComponent, ExportSelection } from './export-popup-builder.component';
import { ScrollLockService } from '../../../../core/services/scroll-lock.service';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('ExportPopupBuilderComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ExportPopupBuilderComponent>;
  let component: ExportPopupBuilderComponent;
  let scrollLock: jasmine.SpyObj<ScrollLockService>;

  const columns = [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'email', label: 'E-mail' }];
  const importable = [{ key: 'name', label: 'Name' }];

  const setColumns = (cols = columns, imp = importable) => {
    component.columns = cols;
    component.importableColumns = imp;
    component.ngOnChanges({ columns: new SimpleChange([], cols, true), importableColumns: new SimpleChange([], imp, true) });
  };

  beforeEach(async () => {
    ctx = createAdminTestContext();
    scrollLock = jasmine.createSpyObj<ScrollLockService>('ScrollLockService', ['lock', 'unlock']);
    await TestBed.configureTestingModule({
      imports: [ExportPopupBuilderComponent],
      providers: [...ctx.providers, { provide: ScrollLockService, useValue: scrollLock }]
    }).compileComponents();
    fixture = TestBed.createComponent(ExportPopupBuilderComponent);
    component = fixture.componentInstance;
  });

  /**
   * @description All columns are selected when the columns arrive.
   * @input  columns id, name, email
   * @output selectedColumnKeys = {id, name, email}; isAllColumnsSelected true
   */
  it('selects every column by default', () => {
    setColumns();
    expect([...component.selectedColumnKeys]).toEqual(['id', 'name', 'email']);
    expect(component.isAllColumnsSelected).toBeTrue();
  });

  /**
   * @description Selecting a format emits the format, the chosen columns and rawFormat false.
   * @input  uncheck 'email'; onSelect('csv')
   * @output formatSelected { format: 'csv', columnKeys: ['id', 'name'], rawFormat: false }
   */
  it('emits the format with the selected columns', () => {
    setColumns();
    component.toggleColumn('email', { target: { checked: false } } as any);
    let sel: ExportSelection | undefined;
    component.formatSelected.subscribe(s => (sel = s));
    component.onSelect('csv');
    expect(sel).toEqual({ format: 'csv', columnKeys: ['id', 'name'], rawFormat: false });
  });

  /**
   * @description Without column definitions the whole row is exported (columnKeys null).
   * @input  no columns; onSelect('json')
   * @output formatSelected { format: 'json', columnKeys: null, rawFormat: false }
   */
  it('sends columnKeys null when the page has no column list', () => {
    setColumns([], []);
    let sel: ExportSelection | undefined;
    component.formatSelected.subscribe(s => (sel = s));
    component.onSelect('json');
    expect(sel).toEqual({ format: 'json', columnKeys: null, rawFormat: false });
  });

  /**
   * @description With no column selected the formats are disabled and nothing is emitted.
   * @input  toggleSelectAllColumns() (all → none); onSelect('csv')
   * @output formatGridDisabled true; formatSelected not emitted
   */
  it('blocks the export when no column is selected', () => {
    setColumns();
    component.toggleSelectAllColumns();
    expect(component.selectedColumnKeys.size).toBe(0);
    expect(component.formatGridDisabled).toBeTrue();
    let emitted = 0;
    component.formatSelected.subscribe(() => emitted++);
    component.onSelect('csv');
    expect(emitted).toBe(0);
  });

  /**
   * @description "Select all" selects everything again after a partial selection.
   * @input  uncheck 'id'; toggleSelectAllColumns()
   * @output all 3 columns selected
   */
  it('select-all re-selects every column', () => {
    setColumns();
    component.toggleColumn('id', { target: { checked: false } } as any);
    component.toggleSelectAllColumns();
    expect(component.selectedColumnKeys.size).toBe(3);
  });

  /**
   * @description Raw format switches to the importable columns and hides Excel.
   * @input  toggleRawFormat()
   * @output activeColumnSource = importable; selection {name}; visible formats without 'xlsx'; emitted rawFormat true
   */
  it('raw format uses importable columns and no xlsx', () => {
    setColumns();
    component.toggleRawFormat();
    expect(component.activeColumnSource).toEqual(importable);
    expect([...component.selectedColumnKeys]).toEqual(['name']);
    expect(component.visibleFormatOptions.map(o => o.value)).not.toContain('xlsx');
    let sel: ExportSelection | undefined;
    component.formatSelected.subscribe(s => (sel = s));
    component.onSelect('csv');
    expect(sel!.rawFormat).toBeTrue();
  });

  /**
   * @description Raw format without importable columns cannot be exported.
   * @input  importableColumns []; toggleRawFormat()
   * @output formatGridDisabled true
   */
  it('disables raw export when nothing is importable', () => {
    setColumns(columns, []);
    component.toggleRawFormat();
    expect(component.formatGridDisabled).toBeTrue();
  });

  /**
   * @description While exporting, formats are disabled and the popup cannot be closed.
   * @input  isExporting true; onClose()
   * @output formatGridDisabled true; closed not emitted
   */
  it('cannot be closed while exporting', () => {
    setColumns();
    component.isExporting = true;
    let closed = 0;
    component.closed.subscribe(() => closed++);
    component.onClose();
    expect(component.formatGridDisabled).toBeTrue();
    expect(closed).toBe(0);
  });

  /**
   * @description Only the formats allowed by the page are offered.
   * @input  formats ['csv', 'json']
   * @output visible format values ['csv', 'json']
   */
  it('offers only the allowed formats', () => {
    component.formats = ['csv', 'json'];
    expect(component.visibleFormatOptions.map(o => o.value)).toEqual(['csv', 'json']);
  });

  /**
   * @description The subtitle shows the row count when known.
   * @input  strings subtitle_with_count 'Rows: {count}'; itemCount 12, then 0
   * @output 'Rows: 12', then subtitle_no_count text
   */
  it('subtitle shows the number of rows', () => {
    ctx.i18n.getMergedSection.and.returnValue({ subtitle_with_count: 'Rows: {count}', subtitle_no_count: 'All rows' });
    component.itemCount = 12;
    expect(component.subtitleText).toBe('Rows: 12');
    component.itemCount = 0;
    expect(component.subtitleText).toBe('All rows');
  });

  /**
   * @description Overlay click closes; the popup locks scrolling while open.
   * @input  detectChanges(); overlay click; destroy()
   * @output closed emitted; lock and unlock called once
   */
  it('closes on overlay click and manages the scroll lock', () => {
    setColumns();
    fixture.detectChanges();
    let closed = 0;
    component.closed.subscribe(() => closed++);
    const overlay = {};
    component.onOverlayClick({ target: overlay, currentTarget: overlay } as any);
    fixture.destroy();
    expect(closed).toBe(1);
    expect(scrollLock.lock).toHaveBeenCalledTimes(1);
    expect(scrollLock.unlock).toHaveBeenCalledTimes(1);
  });
});
