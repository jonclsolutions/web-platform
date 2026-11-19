/**
 * @file releases.component.spec.ts
 * @path src/app/admin/core-pages/releases/releases.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ReleasesComponent (page Core → Releases): running version, the
 *   releases with their changes (newest expanded, toggling), the filter by area (from `?area=`
 *   too), the empty and the failed state.
 * @dependencies src/testing/admin-test-helpers.ts (DataHandler spy, i18n and permission stubs).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { ReleasesComponent } from './releases.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';
import { requiresApps } from '../../../../testing/requires-apps';

describe('ReleasesComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ReleasesComponent>;
  let query: BehaviorSubject<any>;
  const notes = {
    current: 'v2',
    releases: [
      { version: 'v2', date: '2026-02-01', changes: [
        { type: 'security', area: 'core', part: 'admin', text: 'Core security', ref: '#5' },
        { type: 'fixed', area: 'shop', part: 'public', text: 'Shop fix' },
      ] },
      { version: 'v1', date: '2026-01-01', changes: [{ type: 'added', area: 'core', part: 'admin', text: 'Core old' }] },
    ],
  };

  const setup = async (answer: any, area: string | null = null) => {
    ctx = createAdminTestContext({ granted: ['view-eshop', 'shop-orders-view'] });
    (ctx.dataHandler as any).get.and.returnValue(answer);
    query = new BehaviorSubject(convertToParamMap(area ? { area } : {}));
    await TestBed.configureTestingModule({
      imports: [ReleasesComponent],
      providers: [...ctx.providers, { provide: ActivatedRoute, useValue: { queryParamMap: query } }],
    }).compileComponents();
    fixture = TestBed.createComponent(ReleasesComponent);
    fixture.detectChanges();
  };

  afterEach(() => fixture?.destroy());

  /**
   * @description The running version, both releases, the newest open with its changes (type,
   *   area, public part, text, ticket); a click opens the older one and closes the newest.
   * @input Notes v2 / v1; click both heads.
   * @output 'v2' in the header; 2 releases, 2 changes in v2 with the running badge; v1 closed;
   *   after the clicks v2 closed, v1 open.
   */
  it('lists the releases with the newest open', async () => {
    requiresApps('shop');
    await setup(of(notes));
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.rl-current')!.textContent).toContain('v2');
    const releases = el.querySelectorAll('.rl-release');
    expect(releases.length).toBe(2);
    expect(releases[0].querySelector('.rl-badge')).not.toBeNull();
    const changes = releases[0].querySelectorAll('.rl-change');
    expect(changes.length).toBe(2);
    expect(changes[0].querySelector('.rl-type--security')!.textContent!.trim()).toBe('releases.type_security');
    expect(changes[0].querySelector('.rl-ref')!.textContent!.trim()).toBe('#5');
    expect(changes[1].querySelector('.rl-area')!.textContent).toContain('releases.part_public');
    expect(releases[1].querySelector('.rl-changes')).toBeNull();

    (releases[0].querySelector('.rl-release-head') as HTMLButtonElement).click();
    (releases[1].querySelector('.rl-release-head') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(releases[0].querySelector('.rl-changes')).toBeNull();
    expect(releases[1].querySelector('.rl-changes')).not.toBeNull();
  });

  /**
   * @description Filter: the buttons all / core / the user's applications; `?area=shop` shows
   *   only the release that changed the shop; an unknown area falls back to all.
   * @input ?area=shop; then ?area=blog.
   * @output Buttons all, core, shop; one release v2 with 'Shop fix'; then both releases.
   */
  it('filters by area', async () => {
    requiresApps('shop');
    await setup(of(notes), 'shop');
    const el: HTMLElement = fixture.nativeElement;
    expect(fixture.componentInstance.areas.map(a => a.id)).toEqual(['all', 'core', 'shop']);
    expect(el.querySelectorAll('.rl-release').length).toBe(1);
    expect(el.querySelector('.rl-text')!.textContent).toContain('Shop fix');
    expect(el.querySelector('.rl-filter .rbb-btn.active .rbb-label')!.textContent!.trim()).toBe('admin-layout.module_shop');

    query.next(convertToParamMap({ area: 'blog' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.area).toBe('all');
    expect(el.querySelectorAll('.rl-release').length).toBe(2);
  });

  /**
   * @description Empty and failed states.
   * @input No releases; a failing request.
   * @output .rl-empty with 'releases.empty'; .rl-error with 'releases.failed'.
   */
  it('shows the empty and the failed state', async () => {
    await setup(of({ current: 'dev', releases: [] }));
    expect(fixture.nativeElement.querySelector('.rl-empty')!.textContent.trim()).toBe('releases.empty');
    fixture.destroy();
    TestBed.resetTestingModule();
    await setup(throwError(() => new Error('down')));
    expect(fixture.nativeElement.querySelector('.rl-error')!.textContent.trim()).toBe('releases.failed');
  });
});
