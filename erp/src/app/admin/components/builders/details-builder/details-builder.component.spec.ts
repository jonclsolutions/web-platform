/**
 * @file details-builder.component.spec.ts
 * @path src/app/admin/components/builders/details-builder/details-builder.component.spec.ts
 * @project JS web-platform
 * @author JS
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
   * @description Opening the popup (its frame) locks page scrolling, closing it unlocks it.
   * @input  detectChanges() (render), then destroy()
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
   * @description Dates use the ONE admin format with time by default (admin-date-format.ts),
   *   invalid dates are returned unchanged.
   * @input  '2026-03-04T05:06:00' and 'not a date' with type 'date'
   * @output '4. 3. 2026 05:06', 'not a date'
   */
  it('formats dates and keeps invalid dates as they are', () => {
    const col = { key: 'd', displayName: 'D', type: 'date' } as any;
    expect(component.getFormattedValue({ d: '2026-03-04T05:06:00' }, 'd', col)).toBe('4. 3. 2026 05:06');
    expect(component.getFormattedValue({ d: 'not a date' }, 'd', col)).toBe('not a date');
  });

  /**
   * @description The format of a column says only the kind of the date (admin-date-format.ts):
   *   a pattern without time = the day, 'short' = with time, 'medium' = with seconds; the
   *   pattern itself is the ONE admin format of the admin language.
   * @input  '2026-03-04T05:06:07' with formats 'yyyy', 'short', 'medium'; English patterns + en-US.
   * @output '4. 3. 2026', '4. 3. 2026 05:06', '4. 3. 2026 05:06:07'; '4 Mar 2026 05:06'.
   */
  it('shows the kind of date of the column in the admin format', () => {
    const at = (format: string) => component.getFormattedValue({ d: '2026-03-04T05:06:07' }, 'd', { key: 'd', displayName: 'D', type: 'date', format } as any);
    expect(at('yyyy')).toBe('4. 3. 2026');
    expect(at('short')).toBe('4. 3. 2026 05:06');
    expect(at('medium')).toBe('4. 3. 2026 05:06:07');
    ctx.i18n.getValue.and.callFake((p: string) => ({ 'shared.datetime_format': 'd MMM yyyy HH:mm' } as any)[p] ?? p);
    ctx.i18n.getDateLocale.and.returnValue('en-US');
    expect(at('short')).toBe('4 Mar 2026 05:06');
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
   * @description The detail sits in the shared popup frame: the backdrop, the close button and
   *   the footer button close it, a click inside it does not.
   * @input  render; backdrop press + click; click into the card; close button; footer button
   * @output closeDetails emitted 3 times; size lg; title 'details-builder.title'
   */
  it('closes from the frame and its footer', () => {
    let closed = 0;
    component.closeDetails.subscribe(() => closed++);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const overlay = el.querySelector('.am-overlay') as HTMLElement;
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    overlay.click();
    (el.querySelector('.am-card') as HTMLElement).click();
    (el.querySelector('.am-close') as HTMLElement).click();
    (el.querySelector('.am-footer .am-btn') as HTMLElement).click();
    expect(closed).toBe(3);
    expect((el.querySelector('.am-card') as HTMLElement).dataset['size']).toBe('lg');
    expect(el.querySelector('.am-title')!.textContent!.trim()).toBe('details-builder.title');
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
   * @description An avatar column shows the photo (72 px), the default image without one.
   * @input  avatar_url '/p.webp', then null.
   * @output img src '/p.webp'; default svg.
   */
  it('renders the profile photo', () => {
    component.itemData = { avatar_url: '/p.webp' };
    component.itemDetailColumns = [{ key: 'avatar_url', displayName: 'Photo', type: 'avatar' }] as any;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.value-cell img').getAttribute('src')).toBe('/p.webp');
    component.itemData = { avatar_url: null };
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.value-cell svg.user-avatar--default')).not.toBeNull();
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
   * @description The "view" link is offered only for previewable files (the API sends view_url
   *   null for download-only types such as ZIP or DOCX); the download button is always there.
   * @input  files [{ cv.pdf, view_url 'v' }, { data.zip, view_url null }]
   * @output first row: view link href 'v' with rel noopener + download button; second row: no view link, download button
   */
  it('shows the view link only when the API sends a view_url', () => {
    component.itemData = { files: [
      { id: 1, original_filename: 'cv.pdf', size_bytes: 1, view_url: 'v', download_url: 'd1' },
      { id: 2, original_filename: 'data.zip', size_bytes: 1, view_url: null, download_url: 'd2' }
    ] };
    component.itemDetailColumns = [{ key: 'files', displayName: 'Files', type: 'files' }] as any;
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('.details-file-row');
    const view = rows[0].querySelector('a.btn-action.view');
    expect(view.getAttribute('href')).toBe('v');
    expect(view.getAttribute('rel')).toBe('noopener');
    expect(rows[0].querySelector('button.btn-action.download')).not.toBeNull();
    expect(rows[1].querySelector('a.btn-action.view')).toBeNull();
    expect(rows[1].querySelector('button.btn-action.download')).not.toBeNull();
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

  /**
   * @description Embedded (inside the record popup): only the values, no popup frame of its own;
   *   compact adds the small block style.
   * @input embedded true (then compact true) with itemData and one column.
   * @output no app-admin-modal, .details-embedded with the value; compact class only when set.
   */
  it('renders only the values when embedded', () => {
    fixture.componentRef.setInput('embedded', true);
    fixture.componentRef.setInput('itemData', { id: 7 });
    fixture.componentRef.setInput('itemDetailColumns', [{ key: 'id', displayName: 'ID', type: 'text' }]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-admin-modal')).toBeNull();
    expect(el.querySelector('.details-embedded .value-cell')!.textContent).toContain('7');
    expect(el.querySelector('.details-embedded--compact')).toBeNull();
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();
    expect(el.querySelector('.details-embedded--compact')).not.toBeNull();
  });
});
