/**
 * @file tos.component.spec.ts
 * @path src/app/public/web-pages/tos/tos.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of TosComponent (Terms of service page): the document 'tos' is loaded in the
 *   current language through LegalDocsService, reloaded on a language switch and rendered with
 *   its sections, sub-sections and bullet lists; a failed load is logged.
 * @dependencies
 * - createPublicPageContext (translations / language), LegalDocsService spy.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { TosComponent } from './tos.component';
import { LegalDocsService } from '../../../shared/services/legal-docs.service';
import { PublicPageContext, createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('TosComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<TosComponent>;
  let legal: jasmine.SpyObj<LegalDocsService>;
  const doc = (lang: string) => ({
    last_update_date: '1. 1. 2026', footer_effective: 'Effective ' + lang,
    sections: [{ heading: 'Section ' + lang, subsections: [{ heading: 'Sub', text: 'Text', list: ['Bullet A', 'Bullet B'] }] }, { heading: 'Empty', subsections: [] }]
  });

  beforeEach(() => {
    ctx = createPublicPageContext({ translations: { tos: { header_main: 'Header', last_update_text: 'Updated' } } });
    legal = jasmine.createSpyObj('LegalDocsService', ['getDocument']);
    legal.getDocument.and.callFake(((_slug: string, lang: string) => of(doc(lang))) as any);
    TestBed.configureTestingModule({
      imports: [TosComponent],
      providers: [...ctx.providers, { provide: LegalDocsService, useValue: legal }]
    });
    fixture = TestBed.createComponent(TosComponent);
    fixture.detectChanges();
  });

  /**
   * @description Document of the current language rendered; a language switch reloads it.
   * @input Language cz; then en.
   * @output getDocument('tos', 'cz') → sections + bullets rendered; getDocument('tos', 'en').
   */
  it('loads and renders the document per language', () => {
    expect(legal.getDocument).toHaveBeenCalledWith('tos', 'cz');
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Header');
    expect(text).toContain('Section cz');
    expect(text).toContain('Bullet B');
    expect(text).toContain('Effective cz');

    ctx.localization.currentLanguage$.next('en');
    fixture.detectChanges();
    expect(legal.getDocument).toHaveBeenCalledWith('tos', 'en');
    expect(fixture.nativeElement.textContent).toContain('Section en');
  });

  /**
   * @description A failing load is logged and leaves the page without a document.
   * @input getDocument errors on the language switch to 'de'.
   * @output console.error; previous document kept (data not replaced by an error).
   */
  it('logs a failed document load', () => {
    spyOn(console, 'error');
    legal.getDocument.and.returnValue(throwError(() => new Error('down')));
    ctx.localization.currentLanguage$.next('de');
    expect(console.error).toHaveBeenCalled();
    expect(fixture.componentInstance.data.footer_effective).toBe('Effective cz');
  });
});
