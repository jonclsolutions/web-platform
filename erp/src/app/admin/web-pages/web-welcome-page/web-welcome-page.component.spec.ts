/**
 * @file web-welcome-page.component.spec.ts
 * @path src/app/admin/web-pages/web-welcome-page/web-welcome-page.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of WebWelcomePageComponent – the landing page of the Web module:
 *   translated texts and quick-link cards shown only for the pages the user may open.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (i18n stub returning key paths, permission stub)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebWelcomePageComponent } from './web-welcome-page.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('WebWelcomePageComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<WebWelcomePageComponent>;
  let component: WebWelcomePageComponent;

  const setup = async (granted: string[] | 'all') => {
    ctx = createAdminTestContext({ granted });
    await TestBed.configureTestingModule({ imports: [WebWelcomePageComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(WebWelcomePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const cardLinks = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('a.wp-link-card')).map((a: any) => a.getAttribute('href'));

  /**
   * @description Texts come from the 'web-welcome-page' i18n section.
   * @input  t('card_logs_title'); strings.header
   * @output 'web-welcome-page.card_logs_title'; 'web-welcome-page.header' rendered in the title
   */
  it('reads texts from the web-welcome-page section', async () => {
    await setup('all');
    expect(component.t('card_logs_title')).toBe('web-welcome-page.card_logs_title');
    expect(ctx.i18n.getMergedSection).toHaveBeenCalledWith('web-welcome-page');
    expect(fixture.nativeElement.querySelector('.wp-welcome-title').textContent).toContain('web-welcome-page.header');
  });

  /**
   * @description With all permissions every one of the 9 cards is shown, in menu order.
   * @input  granted 'all'
   * @output 9 links, first '/admin/web/edit-website', last '/admin/web/business-logs'
   */
  it('shows every card to a user with all permissions', async () => {
    await setup('all');
    const links = cardLinks();
    expect(links.length).toBe(9);
    expect(links[0]).toBe('/admin/web/edit-website');
    expect(links[8]).toBe('/admin/web/business-logs');
    expect(component.quickLinks.map(l => l.icon)).toEqual(['edit-website', 'edit-news', 'user-request', 'sales-leads',
      'sales-orders', 'projects', 'job-applications', 'support-tickets', 'logs']);
  });

  /**
   * @description Cards are gated by the same permission keys as the left menu.
   * @input  granted ['web-news-view', 'web-projects-view']
   * @output only '/admin/web/edit-news' and '/admin/web/projects'
   */
  it('shows only the cards the user may open', async () => {
    await setup(['web-news-view', 'web-projects-view']);
    expect(cardLinks()).toEqual(['/admin/web/edit-news', '/admin/web/projects']);
  });

  /**
   * @description Each card renders its translated title and description.
   * @input  granted ['web-view-web-logs']
   * @output card text contains 'web-welcome-page.card_logs_title' and '…card_logs_desc'
   */
  it('renders title and description of a card', async () => {
    await setup(['web-view-web-logs']);
    const text = fixture.nativeElement.querySelector('a.wp-link-card').textContent;
    expect(text).toContain('web-welcome-page.card_logs_title');
    expect(text).toContain('web-welcome-page.card_logs_desc');
  });
});
