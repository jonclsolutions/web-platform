/**
 * @file faq.component.spec.ts
 * @path src/app/public/web-pages/faq/faq.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of FaqComponent: categories and their questions from the translations, the
 *   default category, switching categories (answers collapsed again) and expanding a question.
 * @dependencies
 * - createPublicPageContext (translations + site settings).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FaqComponent } from './faq.component';
import { PublicPageContext, createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('FaqComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<FaqComponent>;
  const faq = {
    header_1: 'FAQ', empty_state_text: 'No questions',
    categories: { obecne: 'General', ceny: 'Prices', prazdna: 'Empty' },
    items: { obecne: [{ question: 'Q1?', answer: 'A1' }, { question: 'Q2?', answer: 'A2' }], ceny: [{ question: 'Price?', answer: '100' }] }
  };

  beforeEach(() => {
    ctx = createPublicPageContext({ translations: { faq }, settings: { settings: { contact_email: 'info@x.cz', contact_phone: '1', address: 'Praha' } } });
    TestBed.configureTestingModule({ imports: [FaqComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(FaqComponent);
    fixture.detectChanges();
  });

  /**
   * @description Categories listed; the default 'obecne' is shown with collapsed questions.
   * @input Translations with three categories.
   * @output categories General / Prices / Empty; Q1?, Q2? rendered; all inactive; contact rendered.
   */
  it('shows the categories and the default questions', () => {
    const component = fixture.componentInstance;
    expect(component.categories).toEqual([{ id: 'obecne', label: 'General' }, { id: 'ceny', label: 'Prices' }, { id: 'prazdna', label: 'Empty' }]);
    expect(component.filteredItems.map(i => [i.question, i.isActive])).toEqual([['Q1?', false], ['Q2?', false]]);
    expect(fixture.nativeElement.textContent).toContain('Q2?');
    expect(fixture.nativeElement.textContent).toContain('info@x.cz');
  });

  /**
   * @description Expanding a question, switching category (fresh collapsed items), an empty
   *   category and missing translations.
   * @input toggleFaq(Q1); setCategory('ceny'); setCategory('obecne'); setCategory('prazdna'); t without parts.
   * @output Q1 active; ['Price?']; Q1 collapsed again; [] + empty text; categories [] and no items.
   */
  it('switches categories and toggles answers', () => {
    const component = fixture.componentInstance;
    component.toggleFaq(component.filteredItems[0]);
    expect(component.filteredItems[0].isActive).toBeTrue();

    component.setCategory('ceny');
    expect(component.filteredItems.map(i => i.question)).toEqual(['Price?']);
    component.setCategory('obecne');
    expect(component.filteredItems[0].isActive).toBeFalse();

    component.setCategory('prazdna');
    fixture.detectChanges();
    expect(component.filteredItems).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No questions');

    ctx.setTranslations({ faq: { header_1: 'FAQ' } });
    expect(component.categories).toEqual([]);
    expect(component.filteredItems).toEqual([]);
  });
});
