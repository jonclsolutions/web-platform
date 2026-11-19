/**
 * @file row-button-builder.component.spec.ts
 * @path src/app/admin/components/builders/row-button-builder/row-button-builder.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of RowButtonBuilderComponent (shared row of buttons) and of the
 *   helpers languageRowButtons and RowButtonItems: rendering, accessibility per kind, selection, links.
 * @dependencies provideRouter([]) for the links of kind nav.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RowButtonBuilderComponent } from './row-button-builder.component';
import { RowButton, RowButtonItems, languageRowButtons } from './row-button';

describe('RowButtonBuilderComponent', () => {
  let fixture: ComponentFixture<RowButtonBuilderComponent>;
  let component: RowButtonBuilderComponent;

  const items: RowButton[] = [
    { value: 'a', label: 'Alpha', icon: 'folder' },
    { value: 'b', label: 'Beta', count: 0 },
    { value: 'c', label: 'Gamma', count: 3, countTone: 'attention', dot: true, title: 'Tip' },
    { value: 'd', label: 'Hidden', hidden: true },
    { value: 'e', label: 'Off', disabled: true },
  ];

  const set = (inputs: Record<string, unknown>) => {
    Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    fixture.detectChanges();
  };
  const buttons = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('.rbb-btn'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RowButtonBuilderComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(RowButtonBuilderComponent);
    component = fixture.componentInstance;
  });

  /**
   * @description Visible buttons with icon, count, attention tone, dot and tooltip; hidden ones left out.
   * @input items a–e, active 'a'.
   * @output 4 buttons; a active with svg; b count 0; c amber count 3, dot, title; e disabled.
   */
  it('renders the visible buttons with their parts', () => {
    set({ items, active: 'a' });
    const [a, b, c, e] = buttons();
    expect(buttons().map(btn => btn.querySelector('.rbb-label')?.textContent)).toEqual(['Alpha', 'Beta', 'Gamma', 'Off']);
    expect(a.classList).toContain('active');
    expect(a.querySelector('svg')).not.toBeNull();
    expect(b.querySelector('.rbb-count')?.textContent).toBe('0');
    expect(c.querySelector('.rbb-count--attention')?.textContent).toBe('3');
    expect(c.querySelector('.rbb-dot')).not.toBeNull();
    expect(c.getAttribute('title')).toBe('Tip');
    expect((e as HTMLButtonElement).disabled).toBeTrue();
  });

  /**
   * @description filter = group + aria-pressed; tabs = tablist + tab + aria-selected; label and sizes.
   * @input kind filter, then tabs with size sm, stretch and ariaLabel.
   * @output roles and aria attributes per kind; classes rbb--sm, rbb--stretch.
   */
  it('sets the accessibility attributes per kind', () => {
    set({ items, active: 'b' });
    const row: HTMLElement = fixture.nativeElement.querySelector('.rbb');
    expect(row.getAttribute('role')).toBe('group');
    expect(buttons()[1].getAttribute('aria-pressed')).toBe('true');
    expect(buttons()[0].getAttribute('aria-selected')).toBeNull();

    set({ kind: 'tabs', size: 'sm', stretch: true, ariaLabel: 'Tabs' });
    const tabs: HTMLElement = fixture.nativeElement.querySelector('.rbb');
    expect(tabs.getAttribute('role')).toBe('tablist');
    expect(tabs.getAttribute('aria-label')).toBe('Tabs');
    expect(tabs.classList).toContain('rbb--sm');
    expect(tabs.classList).toContain('rbb--stretch');
    expect(buttons()[1].getAttribute('role')).toBe('tab');
    expect(buttons()[1].getAttribute('aria-selected')).toBe('true');
    expect(buttons()[1].getAttribute('aria-pressed')).toBeNull();
  });

  /**
   * @description A click emits the value; the active and a disabled button emit nothing.
   * @input clicks on b, a (active), select(e) (disabled).
   * @output only 'b' emitted.
   */
  it('emits the value of the clicked button', () => {
    set({ items, active: 'a' });
    const emitted: string[] = [];
    component.selected.subscribe(value => emitted.push(value));
    buttons()[1].click();
    buttons()[0].click();
    component.select(items[4]);
    expect(emitted).toEqual(['b']);
  });

  /**
   * @description kind nav renders links with routerLink and aria-current on the active one.
   * @input two items with links, active 'y'.
   * @output 2 anchors, hrefs /x and /p/y, aria-current only on y.
   */
  it('renders links for kind nav', () => {
    set({ kind: 'nav', active: 'y', items: [{ value: 'x', label: 'X', link: '/x' }, { value: 'y', label: 'Y', link: ['/p', 'y'] }] });
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('nav a.rbb-btn'));
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/x', '/p/y']);
    expect(links.map(link => link.getAttribute('aria-current'))).toEqual([null, 'page']);
  });

  /**
   * @description languageRowButtons: code / name label, flag, count (0 = none), dot, title.
   * @input cz (flag, 2 missing, dot) and en (no flag, 0 missing); then showName.
   * @output CZ with flag, count 2, dot, title; EN without; names with showName.
   */
  it('builds the language buttons', () => {
    const langs = [{ code: 'cz', iconUrl: '/cz.svg', name: 'Čeština' }, { code: 'en', iconUrl: null, name: 'English' }];
    const result = languageRowButtons(langs, { count: code => (code === 'cz' ? 2 : 0), dot: code => code === 'cz', title: code => (code === 'cz' ? 'Missing' : '') });
    expect(result[0]).toEqual(jasmine.objectContaining({ value: 'cz', label: 'CZ', imageUrl: '/cz.svg', count: 2, dot: true, title: 'Missing' }));
    expect(result[1]).toEqual(jasmine.objectContaining({ value: 'en', label: 'EN', imageUrl: undefined, count: null, dot: false, title: undefined }));
    expect(languageRowButtons(langs, { showName: true }).map(b => b.label)).toEqual(['Čeština', 'English']);
  });

  /**
   * @description RowButtonItems keeps the same array while the buttons are equal.
   * @input the same buttons twice (new objects, equal link), then a changed count.
   * @output same reference, then a new one.
   */
  it('keeps a stable list of equal buttons', () => {
    const list = new RowButtonItems();
    const first = list.update([{ value: 'a', label: 'A', link: ['/x', 1] }]);
    expect(list.update([{ value: 'a', label: 'A', link: ['/x', 1] }])).toBe(first);
    expect(list.update([{ value: 'a', label: 'A', link: ['/x', 1], count: 1 }])).not.toBe(first);
  });
});
