/**
 * @file nav-badge.component.spec.ts
 * @path src/app/admin/components/nav-badge/nav-badge.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of NavBadgeComponent - the red number, the orange dot, both together,
 *   nothing without a badge, and the label as tooltip and screen-reader text.
 * @dependencies TestBed (standalone component, setInput).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavBadgeComponent } from './nav-badge.component';

describe('NavBadgeComponent', () => {
  let fixture: ComponentFixture<NavBadgeComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NavBadgeComponent] });
    fixture = TestBed.createComponent(NavBadgeComponent);
    host = fixture.nativeElement;
  });

  /**
   * @description No badge renders nothing and has no role / label (hidden host).
   * @input badge null
   * @output no children, class nb-empty, no role / aria-label / title
   */
  it('renders nothing without a badge', () => {
    fixture.detectChanges();
    expect(host.children.length).toBe(0);
    expect(host.classList).toContain('nb-empty');
    expect(host.getAttribute('role')).toBeNull();
    expect(host.getAttribute('title')).toBeNull();
  });

  /**
   * @description Unread only: the red number; attention only: the orange dot; both: number and
   *   dot side by side; only a switched off language being prepared: the grey dot; the label is
   *   the role="img" text and the tooltip.
   * @input { text '3' }, { text null, attention }, { text '99+', attention }, { text null,
   *   preparing } with labels
   * @output .nb-count '3' without dot; .nb-dot without number; '99+' + dot; a grey dot
   *   (.nb-dot--preparing) only; aria-label = title = label
   */
  it('shows the number, the dot or both with the label', () => {
    const set = (text: string | null, attention: boolean, label: string, preparing = false) => {
      fixture.componentRef.setInput('badge', { text, attention, preparing, label });
      fixture.detectChanges();
    };
    set('3', false, 'Nové poptávky: 3');
    expect(host.querySelector('.nb-count')!.textContent!.trim()).toBe('3');
    expect(host.querySelector('.nb-dot')).toBeNull();
    expect([host.getAttribute('role'), host.getAttribute('aria-label'), host.getAttribute('title')])
      .toEqual(['img', 'Nové poptávky: 3', 'Nové poptávky: 3']);

    set(null, true, 'Chybějící texty webu: 123 (angličtina 123)');
    expect(host.querySelector('.nb-count')).toBeNull();
    expect(host.querySelector('.nb-dot')).not.toBeNull();
    expect(host.getAttribute('title')).toBe('Chybějící texty webu: 123 (angličtina 123)');

    set('99+', true, 'x');
    expect(host.querySelector('.nb-count')!.textContent!.trim()).toBe('99+');
    expect(host.querySelector('.nb-dot')).not.toBeNull();
    expect(host.querySelector('.nb-dot--preparing')).toBeNull();
    expect(host.classList).not.toContain('nb-empty');

    set(null, false, 'Chybějící názvy stránek webu – vypnuté jazyky: polština 14', true);
    expect(host.querySelector('.nb-count')).toBeNull();
    expect(host.querySelectorAll('.nb-dot').length).toBe(1);
    expect(host.querySelector('.nb-dot--preparing')).not.toBeNull();
  });
});
