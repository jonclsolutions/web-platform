/**
 * @file portal-help.component.spec.ts
 * @path src/app/apps/project-portal/public/sections/help/portal-help.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit test of PortalHelpComponent: one card per topic and the support box.
 * @dependencies ../../portal.testing (stubs); fakeAsync for timers.
 */

import { TestBed, discardPeriodicTasks, fakeAsync } from '@angular/core/testing';
import { setUpPortal } from '../../portal.testing';
import { PORTAL_HELP_TOPICS, PortalHelpComponent } from './portal-help.component';

describe('PortalHelpComponent', () => {
  /**
   * @description Help topics with their texts and the support box.
   * @input help section.
   * @output 13 cards (help_login_title first), support box with help_support_text.
   */
  it('lists the help topics', fakeAsync(() => {
    setUpPortal({ imports: [PortalHelpComponent] });
    const fixture = TestBed.createComponent(PortalHelpComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pp-help-item').length).toBe(PORTAL_HELP_TOPICS.length);
    expect(PORTAL_HELP_TOPICS.length).toBe(13);
    expect(el.querySelector('.pp-help-item .pp-card-title')!.textContent).toContain('help_login_title');
    expect(el.querySelector('.pp-help-support-box')!.textContent).toContain('help_support_text');
    fixture.destroy();
    discardPeriodicTasks();
  }));
});
