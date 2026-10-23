/**
 * @file services.component.spec.ts
 * @path src/app/public/web-pages/services/services.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ServicesComponent: feature cards built from the translations, the pricing
 *   matrix (packages, features, cell types), tooltips and the workflow steps.
 * @dependencies
 * - createPublicPageContext.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServicesComponent } from './services.component';
import { PublicPageContext, createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('ServicesComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<ServicesComponent>;
  const services = {
    cards: { custom_title: 'Custom', custom_text: 'Built for you', support_title: 'Support' },
    pricing: {
      note: 'Prices without VAT',
      packages: [{ id: 'basic', name: 'Basic' }, { id: 'pro', name: 'Pro', highlight: true, description: 'Most used' }],
      features: [{ key: 'seo', label: 'SEO', tooltip: 'Search engines', values: { basic: false, pro: true } }, { key: 'pages', label: 'Pages', values: { basic: '5', pro: null } }]
    },
    colab: { item_1: 'Call', item_2: 'Offer' }
  };

  beforeEach(() => {
    ctx = createPublicPageContext({ translations: { services } });
    TestBed.configureTestingModule({ imports: [ServicesComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(ServicesComponent);
    fixture.detectChanges();
  });

  /**
   * @description Eight cards in a fixed order with translated title / text ('' when missing);
   *   pricing and workflow rendered.
   * @input Translations above.
   * @output keys custom … support; 'Custom' / 'Built for you'; missing texts ''; 'Most used', 'Call' rendered.
   */
  it('builds the feature cards and renders pricing', () => {
    const page = fixture.componentInstance;
    expect(page.featureCards.map(c => c.key)).toEqual(['custom', 'auth', 'seo', 'hosting', 'integrations', 'security', 'admin', 'support']);
    expect([page.featureCards[0].title, page.featureCards[0].text]).toEqual(['Custom', 'Built for you']);
    expect([page.featureCards[1].title, page.featureCards[1].text]).toEqual(['', '']);
    expect(page.pricingPackages.length).toBe(2);
    expect(page.pricingFeatures.length).toBe(2);
    expect(page.workflowSteps.slice(0, 3)).toEqual(['Call', 'Offer', undefined]);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Most used');
    expect(text).toContain('Prices without VAT');
  });

  /**
   * @description Cell types: true → yes, false / null / undefined → no, text → text; tooltip
   *   toggles per row; without translations pricing is empty.
   * @input featureCellType(true/false/null/undefined/'5'); toggleTooltip('seo') ×2 and 'pages'; t null.
   * @output yes, no, no, no, text; 'seo' → null → 'pages'; [] / [].
   */
  it('classifies pricing cells and toggles tooltips', () => {
    const page = fixture.componentInstance;
    expect([true, false, null, undefined, '5'].map(v => page.featureCellType(v))).toEqual(['yes', 'no', 'no', 'no', 'text']);
    page.toggleTooltip('seo');
    expect(page.activeTooltipKey).toBe('seo');
    page.toggleTooltip('seo');
    expect(page.activeTooltipKey).toBeNull();
    page.toggleTooltip('pages');
    expect(page.activeTooltipKey).toBe('pages');

    page.t = null;
    expect(page.pricingPackages).toEqual([]);
    expect(page.pricingFeatures).toEqual([]);
  });
});
