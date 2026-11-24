/**
 * @file record-actions.component.spec.ts
 * @path src/app/admin/components/record-actions/record-actions.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of RecordActionsComponent - the actions of a record on the left of the
 *   footer of a record popup: buttons, "⋯ More" for more than two other actions, Delete last.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (i18n stub returning the keys)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecordActionsComponent } from './record-actions.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('RecordActionsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<RecordActionsComponent>;
  let component: RecordActionsComponent;

  const act = (action: string, type = 'neutral_button', display = action, header = '') =>
    ({ type, action, isActive: true, display_name: display, header_name: header }) as any;
  const render = (actions: any[]) => {
    fixture.componentRef.setInput('actions', actions);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [RecordActionsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(RecordActionsComponent);
    component = fixture.componentInstance;
  });

  /**
   * @description Up to two other actions are buttons before Delete; Delete is last, red, with its
   *   name as label (an icon-only row button falls back to its column header); a click emits the action.
   * @input variants, images (empty text, header 'Images') + delete.
   * @output buttons variants, Images, delete; delete has the danger class and aria-label; click emits 'images'.
   */
  it('shows the actions with Delete last', () => {
    const el = render([act('variants'), act('images', 'neutral_button', '', 'Images'), act('delete', 'delete_button', 'Delete')]);
    const buttons = Array.from(el.querySelectorAll('.ra-record-actions > .ra-record-action')) as HTMLButtonElement[];
    expect(buttons.map(b => b.textContent!.trim())).toEqual(['variants', 'Images', 'Delete']);
    expect(buttons[2].classList).toContain('ra-record-action--danger');
    expect(buttons[2].getAttribute('aria-label')).toBe('Delete');
    expect(component.moreActionsMenu).toBeFalse();
    const emitted = spyOn(component.action, 'emit');
    buttons[1].click();
    expect(emitted).toHaveBeenCalledWith('images');
  });

  /**
   * @description More than two other actions go under "⋯ More" while Delete stays visible; an item
   *   of the menu emits its action and closes the menu.
   * @input variants, images, orders + delete; open More; click orders.
   * @output More button ('record-actions.more_actions_button') + delete; menu with 3 items; 'orders'
   *   emitted, menu closed.
   */
  it('puts more than two other actions under More', () => {
    const el = render([act('variants'), act('images'), act('orders'), act('delete', 'delete_button')]);
    expect(component.moreActionsMenu).toBeTrue();
    expect(el.querySelectorAll('.ra-record-actions > .ra-record-action--danger').length).toBe(1);
    const more = el.querySelector('.ra-more > .ra-record-action') as HTMLButtonElement;
    expect(more.textContent).toContain('record-actions.more_actions_button');
    more.click();
    fixture.detectChanges();
    const items = Array.from(el.querySelectorAll('.ra-more-item')) as HTMLButtonElement[];
    expect(items.map(b => b.textContent!.trim())).toEqual(['variants', 'images', 'orders']);
    const emitted = spyOn(component.action, 'emit');
    items[2].click();
    expect(emitted).toHaveBeenCalledWith('orders');
    expect(component.isMoreActionsOpen).toBeFalse();
  });
});
