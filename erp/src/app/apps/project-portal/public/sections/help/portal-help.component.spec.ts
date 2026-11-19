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
import cz from '../../i18n/cz.json';
import en from '../../i18n/en.json';

describe('PortalHelpComponent', () => {
  /**
   * @description Help topics with their texts and the support box.
   * @input help section.
   * @output 18 cards (help_first_steps_title first), support box with help_support_text; every
   *   topic has its title and text in both languages.
   */
  it('lists the help topics', fakeAsync(() => {
    setUpPortal({ imports: [PortalHelpComponent] });
    const fixture = TestBed.createComponent(PortalHelpComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pp-help-item').length).toBe(PORTAL_HELP_TOPICS.length);
    expect(PORTAL_HELP_TOPICS.length).toBe(18);
    expect(el.querySelector('.pp-help-item .pp-card-title')!.textContent).toContain('help_first_steps_title');
    for (const texts of [cz, en] as Record<string, string>[]) {
      for (const topic of PORTAL_HELP_TOPICS) {
        expect(texts[`help_${topic}_title`]).withContext(topic).toBeTruthy();
        expect(texts[`help_${topic}_text`]).withContext(topic).toBeTruthy();
      }
    }
    expect(el.querySelector('.pp-help-support-box')!.textContent).toContain('help_support_text');
    fixture.destroy();
    discardPeriodicTasks();
  }));
});
