/**
 * @file library-page.component.spec.ts
 * @path src/app/apps/js-creator/admin/library/library-page.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of LibraryPageComponent: the tabs switch between images, fonts and icons.
 * @dependencies src/testing/admin-test-helpers.ts (admin doubles).
 */

import { TestBed } from '@angular/core/testing';
import { LibraryPageComponent } from './library-page.component';
import { createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('LibraryPageComponent', () => {
  /**
   * @description The images tab is open first; switching opens the fonts and the icons tab; an
   *   unknown value falls back to images.
   * @input switchTab('fonts'), ('icons'), ('x')
   * @output app-library-images, -fonts, -icons, -images rendered
   */
  it('switches the tabs', async () => {
    await TestBed.configureTestingModule({ imports: [LibraryPageComponent], providers: createAdminTestContext().providers }).compileComponents();
    const fixture = TestBed.createComponent(LibraryPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-library-images')).not.toBeNull();

    component.switchTab('fonts');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-library-fonts')).not.toBeNull();
    component.switchTab('icons');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-library-icons')).not.toBeNull();
    component.switchTab('x');
    expect(component.tab).toBe('images');
    expect(component.tabItems.map(item => item.value)).toEqual(['images', 'fonts', 'icons']);
  });
});
