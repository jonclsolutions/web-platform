/**
 * @file portal-contacts.component.spec.ts
 * @path src/app/apps/project-portal/public/sections/contacts/portal-contacts.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PortalContactsComponent: the supplier contact of the project and the
 *   company data loaded once per session.
 * @dependencies ../../portal.testing (stubs, sample data); fakeAsync for timers.
 */

import { TestBed, discardPeriodicTasks, fakeAsync } from '@angular/core/testing';
import { setUpPortal } from '../../portal.testing';
import { PortalContactsComponent } from './portal-contacts.component';

describe('PortalContactsComponent', () => {
  /**
   * @description Contacts loads the company settings once and shows the supplier contact.
   * @input project with lead + e-mail; the section opened twice; no contact.
   * @output getSiteSettings once; mailto link, 'Karel', 'RPSW'; 'supplier_contact_empty'.
   */
  it('shows the contacts and loads the company data once', fakeAsync(() => {
    const ctx = setUpPortal({ imports: [PortalContactsComponent] });
    ctx.session.project.set({ ...ctx.session.project()!, project_lead: 'Karel', contact_email: 'karel@firma.cz' });
    let fixture = TestBed.createComponent(PortalContactsComponent);
    fixture.detectChanges();
    fixture.destroy();
    fixture = TestBed.createComponent(PortalContactsComponent);
    fixture.detectChanges();
    expect(ctx.getSiteSettings).toHaveBeenCalledTimes(1);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a[href="mailto:karel@firma.cz"]')).not.toBeNull();
    expect(el.textContent).toContain('Karel');
    expect(el.textContent).toContain('RPSW');

    ctx.session.project.set({ ...ctx.session.project()!, project_lead: null, contact_email: null });
    fixture.detectChanges();
    expect(el.textContent).toContain('supplier_contact_empty');
    fixture.destroy();
    discardPeriodicTasks();
  }));
});
