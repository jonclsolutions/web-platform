/**
 * @file row-button-builder.component.spec.ts
 * @path src/app/admin/components/builders/row-button-builder/row-button-builder.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of RowButtonBuilderComponent (shared row of buttons) and of the
 *   helpers languageRowButtons and RowButtonItems: rendering, accessibility per kind, selection, links,
 *   the drop-down of the tabs (`phoneSelect`: phone, a row that does not fit).
 * @dependencies provideRouter([]) for the links of kind nav.
 */

import { ComponentFixture, TestBed, fakeAsync, flush } from '@angular/core/testing';
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
   * @description Tabs with `phoneSelect`: a drop-down next to the row (CSS shows one of them) -
   *   the trigger shows the active tab and "+n" when other tabs wait; the list opens with the
   *   focus on the active tab, the arrows move, a pick emits and closes with the focus back on the
   *   trigger (a tap leaves no focus on it), Escape and a press outside close it; without another
   *   waiting tab no '+n'.
   * @input kind tabs, items a–e, active 'a', phoneSelect, othersHint 'Waits'; click the trigger;
   *   ArrowDown; click Gamma; open, tap Beta; open, Escape; open, pointerdown on the body; active 'c' without dots
   * @output .rbb--has-select; trigger 'Alpha' + '+1' with 'Waits'; 4 options, focus Alpha →
   *   Beta; emitted ['c'], closed, focus on the trigger; tap → ['c', 'b'], focus elsewhere; closed by Escape and by the outside press;
   *   no '+n'
   */
  it('turns the tabs into a drop-down on a phone', fakeAsync(() => {
    document.body.appendChild(fixture.nativeElement);
    set({ kind: 'tabs', items, active: 'a', phoneSelect: true, othersHint: 'Waits', ariaLabel: 'Parts' });
    const el: HTMLElement = fixture.nativeElement;
    // The test window is wider than a phone - show the drop-down so its buttons can take the focus.
    (el.querySelector('.rbb-select') as HTMLElement).style.display = 'block';
    const trigger = el.querySelector('.rbb-select-trigger') as HTMLButtonElement;
    const options = () => Array.from(el.querySelectorAll('.rbb-select-option')) as HTMLButtonElement[];
    const emitted: string[] = [];
    component.selected.subscribe(value => emitted.push(value));

    expect(el.querySelector('.rbb')!.classList).toContain('rbb--has-select');
    expect(trigger.querySelector('.rbb-label')!.textContent).toBe('Alpha');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    // Beta (count 0) does not wait; Gamma (count 3, dot) does - "+1".
    expect(trigger.querySelector('.rbb-select-others')!.textContent).toContain('+1');
    expect(trigger.querySelector('.rbb-select-others')!.textContent).toContain('Waits');

    trigger.click();
    fixture.detectChanges();
    flush();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(options().map(o => o.querySelector('.rbb-label')!.textContent)).toEqual(['Alpha', 'Beta', 'Gamma', 'Off']);
    expect(options()[0].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(options()[0]);
    options()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(options()[1]);

    // A keyboard pick (click with detail 0) brings the focus back to the trigger.
    options()[2].click();
    fixture.detectChanges();
    expect(emitted).toEqual(['c']);
    expect(component.menuOpen).toBeFalse();
    expect(document.activeElement).toBe(trigger);

    // A tap (detail 1) closes the list without a focus ring on the trigger.
    trigger.click();
    fixture.detectChanges();
    flush();
    options()[1].dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    fixture.detectChanges();
    expect(emitted).toEqual(['c', 'b']);
    expect(component.menuOpen).toBeFalse();
    expect(document.activeElement).not.toBe(trigger);

    trigger.click();
    fixture.detectChanges();
    flush();
    options()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(component.menuOpen).toBeFalse();

    trigger.click();
    fixture.detectChanges();
    flush();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(component.menuOpen).toBeFalse();

    set({ items: [{ value: 'a', label: 'Alpha' }, { value: 'c', label: 'Gamma', count: 3, dot: true }], active: 'c' });
    expect(el.querySelector('.rbb-select-others')).toBeNull();
    el.remove();
  }));

  /**
   * @description Tabs with `phoneSelect` wider than a phone: the drop-down replaces the row only
   *   while the row does not fit its place - the row stays measured (hidden, natural width) and
   *   comes back once the place is wide enough; without `phoneSelect` never.
   * @input kind tabs, items a–e, phoneSelect; the place 120 px → measure(); 2000 px → measure();
   *   phoneSelect false at 120 px → measure()
   * @output collapsed true, .rbb-select--on, .rbb--measure, the host not wider than 120 px;
   *   collapsed false, no classes;
   *   collapsed false
   */
  it('replaces a row of tabs that does not fit with the drop-down', () => {
    document.body.appendChild(fixture.nativeElement);
    set({ kind: 'tabs', items, active: 'a', phoneSelect: true });
    const el: HTMLElement = fixture.nativeElement;

    el.style.width = '120px';
    component.measure();
    fixture.detectChanges();
    expect(component.collapsed).toBeTrue();
    expect(el.querySelector('.rbb-select')!.classList).toContain('rbb-select--on');
    expect(el.querySelector('.rbb')!.classList).toContain('rbb--measure');
    // The measured row (wider than its place) does not widen the page - nothing to scroll sideways.
    expect(el.querySelector('.rbb')!.scrollWidth).toBeGreaterThan(120);
    expect(el.scrollWidth).toBeLessThanOrEqual(120);

    el.style.width = '2000px';
    component.measure();
    fixture.detectChanges();
    expect(component.collapsed).toBeFalse();
    expect(el.querySelector('.rbb-select')!.classList).not.toContain('rbb-select--on');
    expect(el.querySelector('.rbb')!.classList).not.toContain('rbb--measure');

    set({ phoneSelect: false });
    el.style.width = '120px';
    component.measure();
    expect(component.collapsed).toBeFalse();
    el.remove();
  });

  /**
   * @description Regression (Full HD showed the drop-down): inside a flex row the tabs take the
   *   whole given width, so a shown drop-down never shrinks the measured place - the row comes
   *   back on a wide screen.
   * @input a flex row 1500 px wide with the builder (phoneSelect, items a–e); collapsed set on;
   *   measure()
   * @output host .rbb-host--select as wide as the row; collapsed false
   */
  it('gives the row back on a wide screen even after the drop-down was shown', () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;width:1500px';
    wrap.appendChild(fixture.nativeElement);
    document.body.appendChild(wrap);
    set({ kind: 'tabs', items, active: 'a', phoneSelect: true });
    component.collapsed = true;
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.classList).toContain('rbb-host--select');
    expect(el.getBoundingClientRect().width).toBe(1500);
    component.measure();
    expect(component.collapsed).toBeFalse();
    wrap.remove();
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
