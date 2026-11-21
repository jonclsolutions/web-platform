/**
 * @file library-icons.component.spec.ts
 * @path src/app/apps/js-creator/admin/library/library-icons/library-icons.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of LibraryIconsComponent: the set is read from the static icons.json
 *   and filtered by name.
 * @dependencies src/testing/admin-test-helpers.ts (admin doubles), HttpTestingController.
 */

import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { LibraryIconsComponent } from './library-icons.component';
import { createAdminTestContext } from '../../../../../../testing/admin-test-helpers';

describe('LibraryIconsComponent', () => {
  /**
   * @description All icons are shown, the search narrows them; source and licence are named.
   * @input set {heart, heart-pulse, star}; search "heart"
   * @output 3 tiles; shown [heart, heart-pulse]; source line "lucide-static@1 · ISC"
   */
  it('shows and filters the icon set', async () => {
    await TestBed.configureTestingModule({ imports: [LibraryIconsComponent], providers: createAdminTestContext().providers }).compileComponents();
    const fixture = TestBed.createComponent(LibraryIconsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('assets/apps/js-creator/admin/assets/icons/icons.json').flush({
      source: 'lucide-static@1', license: 'ISC', viewBox: '0 0 24 24',
      icons: { heart: [['path', { d: 'M1 1' }]], 'heart-pulse': [['path', { d: 'M2 2' }]], star: [['circle', { cx: '1', cy: '1', r: '1' }]] },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.lc-icon').length).toBe(3);
    component.search = 'heart';
    expect(component.shown.map(icon => icon.name)).toEqual(['heart', 'heart-pulse']);
    expect(component.source).toBe('lucide-static@1 · ISC');
  });
});
