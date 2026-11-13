/**
 * @file faq.component.spec.ts
 * @path src/app/apps/web/public/faq/faq.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of FaqComponent: categories and their questions from the database
 *   (public/web/faq) in the current language ('Cannot load text' when a text is missing), the
 *   first category by default, switching categories (answers collapsed again), expanding a
 *   question, answers as plain text with their lines.
 * @dependencies
 * - createPublicPageContext (translations + site settings, public/web/faq answered by the
 *   PublicDataService stub).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { FaqComponent } from './faq.component';
import { PublicPageContext, createPublicPageContext } from '../../../../../testing/public-test-helpers';

describe('FaqComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<FaqComponent>;
  const faq = { header_1: 'FAQ', empty_state_text: 'No questions' };
  /** FAQ of public/web/faq. */
  const FAQ = [
    { id: 4, name: { cz: 'Obecné', en: 'General' }, items: [
      { id: 10, question: { cz: 'Q1?', en: 'Q1 EN?' }, answer: { cz: 'A1\n• bod <b>x</b>' } },
      { id: 11, question: { cz: 'Q2?' }, answer: { cz: 'A2' } },
    ] },
    { id: 7, name: { cz: 'Ceny' }, items: [{ id: 12, question: { cz: 'Price?' }, answer: { cz: '100' } }] },
    { id: 9, name: { cz: 'Prázdná' }, items: [] },
  ];

  beforeEach(() => {
    ctx = createPublicPageContext({ translations: { faq }, settings: { settings: { contact_email: 'info@x.cz', contact_phone: '1', address: 'Praha' } } });
    ctx.publicData.get.and.callFake((endpoint: string) => of(endpoint === 'public/web/faq' ? FAQ : {}));
    TestBed.configureTestingModule({ imports: [FaqComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();
  });

  /**
   * @description Categories listed; the first one is shown with collapsed questions; the answer is
   *   plain text (no HTML).
   * @input FAQ with three categories.
   * @output categories Obecné / Ceny / Prázdná (ids as strings); Q1?, Q2? rendered; all inactive;
   *   the answer text with "<b>" as text; contact rendered.
   */
  it('shows the categories and the questions of the first one', () => {
    const component = fixture.componentInstance;
    expect(ctx.publicData.get).toHaveBeenCalledOnceWith('public/web/faq');
    expect(component.categories).toEqual([{ id: '4', label: 'Obecné' }, { id: '7', label: 'Ceny' }, { id: '9', label: 'Prázdná' }]);
    expect(component.activeCategory).toBe('4');
    expect(component.filteredItems.map(i => [i.question, i.isActive])).toEqual([['Q1?', false], ['Q2?', false]]);
    expect(fixture.nativeElement.textContent).toContain('Q2?');
    expect(fixture.nativeElement.querySelector('.faq-answer-text').textContent).toBe('A1\n• bod <b>x</b>');
    expect(fixture.nativeElement.querySelector('.faq-answer-text b')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('info@x.cz');
  });

  /**
   * @description Expanding a question, switching category (fresh collapsed items), an empty
   *   category and the language switch (the chosen category stays, missing texts = placeholder).
   * @input toggleFaq(Q1); setCategory('7'); setCategory('4'); setCategory('9'); setCategory('4'); en.
   * @output Q1 active; ['Price?']; Q1 collapsed again; [] + empty text; en: General / Q1 EN? and
   *   'Cannot load text' for the missing texts, category '4' kept.
   */
  it('switches categories, toggles answers and follows the language', () => {
    const component = fixture.componentInstance;
    component.toggleFaq(component.filteredItems[0]);
    expect(component.filteredItems[0].isActive).toBeTrue();

    component.setCategory('7');
    expect(component.filteredItems.map(i => i.question)).toEqual(['Price?']);
    component.setCategory('4');
    expect(component.filteredItems[0].isActive).toBeFalse();

    component.setCategory('9');
    fixture.detectChanges();
    expect(component.filteredItems).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No questions');

    component.setCategory('4');
    ctx.localization.setLanguage('en');
    expect(component.activeCategory).toBe('4');
    expect(component.categories.map(c => c.label)).toEqual(['General', 'Cannot load text', 'Cannot load text']);
    expect(component.filteredItems.map(i => [i.question, i.answer])).toEqual([['Q1 EN?', 'Cannot load text'], ['Cannot load text', 'Cannot load text']]);
  });

  /**
   * @description Open finding #64: both contact sidebars show the phone only when there is one.
   * @input Settings with phone '1'; then settings without a phone.
   * @output tel: links present; then none.
   */
  it('shows the phone rows only with a phone', () => {
    const component = fixture.componentInstance as any;
    expect(fixture.nativeElement.querySelectorAll('a[href^="tel:"]').length).toBeGreaterThan(0);
    component.settings = { contact_email: 'info@x.cz', contact_phone: null };
    component.cdr.markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('a[href^="tel:"]').length).toBe(0);
  });
});
