/**
 * @file action-menu-builder.component.spec.ts
 * @path src/app/admin/components/builders/action-menu-builder/action-menu-builder.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ActionMenuBuilderComponent – the "⋯ Actions" dropdown of the admin
 *   toolbars (open/close, outside click, action emit, position inside the viewport).
 * @dependencies
 * - none (standalone component)
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActionMenuBuilderComponent } from './action-menu-builder.component';

describe('ActionMenuBuilderComponent', () => {
  let fixture: ComponentFixture<ActionMenuBuilderComponent>;
  let component: ActionMenuBuilderComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ActionMenuBuilderComponent] }).compileComponents();
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
   * @description While open, scrolling and resizing re-position the menu; closed it does nothing.
   * @input open menu; scroll + resize; close; scroll + resize.
   * @output positionMenu called twice while open, not after closing.
   */
  it('follows scroll and resize while open', fakeAsync(() => {
    fixture.nativeElement.querySelector('.action-menu-trigger').click();
    fixture.detectChanges();
    tick();
    const position = spyOn(component as any, 'positionMenu');
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    expect(position).toHaveBeenCalledTimes(2);
    component.isOpen = false;
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    expect(position).toHaveBeenCalledTimes(2);
  }));
});
