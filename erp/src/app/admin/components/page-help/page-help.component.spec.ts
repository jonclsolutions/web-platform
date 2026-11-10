/**
 * @file page-help.component.spec.ts
 * @path src/app/admin/components/page-help/page-help.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PageHelpComponent: the "?" of a page header opens the knowledge base
 *   page named by `data.help` of the page route; no (valid) help topic = no button.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (i18n stub).
 */

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { KNOWLEDGE_BASE_URL, PageHelpComponent } from './page-help.component';
import { createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('PageHelpComponent', () => {
  /** Renders the button for a page route with the given route data. */
  const render = (data: Record<string, unknown> | null) => {
    const ctx = createAdminTestContext();
    TestBed.configureTestingModule({
      imports: [PageHelpComponent],
      providers: [
        ...ctx.providers,
        provideRouter([]),
        ...(data ? [{ provide: ActivatedRoute, useValue: { snapshot: { data } } }] : []),
      ],
    });
    const fixture = TestBed.createComponent(PageHelpComponent);
    fixture.detectChanges();
    return fixture;
  };

  /**
   * @description A page with a help topic links its knowledge base page.
   * @input data.help 'administrators'.
   * @output link /admin/intranet/knowledge-base/administrators; "?" with the tooltip / label.
   */
  it('links the knowledge base page of the page', () => {
    const fixture = render({ help: 'administrators' });
    const link = fixture.nativeElement.querySelector('a.page-help-btn') as HTMLAnchorElement;
    expect(KNOWLEDGE_BASE_URL).toBe('/admin/intranet/knowledge-base');
    expect(link.getAttribute('href')).toBe('/admin/intranet/knowledge-base/administrators');
    expect(link.textContent?.trim()).toBe('?');
    expect(link.title).toBe('page-help.title');
    expect(link.getAttribute('aria-label')).toBe('page-help.title');
  });

  /**
   * @description Without a valid help topic (or outside a route) nothing is rendered.
   * @input No help; help '../x'; no ActivatedRoute.
   * @output No link in all three cases.
   */
  it('shows nothing without a help topic', () => {
    for (const data of [{}, { help: '../x' }, null]) {
      TestBed.resetTestingModule();
      const fixture = render(data);
      expect(fixture.componentInstance.link).toBeNull();
      expect(fixture.nativeElement.querySelector('a')).toBeNull();
    }
  });
});
