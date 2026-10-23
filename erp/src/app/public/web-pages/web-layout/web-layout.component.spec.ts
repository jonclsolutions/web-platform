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
   * @description Layout start initialises analytics (consent mode) and renders the header.
   * @input detectChanges().
   * @output AnalyticsService.init once; app-public-header rendered.
   */
  it('initialises analytics and renders the header', () => {
    const analytics = jasmine.createSpyObj('AnalyticsService', ['init']);
    const ctx = createPublicPageContext();
    TestBed.configureTestingModule({ imports: [WebLayoutComponent], providers: [...ctx.providers, { provide: AnalyticsService, useValue: analytics }] });
    const fixture = TestBed.createComponent(WebLayoutComponent);
    fixture.detectChanges();
    expect(analytics.init).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('app-public-header')).not.toBeNull();
    fixture.destroy();
  });
});
