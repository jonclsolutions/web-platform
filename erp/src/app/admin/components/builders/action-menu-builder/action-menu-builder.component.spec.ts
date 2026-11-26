/**
 * @file action-menu-builder.component.spec.ts
 * @path src/app/admin/components/builders/action-menu-builder/action-menu-builder.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ActionMenuBuilderComponent – the "⋯ Actions" dropdown of the admin
 *   toolbars (open/close, outside click, action emit, position inside the viewport, the attention
 *   dot of an item and of the trigger).
 * @dependencies
 * - AdminLocalizationService (stub: the label of the main button)
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActionMenuBuilderComponent } from './action-menu-builder.component';
import { AdminLocalizationService } from '../../../../core/services/admin-localization.service';
import { createI18nStub } from '../../../../../testing/admin-test-helpers';

describe('ActionMenuBuilderComponent', () => {
  let fixture: ComponentFixture<ActionMenuBuilderComponent>;
  let component: ActionMenuBuilderComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionMenuBuilderComponent],
      providers: [{ provide: AdminLocalizationService, useValue: createI18nStub() }]
    }).compileComponents();
    fixture = TestBed.createComponent(ActionMenuBuilderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('configs', [
      { action: 'export', label: 'Export' },
      { action: 'hidden', label: 'Hidden', showIf: false },
      { action: 'import', label: 'Import', icon: '⬆' }
    ]);
    fixture.detectChanges();
  });

  const items = () => Array.from(fixture.nativeElement.querySelectorAll('.action-menu-item')) as HTMLButtonElement[];

  /**
   * @description The menu is closed by default and shows the default trigger label.
   * @input  new component
   * @output isOpen false; no menu items; trigger label 'Akce', aria-expanded 'false'
   */
  it('starts closed with the default trigger', () => {
    expect(component.isOpen).toBeFalse();
    expect(items().length).toBe(0);
    const trigger = fixture.nativeElement.querySelector('.action-menu-trigger');
    expect(trigger.querySelector('.btn-label').textContent.trim()).toBe('Akce');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  /**
   * @description Opening the menu lists the visible actions and positions it after render.
   * @input  click trigger; next tick
   * @output isOpen true; items 'Export', 'Import' (showIf false hidden); menuPosition set
   */
  it('opens, lists visible actions and positions the menu', fakeAsync(() => {
    fixture.nativeElement.querySelector('.action-menu-trigger').click();
    fixture.detectChanges();
    expect(component.isOpen).toBeTrue();
    expect(items().map(b => b.querySelector('.btn-label')!.textContent!.trim())).toEqual(['Export', 'Import']);
    tick();
    expect(component.menuPosition).not.toBeNull();
  }));

  /**
   * @description The menu never leaves the viewport (8 px margin).
   * @input  open menu; tick
   * @output 8 <= left <= innerWidth - menu width - 8
   */
  it('keeps the menu inside the viewport', fakeAsync(() => {
    // OnPush: open through the DOM click so the view is marked for check
    fixture.nativeElement.querySelector('.action-menu-trigger').click();
    fixture.detectChanges();
    tick();
    const menu: HTMLElement = fixture.nativeElement.querySelector('.action-menu-list');
    const width = menu.getBoundingClientRect().width;
    expect(component.menuPosition!.left).toBeGreaterThanOrEqual(8);
    expect(component.menuPosition!.left).toBeLessThanOrEqual(window.innerWidth - width - 8);
  }));

  /**
   * @description Selecting an item closes the menu and emits the action.
   * @input  open menu; click 'Import'
   * @output actionTriggered emits 'import'; isOpen false
   */
  it('emits the selected action and closes', fakeAsync(() => {
    const actions: string[] = [];
    component.actionTriggered.subscribe(a => actions.push(a));
    fixture.nativeElement.querySelector('.action-menu-trigger').click();
    fixture.detectChanges();
    tick();
    items()[1].click();
    expect(actions).toEqual(['import']);
    expect(component.isOpen).toBeFalse();
    expect(component.menuPosition).toBeNull();
  }));

  /**
   * @description A click outside the component closes an open menu; a click inside does not.
   * @input  open menu; document click on the host, then on document.body
   * @output still open after the inside click, closed after the outside click
   */
  it('closes on an outside click only', fakeAsync(() => {
    component.toggleMenu();
    tick();
    component.onDocumentClick({ target: fixture.nativeElement.querySelector('.action-menu-trigger') } as any);
    expect(component.isOpen).toBeTrue();
    component.onDocumentClick({ target: document.body } as any);
    expect(component.isOpen).toBeFalse();
  }));

  /**
   * @description Toggling twice closes the menu again.
   * @input  toggleMenu() twice
   * @output isOpen false, menuPosition null
   */
  it('toggleMenu() closes an open menu', fakeAsync(() => {
    component.toggleMenu();
    tick();
    component.toggleMenu();
    expect(component.isOpen).toBeFalse();
    expect(component.menuPosition).toBeNull();
  }));
  /**
   * @description While open, scrolling (of any element - the admin content area scrolls, not the
   *   window) and resizing re-position the menu; closed or destroyed it does nothing.
   * @input open menu; scroll of a nested element + resize; close; scroll + resize; reopen,
   *   destroy, scroll.
   * @output positionMenu called twice while open, not after closing nor after destroy.
   */
  it('follows scroll and resize while open', fakeAsync(() => {
    fixture.nativeElement.querySelector('.action-menu-trigger').click();
    fixture.detectChanges();
    tick();
    const position = spyOn(component as any, 'positionMenu');
    const scroller = document.createElement('div');
    document.body.appendChild(scroller);
    scroller.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    expect(position).toHaveBeenCalledTimes(2);
    component.isOpen = false;
    scroller.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    expect(position).toHaveBeenCalledTimes(2);
    component.isOpen = true;
    fixture.destroy();
    scroller.dispatchEvent(new Event('scroll'));
    expect(position).toHaveBeenCalledTimes(2);
    scroller.remove();
  }));

  /**
   * @description The main action (`primaryAction`) is a button of its own next to the menu
   *   (label shared.add) and is not in the menu; a click emits its action. When its config may
   *   not be shown (showIf false - no permission, trash) there is no button and still nothing
   *   in the menu. Without `primaryAction` everything stays in the menu.
   * @input  default primaryAction (adding a record); then 'export'; click the button; then export
   *   showIf false; then primaryAction null
   * @output button 'shared.add', menu [Import] (Hidden not shown); emits 'export'; no button,
   *   menu [Import]; no button, menu [Export, Import]
   */
  it('shows the main action as its own button, not in the menu', () => {
    const emitted: string[] = [];
    component.actionTriggered.subscribe((a: string) => emitted.push(a));
    const el = fixture.nativeElement as HTMLElement;
    const openMenuLabels = () => {
      component.isOpen = true;
      (component as any).cd.markForCheck();
      fixture.detectChanges();
      const labels = items().map(i => i.textContent!.trim());
      component.isOpen = false;
      (component as any).cd.markForCheck();
      fixture.detectChanges();
      return labels;
    };

    expect(component.primaryAction).toBe('handleCreateFormOpened');
    fixture.componentRef.setInput('primaryAction', 'export');
    fixture.detectChanges();
    const button = el.querySelector('.action-menu-primary') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('shared.add');
    expect(button.querySelector('.action-menu-primary-label')!.textContent!.trim()).toBe('shared.add');
    expect(openMenuLabels()).toEqual(['⬆Import']);
    button.click();
    expect(emitted).toEqual(['export']);

    fixture.componentRef.setInput('configs', [{ action: 'export', label: 'Export', showIf: false }, { action: 'import', label: 'Import' }]);
    fixture.detectChanges();
    expect(el.querySelector('.action-menu-primary')).toBeNull();
    expect(openMenuLabels()).toEqual(['Import']);

    fixture.componentRef.setInput('primaryAction', null);
    fixture.componentRef.setInput('configs', [{ action: 'export', label: 'Export' }, { action: 'import', label: 'Import' }]);
    fixture.detectChanges();
    expect(el.querySelector('.action-menu-primary')).toBeNull();
    expect(openMenuLabels()).toEqual(['Export', 'Import']);
  });

  /**
   * @description An item that needs attention gets an orange dot (+ its title for the tooltip and
   *   the screen readers), and so does the trigger - seen with the menu closed; a hidden item
   *   with attention does not mark the trigger.
   * @input configs: hidden item with attention; then Export with attention + title 'Texts missing'.
   * @output no trigger dot / title; then trigger dot + title 'Texts missing'; open: Export with a
   *   dot and title, Import without.
   */
  it('marks an item that needs attention and the trigger', fakeAsync(() => {
    const trigger = () => fixture.nativeElement.querySelector('.action-menu-trigger') as HTMLButtonElement;
    fixture.componentRef.setInput('configs', [{ action: 'hidden', label: 'Hidden', showIf: false, attention: true }]);
    fixture.detectChanges();
    expect([trigger().querySelector('.action-menu-dot'), trigger().getAttribute('title')]).toEqual([null, null]);

    fixture.componentRef.setInput('configs', [
      { action: 'export', label: 'Export', attention: true, attentionTitle: 'Texts missing' },
      { action: 'import', label: 'Import' }
    ]);
    fixture.detectChanges();
    expect(trigger().querySelector('.action-menu-dot')).not.toBeNull();
    expect(trigger().getAttribute('title')).toBe('Texts missing');
    expect(trigger().querySelector('.action-menu-sr')!.textContent!.trim()).toBe('Texts missing');

    trigger().click();
    fixture.detectChanges();
    tick();
    expect(items().map(item => [!!item.querySelector('.action-menu-dot'), item.getAttribute('title')]))
      .toEqual([[true, 'Texts missing'], [false, null]]);
  }));
});
