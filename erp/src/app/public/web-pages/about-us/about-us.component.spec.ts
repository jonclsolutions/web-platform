/**
 * @file about-us.component.spec.ts
 * @path src/app/public/web-pages/about-us/about-us.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of AboutUsComponent: texts of the `about_us` section are rendered (the page has
 *   no own logic beyond BasePublicComponent).
 * @dependencies
 * - createPublicPageContext.
 */

import { TestBed } from '@angular/core/testing';

import { AboutUsComponent } from './about-us.component';
import { createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('AboutUsComponent', () => {
  /**
   * @description Header, paragraphs and milestones rendered; nothing before translations.
   * @input No translations; then about_us with header / paragraph / milestone.
   * @output Empty page; 'About', 'Story', '2020' rendered.
   */
  it('renders the about-us texts', () => {
    const ctx = createPublicPageContext();
    TestBed.configureTestingModule({ imports: [AboutUsComponent], providers: ctx.providers });
    const fixture = TestBed.createComponent(AboutUsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('About');

    ctx.setTranslations({ about_us: { header: 'About', paragraph_1: 'Story', milestones: { heading: 'History', m1: { year: '2020', title: 'Start', text: 'Founded' } } } });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('About');
    expect(text).toContain('Story');
    expect(text).toContain('2020');
  });
});
