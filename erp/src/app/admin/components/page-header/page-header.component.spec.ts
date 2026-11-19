/**
 * @file page-header.component.spec.ts
 * @path src/app/admin/components/page-header/page-header.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PageHeaderComponent (the one header of every admin page): title as
 *   the h1, optional subtitle, projected back link / badges / rich subtitle / actions in their
 *   places, the help button last (or hidden).
 * @dependencies src/testing/admin-test-helpers.ts (i18n stub); a host component projecting content.
 */

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { PageHeaderComponent } from './page-header.component';
import { createAdminTestContext } from '../../../../testing/admin-test-helpers';

@Component({
  standalone: true,
  imports: [PageHeaderComponent],
  template: `
    <app-page-header [title]="title" [subtitle]="subtitle" [help]="help">
      @if (full) { <a phBefore class="back">Back</a> }
      @if (full) { <span phMeta class="badge">Public</span> }
      @if (full) { <span phSub class="rich">#7 · <strong>Jana</strong></span> }
      <button type="button" class="action">Actions</button>
    </app-page-header>`,
})
class HostComponent {
  title = 'Inquiries';
  subtitle: string | null = 'All inquiries of the web form';
  help = true;
  full = true;
}

describe('PageHeaderComponent', () => {
  function render(change: Partial<HostComponent> = {}) {
    const ctx = createAdminTestContext();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [...ctx.providers, provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { data: { help: 'user-request' } } } }],
    });
    const fixture = TestBed.createComponent(HostComponent);
    Object.assign(fixture.componentInstance, change);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /**
   * @description Title, subtitle and every projected part in its place; the help button is the
   *   last item of the actions.
   * @input title 'Inquiries', subtitle, back link, badge, rich subtitle, one action, help topic.
   * @output one h1 'Inquiries'; subtitle text; back link in .ph-before; badge in the title row;
   *   rich subtitle in .ph-subtitle--rich; actions = [button.action, app-page-help] with the "?" link.
   */
  it('renders the title, the subtitle and the projected parts', () => {
    const el = render();
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('h1.ph-title')!.textContent!.trim()).toBe('Inquiries');
    expect(el.querySelector('p.ph-subtitle')!.textContent!.trim()).toBe('All inquiries of the web form');
    expect(el.querySelector('.ph-before .back')).not.toBeNull();
    expect(el.querySelector('.ph-title-row .badge')).not.toBeNull();
    expect(el.querySelector('.ph-subtitle--rich .rich strong')!.textContent).toBe('Jana');
    const actions = Array.from(el.querySelector('.ph-actions')!.children).map(c => c.tagName.toLowerCase());
    expect(actions).toEqual(['button', 'app-page-help']);
    expect(el.querySelector('.ph-actions a.page-help-btn')!.getAttribute('href')).toContain('/admin/intranet/knowledge-base/user-request');
  });

  /**
   * @description Without a subtitle / projected parts nothing extra is rendered; [help]="false"
   *   leaves the help to the page.
   * @input subtitle null, no back link / badge / rich subtitle, help false.
   * @output no p.ph-subtitle; empty .ph-before and .ph-subtitle--rich; no app-page-help.
   */
  it('renders only what is given', () => {
    const el = render({ subtitle: null, full: false, help: false });
    expect(el.querySelector('p.ph-subtitle')).toBeNull();
    expect(el.querySelector('.ph-before')!.children.length).toBe(0);
    expect(el.querySelector('.ph-subtitle--rich')!.children.length).toBe(0);
    expect(el.querySelector('app-page-help')).toBeNull();
  });
});
