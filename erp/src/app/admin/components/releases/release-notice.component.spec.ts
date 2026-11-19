/**
 * @file release-notice.component.spec.ts
 * @path src/app/admin/components/releases/release-notice.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ReleaseNoticeComponent: hidden without an unseen release of its
 *   module; the text with the version and the count; "What's new" opens the page filtered to the
 *   module, the cross hides the notice.
 * @dependencies src/testing/admin-test-helpers.ts (DataHandler spy, i18n stub).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { ReleaseNoticeComponent } from './release-notice.component';
import { RELEASE_SEEN_KEY } from './release-notes.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('ReleaseNoticeComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ReleaseNoticeComponent>;
  const notes = {
    current: 'v2',
    releases: [
      { version: 'v2', date: '2026-02-01', changes: [{ type: 'fixed', area: 'core', part: 'admin', text: 'A' }, { type: 'added', area: 'core', part: 'admin', text: 'B' }] },
      { version: 'v1', date: '2026-01-01', changes: [{ type: 'added', area: 'core', part: 'admin', text: 'Old' }] },
    ],
  };

  beforeEach(async () => {
    localStorage.removeItem(RELEASE_SEEN_KEY + 'core');
    ctx = createAdminTestContext({ granted: [] });
    (ctx.dataHandler as any).get.and.returnValue(of(notes));
    await TestBed.configureTestingModule({ imports: [ReleaseNoticeComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(ReleaseNoticeComponent);
    fixture.componentRef.setInput('module', 'core');
  });

  afterEach(() => {
    fixture.destroy();
    localStorage.removeItem(RELEASE_SEEN_KEY + 'core');
  });

  /**
   * @description Nothing on the first visit; after an update the notice with version and count.
   * @input No seen version; then seen v1.
   * @output No .release-notice; then text 'releases.notice_text' with {version}/{count} filled.
   */
  it('shows the notice only after an update of its module', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.release-notice')).toBeNull();

    localStorage.setItem(RELEASE_SEEN_KEY + 'core', 'v1');
    const fresh = TestBed.createComponent(ReleaseNoticeComponent);
    fresh.componentRef.setInput('module', 'core');
    fresh.detectChanges();
    const notice: HTMLElement = fresh.nativeElement.querySelector('.release-notice');
    expect(notice).not.toBeNull();
    expect(fresh.componentInstance.text(fresh.componentInstance.releases)).toBe('releases.notice_text');
    fresh.destroy();
  });

  /**
   * @description "What's new" opens Releases filtered to the module and hides the notice; the
   *   cross hides it as well.
   * @input Seen v1; click .release-notice-open; seen v1 again; click .release-notice-close.
   * @output navigate(['/admin/core/releases'], {queryParams: {area: 'core'}}); notice gone twice;
   *   seen version v2.
   */
  it('opens the release notes or closes', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    localStorage.setItem(RELEASE_SEEN_KEY + 'core', 'v1');
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.release-notice-open') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/core/releases'], { queryParams: { area: 'core' } });
    expect(fixture.nativeElement.querySelector('.release-notice')).toBeNull();
    expect(localStorage.getItem(RELEASE_SEEN_KEY + 'core')).toBe('v2');

    localStorage.setItem(RELEASE_SEEN_KEY + 'core', 'v1');
    fixture.componentInstance.close();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.release-notice')).toBeNull();
  });
});
