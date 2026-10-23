/**
 * @file button-builder.component.spec.ts
 * @path src/app/admin/components/builders/button-builder/button-builder.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ButtonBuilderComponent – the toolbar that renders buttons from a
 *   config array and emits the clicked action name.
 * @dependencies
 * - IconComponent (real, rendered for buttons with an icon)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonBuilderComponent } from './button-builder.component';

describe('ButtonBuilderComponent', () => {
  let fixture: ComponentFixture<ButtonBuilderComponent>;
  let component: ButtonBuilderComponent;

  const render = (configs: any[]) => {
    fixture.componentRef.setInput('configs', configs);
    fixture.detectChanges();
    return Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ButtonBuilderComponent] }).compileComponents();
    fixture = TestBed.createComponent(ButtonBuilderComponent);
    component = fixture.componentInstance;
  });

  /**
   * @description One button per config with its label and CSS class.
   * @input  configs [{ action: 'a', label: 'Add', class: 'btn-create' }, { action: 'b', label: 'Export' }]
   * @output 2 buttons, labels 'Add' and 'Export', first has class 'btn-create' and 'small-btn'
   */
  it('renders a button per config', () => {
    const buttons = render([{ action: 'a', label: 'Add', class: 'btn-create' }, { action: 'b', label: 'Export' }]);
    expect(buttons.length).toBe(2);
    expect(buttons.map(b => b.querySelector('.btn-label')!.textContent!.trim())).toEqual(['Add', 'Export']);
    expect(buttons[0].classList).toContain('btn-create');
    expect(buttons[0].classList).toContain('small-btn');
  });

  /**
   * @description Buttons with showIf === false are not rendered (other values are).
   * @input  configs with showIf false, true and undefined
   * @output 2 buttons rendered
   */
  it('hides buttons with showIf = false', () => {
    const buttons = render([
      { action: 'a', label: 'A', showIf: false },
      { action: 'b', label: 'B', showIf: true },
      { action: 'c', label: 'C' }
    ]);
    expect(buttons.map(b => b.textContent!.trim())).toEqual(['B', 'C']);
  });

  /**
   * @description Active buttons get the 'active' class.
   * @input  configs [{ action: 'f', label: 'Filter', isActive: true }]
   * @output button has class 'active'
   */
  it('marks active buttons', () => {
    const [button] = render([{ action: 'f', label: 'Filter', isActive: true }]);
    expect(button.classList).toContain('active');
  });

  /**
   * @description An icon is rendered only for buttons that define one.
   * @input  configs [{ icon: 'edit' }, { no icon }]
   * @output first button contains app-icon, second does not
   */
  it('renders the icon only when configured', () => {
    const buttons = render([{ action: 'e', label: 'Edit', icon: 'edit' }, { action: 'x', label: 'X' }]);
    expect(buttons[0].querySelector('app-icon')).not.toBeNull();
    expect(buttons[1].querySelector('app-icon')).toBeNull();
  });

  /**
   * @description Clicking a button emits its action name.
   * @input  click on the button with action 'toggleFilters'
   * @output actionTriggered emits 'toggleFilters'
   */
  it('emits the action of the clicked button', () => {
    const emitted: string[] = [];
    component.actionTriggered.subscribe(a => emitted.push(a));
    const [button] = render([{ action: 'toggleFilters', label: 'Filter' }]);
    button.click();
    expect(emitted).toEqual(['toggleFilters']);
  });
});
