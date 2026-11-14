/**
 * @file apps.component.spec.ts
 * @path src/app/admin/core-pages/apps/apps.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of AppsComponent (page "Applications"): one card per application the
 *   user may open with the link to its landing page; the empty state without any.
 * @dependencies src/testing/admin-test-helpers.ts (auth, permission, i18n stubs).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppsComponent } from './apps.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';
import { requiresApps } from '../../../../testing/requires-apps';

describe('AppsComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<AppsComponent>;

  beforeEach(async () => {
    ctx = createAdminTestContext({ granted: [] });
    await TestBed.configureTestingModule({ imports: [AppsComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(AppsComponent);
  });

  afterEach(() => fixture.destroy());

  /**
   * @description Cards of the applications the user may open, with name, description and the
   *   "Manage" link to the first page of the application the user may open.
   * @input view-eshop + shop-orders-view, view-project-portal + project-portal-projects-view; render.
   * @output 2 cards: e-shop → /admin/shop/orders, project portal → /admin/project-portal/projects;
   *   names / descriptions from admin-layout; no empty state.
   */
  it('shows the applications the user may open', () => {
    requiresApps('web', 'shop', 'project-portal');
    ctx.permissions.granted = new Set(['view-eshop', 'shop-orders-view', 'view-project-portal', 'project-portal-projects-view']);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const cards = Array.from(el.querySelectorAll('.apps-card'));
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('.wp-link-title')!.textContent!.trim()).toBe('admin-layout.module_shop');
    expect(cards[0].querySelector('.wp-link-desc')!.textContent!.trim()).toBe('admin-layout.app_description_shop');
    expect(Array.from(el.querySelectorAll('a.apps-card-manage')).map(a => a.getAttribute('href')))
      .toEqual(['/admin/shop/orders', '/admin/project-portal/projects']);
    expect(el.querySelector('.apps-empty')).toBeNull();
  });

  /**
   * @description Without any application the page says so.
   * @input No permission; render.
   * @output No card; the empty text.
   */
  it('shows the empty state', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.apps-card').length).toBe(0);
    expect(el.querySelector('.apps-empty')!.textContent!.trim()).toBe('apps.empty');
  });
});
