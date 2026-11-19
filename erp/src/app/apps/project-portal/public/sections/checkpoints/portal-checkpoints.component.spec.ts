/**
 * @file portal-checkpoints.component.spec.ts
 * @path src/app/apps/project-portal/public/sections/checkpoints/portal-checkpoints.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PortalCheckpointsComponent (Progress): the progress bar, the steps
 *   with their state and due date, and the description that expands (kept by the session).
 * @dependencies ../../portal.testing (stubs, sample data); fakeAsync for timers.
 */

import { TestBed, discardPeriodicTasks, fakeAsync } from '@angular/core/testing';
import { setUpPortal } from '../../portal.testing';
import { PortalCheckpointsComponent } from './portal-checkpoints.component';

describe('PortalCheckpointsComponent', () => {
  /**
   * @description A step with a description is a button that expands it (aria-expanded); one
   *   without stays plain; the expanded state lives in the session (kept between sections); the
   *   bar shows done / total.
   * @input Progress of the test project; click on step A (with description) twice; a new view
   *   after expanding it again.
   * @output '1 / 3', 33 % wide; 3 items, 1 toggle; description shown / hidden; still expanded in the new view.
   */
  it('expands the description of a step', fakeAsync(() => {
    const ctx = setUpPortal({ imports: [PortalCheckpointsComponent] });
    let fixture = TestBed.createComponent(PortalCheckpointsComponent);
    fixture.detectChanges();
    let el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.pp-progress-fraction')!.textContent!.trim()).toBe('1 / 3');
    expect((el.querySelector('.pp-progress-fill') as HTMLElement).style.width).toBe('33%');
    expect(el.querySelector('.pp-checkpoint-item.status-active .pp-due')!.textContent).toContain('due_date_prefix');
    expect(el.querySelector('.pp-checkpoint-item.status-active .pp-checkpoint-badge')!.textContent).toContain('checkpoint_status_active');
    const toggles = el.querySelectorAll<HTMLButtonElement>('.pp-checkpoint-toggle');
    expect(toggles.length).toBe(1);
    expect(el.querySelectorAll('.pp-checkpoint-item').length).toBe(3);
    expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
    toggles[0].click();
    fixture.detectChanges();
    expect(toggles[0].getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('#pp-cp-desc-1')!.textContent).toContain('Design of all pages');
    toggles[0].click();
    fixture.detectChanges();
    expect(el.querySelector('#pp-cp-desc-1')).toBeNull();

    toggles[0].click();
    fixture.destroy();
    fixture = TestBed.createComponent(PortalCheckpointsComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#pp-cp-desc-1')).not.toBeNull();

    ctx.session.project.set({ ...ctx.session.project()!, checkpoints: [] });
    fixture.detectChanges();
    expect(el.textContent).toContain('no_checkpoints');
    fixture.destroy();
    discardPeriodicTasks();
  }));
});
