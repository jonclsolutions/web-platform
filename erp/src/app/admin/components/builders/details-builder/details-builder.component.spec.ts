/**
 * @file details-builder.component.spec.ts
 * @path src/app/admin/components/builders/details-builder/details-builder.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of DetailsBuilderComponent – the read-only "record detail" popup
 *   (value formatting per column type, nested paths, JSON values, files, scroll lock, closing).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (i18n stub), ScrollLockService (spy)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailsBuilderComponent } from './details-builder.component';
import { ScrollLockService } from '../../../../core/services/scroll-lock.service';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';


describe('DetailsBuilderComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<DetailsBuilderComponent>;
  let component: DetailsBuilderComponent;
  let scrollLock: jasmine.SpyObj<ScrollLockService>;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    scrollLock = jasmine.createSpyObj<ScrollLockService>('ScrollLockService', ['lock', 'unlock']);
    await TestBed.configureTestingModule({
      imports: [DetailsBuilderComponent],
      providers: [...ctx.providers, { provide: ScrollLockService, useValue: scrollLock }]
    }).compileComponents();
    fixture = TestBed.createComponent(DetailsBuilderComponent);
    component = fixture.componentInstance;
  });

  /**
   * @description Opening the popup locks page scrolling, closing it unlocks it.
   * @input  detectChanges() (ngOnInit), then destroy()
   * @output scrollLock.lock() once, then scrollLock.unlock() once
   */
  it('locks scrolling while open', () => {
    fixture.detectChanges();
    expect(scrollLock.lock).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(scrollLock.unlock).toHaveBeenCalledTimes(1);
  });

  /**
   * @description Dotted paths read nested values; missing parts give ''.
   * @input  getValueByPath({ a: { b: 5 } }, 'a.b'), ('a.x.y'), (null, 'a')
   * @output 5, '', ''
   */
  it('getValueByPath() reads nested values', () => {
    expect(component.getValueByPath({ a: { b: 5 } }, 'a.b')).toBe(5);
    expect(component.getValueByPath({ a: { b: 5 } }, 'a.x.y')).toBe('');
    expect(component.getValueByPath(null, 'a')).toBe('');
  });

  /**
   * @description Booleans are shown with the shared yes/no texts (1/true = yes).
   * @input  getFormattedValue for values true, 1, 0 with type 'boolean'
   * @output 'shared.yes', 'shared.yes', 'shared.no'
   */
  it('formats booleans with the shared yes/no texts', () => {
    const col = { key: 'active', displayName: 'Active', type: 'boolean' } as any;
    expect(component.getFormattedValue({ active: true }, 'active', col)).toBe('shared.yes');
    expect(component.getFormattedValue({ active: 1 }, 'active', col)).toBe('shared.yes');
    expect(component.getFormattedValue({ active: 0 }, 'active', col)).toBe('shared.no');
  });

  /**
   * @description Dates use dd.MM.yyyy HH:mm by default, invalid dates are returned unchanged.
   * @input  '2026-03-04T05:06:00' and 'not a date' with type 'date'
   * @output '04.03.2026 05:06', 'not a date'
   */
  it('formats dates and keeps invalid dates as they are', () => {
    const col = { key: 'd', displayName: 'D', type: 'date' } as any;
    expect(component.getFormattedValue({ d: '2026-03-04T05:06:00' }, 'd', col)).toBe('04.03.2026 05:06');
    expect(component.getFormattedValue({ d: 'not a date' }, 'd', col)).toBe('not a date');
  });

  /**
   * @description A custom date format from the column definition is used.
   * @input  '2026-03-04T05:06:00' with format 'yyyy'
   * @output '2026'
   */
  it('uses the column date format', () => {
    const col = { key: 'd', displayName: 'D', type: 'date', format: 'yyyy' } as any;
    expect(component.getFormattedValue({ d: '2026-03-04T05:06:00' }, 'd', col)).toBe('2026');
  });

  /**
   * @description Currency values are formatted as CZK without decimals (cs-CZ).
   * @input  1500 with type 'currency'
   * @output string containing '1' '500' and 'Kč'
   */
  it('formats currency in CZK', () => {
    const col = { key: 'p', displayName: 'P', type: 'currency' } as any;
    const text = component.getFormattedValue({ p: 1500 }, 'p', col) as string;
    expect(text.replace(/\s/g, ' ')).toMatch(/1\s?500\s?Kč/);
  });

  /**
   * @description Select values are shown with their option label from the form definition.
   * @input  value 2, inputDefinitions option { value: 2, label: 'Two' }
   * @output 'Two'; unknown value 9 → 9
   */
  it('shows the option label for select values', () => {
    component.inputDefinitions = [{ column_name: 's', options: [{ value: 2, label: 'Two' }] } as any];
    const col = { key: 's', displayName: 'S' } as any;
    expect(component.getFormattedValue({ s: 2 }, 's', col)).toBe('Two');
    expect(component.getFormattedValue({ s: 9 }, 's', col)).toBe(9);
  });

  /**
   * @description Empty values are returned as null (the template then shows '-').
   * @input  '', null, undefined
   * @output null for all three
   */
  it('returns null for empty values', () => {
    const col = { key: 'x', displayName: 'X' } as any;
    expect(component.getFormattedValue({ x: '' }, 'x', col)).toBeNull();
    expect(component.getFormattedValue({ x: null }, 'x', col)).toBeNull();
    expect(component.getFormattedValue({}, 'x', col)).toBeNull();
  });

  /**
   * @description JSON strings are parsed for display; invalid JSON stays a string.
   * @input  getJsonValue('{"a":1}'), ('[1,2]'), ('{broken'), ('text')
   * @output { a: 1 }, [1, 2], '{broken', 'text'
   */
  it('getJsonValue() parses JSON strings safely', () => {
    expect(component.getJsonValue('{"a":1}')).toEqual({ a: 1 });
    expect(component.getJsonValue('[1,2]')).toEqual([1, 2]);
    expect(component.getJsonValue('{broken')).toBe('{broken');
    expect(component.getJsonValue('text')).toBe('text');
  });

  /**
   * @description Objects, arrays and JSON-like strings are treated as objects; dates are not.
   * @input  isObject({}), ([]), ('{"a":1}'), (new Date()), ('abc'), (null)
   * @output true, true, true, false, false, false
   */
  it('isObject() recognises objects and JSON strings', () => {
    expect(component.isObject({})).toBeTrue();
    expect(component.isObject([])).toBeTrue();
    expect(component.isObject('{"a":1}')).toBeTrue();
    expect(component.isObject(new Date())).toBeFalse();
    expect(component.isObject('abc')).toBeFalse();
    expect(component.isObject(null)).toBeFalse();
  });

  /**
   * @description File sizes are shown in KB below 1 MB, otherwise in MB with one decimal.
   * @input  formatFileSize(2048), (1572864), (0), (undefined)
   * @output '2 KB', '1.5 MB', '0 KB', ''
   */
  it('formatFileSize() uses KB and MB', () => {
    expect(component.formatFileSize(2048)).toBe('2 KB');
    expect(component.formatFileSize(1572864)).toBe('1.5 MB');
    expect(component.formatFileSize(0)).toBe('0 KB');
    expect(component.formatFileSize(undefined as any)).toBe('');
  });

  /**
   * @description Clicking the overlay closes the popup, clicking inside it does not.
   * @input  onOverlayClick with target === currentTarget, then target !== currentTarget
   * @output closeDetails emitted once
   */
  it('closes on an overlay click only', () => {
    let closed = 0;
    component.closeDetails.subscribe(() => closed++);
    const overlay = {};
    component.onOverlayClick({ target: overlay, currentTarget: overlay } as any);
    component.onOverlayClick({ target: {}, currentTarget: overlay } as any);
    expect(closed).toBe(1);
  });

  /**
   * @description Each detail column is rendered with its label and formatted value.
   * @input  itemData { name: 'Alice', active: 1, empty: '' }; columns name, active (boolean), empty
   * @output 3 rows; values 'Alice', 'shared.yes', '-'
   */
  it('renders a row per column', () => {
    component.itemData = { name: 'Alice', active: 1, empty: '' };
    component.itemDetailColumns = [
      { key: 'name', displayName: 'Name' },
      { key: 'active', displayName: 'Active', type: 'boolean' },
      { key: 'empty', displayName: 'Empty' }
    ] as any;
    fixture.detectChanges();
    const values = Array.from(fixture.nativeElement.querySelectorAll('.value-cell')).map((e: any) => e.textContent.trim());
    expect(values).toEqual(['Alice', 'shared.yes', '-']);
  });

  /**
   * @description A 'files' column lists every file with name and size; an empty list shows "no files".
   * @input  files [{ id: 1, original_filename: 'cv.pdf', size_bytes: 2048 }], then []
   * @output one row 'cv.pdf' / '2 KB'; then text 'details-builder.no_files'
   */
  it('lists attached files', () => {
    component.itemData = { files: [{ id: 1, original_filename: 'cv.pdf', size_bytes: 2048, view_url: 'v', download_url: 'd' }] };
    component.itemDetailColumns = [{ key: 'files', displayName: 'Files', type: 'files' }] as any;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.details-file-name').textContent.trim()).toBe('cv.pdf');
    expect(fixture.nativeElement.querySelector('.details-file-size').textContent.trim()).toBe('2 KB');
    component.itemData = { files: [] };
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.value-cell').textContent.trim()).toBe('details-builder.no_files');
  });

  /**
   * @description getViewUrl never returns undefined.
   * @input  getViewUrl(''), ('https://x')
   * @output '', 'https://x'
   */
  it('getViewUrl() falls back to an empty string', () => {
    expect(component.getViewUrl('')).toBe('');
    expect(component.getViewUrl('https://x')).toBe('https://x');
  });
});
