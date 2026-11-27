/**
 * @file footer-copyright-option.component.spec.ts
 * @path src/app/admin/components/footer-copyright-option/footer-copyright-option.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of FooterCopyrightOptionComponent: loading the option, saving a change
 *   at once with the saved mark, a failed save putting the checkbox back, no change without the
 *   permission.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, i18n stub)
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FooterCopyrightOptionComponent } from './footer-copyright-option.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';
import { AdminNotificationsService } from '../../../core/services/admin-notifications.service';

describe('FooterCopyrightOptionComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<FooterCopyrightOptionComponent>;
  let option: FooterCopyrightOptionComponent;

  const create = async (shown: boolean, canUpdate = true) => {
    ctx = createAdminTestContext();
    (ctx.dataHandler as any).get.and.returnValue(of({ show_footer_copyright: shown }));
    await TestBed.configureTestingModule({ imports: [FooterCopyrightOptionComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(FooterCopyrightOptionComponent);
    option = fixture.componentInstance;
    fixture.componentRef.setInput('endpoint', 'web/settings/footer');
    fixture.componentRef.setInput('canUpdate', canUpdate);
    fixture.detectChanges();
  };

  afterEach(() => fixture?.destroy());

  /**
   * @description The option is loaded from the endpoint and shown as a checkbox with its note.
   * @input  GET web/settings/footer → shown true
   * @output get called with the endpoint; checkbox checked and enabled; note footer_copyright_note
   */
  it('loads the option', async () => {
    await create(true);
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('web/settings/footer');
    const box = fixture.nativeElement.querySelector('.fco-check') as HTMLInputElement;
    expect([box.checked, box.disabled]).toEqual([true, false]);
    expect(fixture.nativeElement.querySelector('.fco-note')?.textContent).toContain('translation-editor.footer_copyright_note');
  });

  /**
   * @description A change is saved at once; the saved mark disappears after a while; a failed
   *   save puts the checkbox back.
   * @input  untick (PUT ok); tick again with PUT failing
   * @output put('web/settings/footer', { show_footer_copyright: false }); shown false, saved mark
   *   then gone; shownChange [false]; notifications refreshed; failed save → shown false again,
   *   saving false, nothing emitted
   */
  it('saves a change at once and reverts a failed one', fakeAsync(async () => {
    await create(true);
    (ctx.dataHandler as any).put.and.returnValue(of({ show_footer_copyright: false }));
    const refresh = spyOn(TestBed.inject(AdminNotificationsService), 'refresh');
    const emitted: boolean[] = [];
    option.shownChange.subscribe(value => emitted.push(value));
    option.toggle(false);
    expect(emitted).toEqual([false]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect((ctx.dataHandler as any).put).toHaveBeenCalledWith('web/settings/footer', { show_footer_copyright: false });
    expect([option.shown, option.saved, option.saving]).toEqual([false, true, false]);
    tick(2000);
    expect(option.saved).toBeFalse();

    (ctx.dataHandler as any).put.and.returnValue(throwError(() => new Error('x')));
    option.toggle(true);
    expect([option.shown, option.saving]).toEqual([false, false]);
    expect(emitted).toEqual([false]);
  }));

  /**
   * @description Without the permission the checkbox is disabled and a toggle sends nothing.
   * @input  canUpdate false; toggle(false)
   * @output disabled checkbox; no PUT; shown stays true
   */
  it('changes nothing without the permission', async () => {
    await create(true, false);
    expect((fixture.nativeElement.querySelector('.fco-check') as HTMLInputElement).disabled).toBeTrue();
    option.toggle(false);
    expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();
    expect(option.shown).toBeTrue();
  });
});
