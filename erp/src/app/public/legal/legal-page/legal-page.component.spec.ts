/**
 * @file legal-page.component.spec.ts
 * @path src/app/public/legal/legal-page/legal-page.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of LegalPageComponent and legalPageRoute: the document of the route is
 *   loaded in the current language through LegalDocsService, reloaded on a language switch and
 *   rendered with its sections; the notes of the document (cookie settings, more information);
 *   the translated footer; a failed load is logged; the route builder.
 * @dependencies
 * - createPublicPageContext (translations / language), LegalDocsService spy, ActivatedRoute with
 *   the route data of the document.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { LegalPageComponent } from './legal-page.component';
import { LEGAL_DOCUMENT_DATA, LegalDocumentSlug, legalPageRoute } from './legal-page.config';
import { LegalDocumentSectionsComponent } from '../legal-document-sections/legal-document-sections.component';
import { LegalDocsService } from '../../../shared/services/legal-docs.service';
import { CookieConsentService } from '../../../shared/services/cookie-consent.service';
import { PublicPageContext, createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('LegalPageComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<LegalPageComponent>;
  let legal: jasmine.SpyObj<LegalDocsService>;
  const texts = { header_main: 'Header', last_update_text: 'Updated', change_settings_text: 'Settings:', change_settings_link_text: 'Change', more_info_text: 'More:', more_info_link_text: 'Privacy' };
  const doc = (lang: string) => ({
    last_update_date: '1. 1. 2026', footer_effective: 'Effective ' + lang,
    sections: [{ id: 1, heading: 'Section ' + lang, content: '<p>Body</p>', subsections: [{ id: 2, heading: 'Sub', text: 'Text', list: ['Bullet A', 'Bullet B'] }] }],
  });
  const text = () => (fixture.nativeElement as HTMLElement).textContent!;

  /** Creates the page of the document (no route data = privacy policy). */
  function create(slug?: LegalDocumentSlug): void {
    ctx = createPublicPageContext({ translations: { privacy_policy: texts, tos: texts, cookies_policy: texts } });
    legal = jasmine.createSpyObj('LegalDocsService', ['getDocument', 'effectiveFooter']);
    legal.effectiveFooter.and.callFake(LegalDocsService.prototype.effectiveFooter);
    legal.getDocument.and.callFake(((_slug: string, lang: string) => of(doc(lang))) as any);
    TestBed.configureTestingModule({
      imports: [LegalPageComponent],
      providers: [
        ...ctx.providers,
        { provide: LegalDocsService, useValue: legal },
        { provide: ActivatedRoute, useValue: { snapshot: { data: slug ? { [LEGAL_DOCUMENT_DATA]: slug } : {} } } },
      ],
    });
    fixture = TestBed.createComponent(LegalPageComponent);
    fixture.detectChanges();
  }

  /**
   * @description The document of the route in the current language, rendered by the sections
   *   component; a language switch reloads it.
   * @input route 'tos', language cz; then en.
   * @output getDocument('tos', 'cz'); title, sections and bullets; getDocument('tos', 'en').
   */
  it('loads and renders the document per language', () => {
    create('tos');
    expect(legal.getDocument).toHaveBeenCalledWith('tos', 'cz');
    expect(fixture.debugElement.query(By.directive(LegalDocumentSectionsComponent))).not.toBeNull();
    expect(text()).toContain('Header');
    expect(text()).toContain('Section cz');
    expect(text()).toContain('Bullet B');
    expect(text()).toContain('Effective cz');

    ctx.localization.currentLanguage$.next('en');
    fixture.detectChanges();
    expect(legal.getDocument).toHaveBeenCalledWith('tos', 'en');
    expect(text()).toContain('Section en');
  });

  /**
   * @description The notes depend on the document: privacy policy none, terms the privacy link,
   *   cookies both; the cookie button reopens the cookie bar.
   * @input no route data; 'tos'; 'cookies' + click on the button.
   * @output slug 'gdpr' without notes; the privacy link; openSettings called, two notes.
   */
  it('shows the notes of the document', () => {
    create();
    expect(fixture.componentInstance.slug).toBe('gdpr');
    expect(legal.getDocument).toHaveBeenCalledWith('gdpr', 'cz');
    expect(fixture.nativeElement.querySelector('.legal-note')).toBeNull();

    TestBed.resetTestingModule();
    create('tos');
    expect(fixture.nativeElement.querySelectorAll('.legal-note').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.legal-note a').textContent).toBe('Privacy');

    TestBed.resetTestingModule();
    create('cookies');
    const consent = TestBed.inject(CookieConsentService);
    spyOn(consent, 'openSettings');
    (fixture.nativeElement.querySelector('button.legal-link-button') as HTMLButtonElement).click();
    expect(consent.openSettings).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('.legal-note').length).toBe(2);
  });

  /**
   * @description The "effective from" footer uses the page translation with the date; a failed
   *   load is logged and keeps the shown document.
   * @input effective_from_text 'Valid from {date}'; then getDocument errors on the switch to de.
   * @output 'Valid from 1. 1. 2026'; console.error; data of cz kept.
   */
  it('translates the footer and logs a failed load', () => {
    create('cookies');
    ctx.setTranslations({ cookies_policy: { ...texts, effective_from_text: 'Valid from {date}' } });
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(text()).toContain('Valid from 1. 1. 2026');

    spyOn(console, 'error');
    legal.getDocument.and.returnValue(throwError(() => new Error('down')));
    ctx.localization.currentLanguage$.next('de');
    expect(console.error).toHaveBeenCalled();
    expect(fixture.componentInstance.data.footer_effective).toBe('Effective cz');
  });

  /**
   * @description The route builder gives the address, the title of the area and the document.
   * @input legalPageRoute('shop', 'cookies'), legalPageRoute('web', 'gdpr')
   * @output cookies-policy / shop.cookies-policy / data cookies; privacy-policy / web.privacy-policy
   */
  it('builds the routes of the pages', () => {
    const route = legalPageRoute('shop', 'cookies');
    expect([route.path, route.title, route.data]).toEqual(['cookies-policy', 'shop.cookies-policy', { [LEGAL_DOCUMENT_DATA]: 'cookies' }]);
    expect(route.loadComponent).toEqual(jasmine.any(Function));
    const gdpr = legalPageRoute('web', 'gdpr');
    expect([gdpr.path, gdpr.title]).toEqual(['privacy-policy', 'web.privacy-policy']);
  });
});
