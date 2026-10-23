/**
 * @file web-layout.component.spec.ts
 * @path src/app/public/web-pages/web-layout/web-layout.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of WebLayoutComponent: analytics initialised once with the layout and the root
 *   scroll lock toggled for the mobile menu.
 * @dependencies
 * - createPublicPageContext; AnalyticsService spy; header / footer / cookie banner rendered for real.
 */

import { TestBed } from '@angular/core/testing';

import { WebLayoutComponent } from './web-layout.component';
import { AnalyticsService } from '../../../shared/services/analytics.service';
import { createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('WebLayoutComponent', () => {
  /**
   * @description Layout start initialises analytics (consent mode); menu open / close toggles
   *   the 'no-scroll' class on <html>.
   * @input detectChanges(); toggleRootScroll(true); toggleRootScroll(false).
   * @output AnalyticsService.init once; class added; class removed.
   */
  it('initialises analytics and locks the page scroll for the menu', () => {
    const analytics = jasmine.createSpyObj('AnalyticsService', ['init']);
    const ctx = createPublicPageContext();
    TestBed.configureTestingModule({ imports: [WebLayoutComponent], providers: [...ctx.providers, { provide: AnalyticsService, useValue: analytics }] });
    const fixture = TestBed.createComponent(WebLayoutComponent);
    fixture.detectChanges();
    expect(analytics.init).toHaveBeenCalledTimes(1);

    fixture.componentInstance.toggleRootScroll(true);
    expect(document.documentElement.classList.contains('no-scroll')).toBeTrue();
    fixture.componentInstance.toggleRootScroll(false);
    expect(document.documentElement.classList.contains('no-scroll')).toBeFalse();
    fixture.destroy();
  });
});
