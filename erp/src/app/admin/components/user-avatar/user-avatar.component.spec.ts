/**
 * @file user-avatar.component.spec.ts
 * @path src/app/admin/components/user-avatar/user-avatar.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of UserAvatarComponent: photo vs. default image, size, accessible name
 *   and the fallback after a failed load.
 * @dependencies none
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserAvatarComponent } from './user-avatar.component';

describe('UserAvatarComponent', () => {
  let fixture: ComponentFixture<UserAvatarComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UserAvatarComponent] }).compileComponents();
    fixture = TestBed.createComponent(UserAvatarComponent);
    el = fixture.nativeElement;
  });

  /**
   * @description Without a URL the default image is shown, decorative without a label and named
   *   with one, in the given size.
   * @input  src null, size 40; then label 'Jan Novák'.
   * @output svg.user-avatar--default 40×40 aria-hidden; then role img with aria-label, no aria-hidden.
   */
  it('shows the default image without a photo', () => {
    fixture.componentRef.setInput('src', null);
    fixture.componentRef.setInput('size', 40);
    fixture.detectChanges();
    const svg = el.querySelector('svg.user-avatar--default')!;
    expect(svg.getAttribute('width')).toBe('40');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('img')).toBeNull();

    fixture.componentRef.setInput('label', 'Jan Novák');
    fixture.detectChanges();
    expect(svg.getAttribute('aria-label')).toBe('Jan Novák');
    expect(svg.getAttribute('aria-hidden')).toBeNull();
  });

  /**
   * @description A URL shows the photo; a failed load falls back to the default image; a new URL
   *   tries again.
   * @input  src '/a.webp'; error event; src '/b.webp'.
   * @output img src /a.webp 32 px; default svg; img src /b.webp.
   */
  it('shows the photo and falls back after an error', () => {
    fixture.componentRef.setInput('src', '/a.webp');
    fixture.detectChanges();
    const img = el.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/a.webp');
    expect(img.style.width).toBe('32px');

    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('svg.user-avatar--default')).not.toBeNull();

    fixture.componentRef.setInput('src', '/b.webp');
    fixture.detectChanges();
    expect((el.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe('/b.webp');
  });
});
