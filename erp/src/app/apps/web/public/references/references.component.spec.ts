/**
 * @file references.component.spec.ts
 * @path src/app/apps/web/public/references/references.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ReferencesComponent: project cards from public/web/references in the
 *   current language (missing text placeholder, optional fields hidden, plain text), the image
 *   layout (one column of key features + image) and expanding a card (kept over a language
 *   switch).
 * @dependencies
 * - createPublicPageContext (translations, language, PublicDataService stub).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ReferencesComponent } from './references.component';
import { PublicPageContext, createPublicPageContext } from '../../../../../testing/public-test-helpers';

describe('ReferencesComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<ReferencesComponent>;
  const projects = { header_1: 'References', label_category: 'Category', label_features: 'Key features' };
  /** References of public/web/references. */
  const REFERENCES = [
    { id: 4, category: { cz: 'Webový vývoj', en: 'Web development' }, duration: '2025', client: 'A s.r.o.', image: 'references/4-abc.webp',
      name: { cz: 'Alfa', en: 'Alpha' }, size: { cz: 'Na míru' }, role: {}, description: { cz: 'Řádek 1\nŘádek <b>2</b>' }, result: {},
      features: [{ cz: 'Košík', en: 'Cart' }, { cz: 'Sklad' }], stack: [{ label: { cz: 'Databáze' }, value: { cz: 'MariaDB' } }] },
    { id: 7, category: {}, duration: null, client: null, image: null,
      name: { cz: 'Beta' }, size: {}, role: {}, description: { cz: 'Popis' }, result: { cz: 'Výsledek' }, features: [{ cz: 'F1' }], stack: [] },
  ];

  beforeEach(() => {
    ctx = createPublicPageContext({ translations: { projects } });
    ctx.publicData.get.and.callFake((endpoint: string) => of(endpoint === 'public/web/references' ? REFERENCES : {}));
    TestBed.configureTestingModule({ imports: [ReferencesComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(ReferencesComponent);
    fixture.detectChanges();
  });

  /**
   * @description Projects in the order of the API and the current language (cz): optional fields
   *   empty everywhere are null, the description is plain text, the image a storage URL.
   * @input Two references.
   * @output [Alfa, Beta] collapsed; category 'Webový vývoj' / null; size 'Na míru' / null; role
   *   null; result null / 'Výsledek';
   *   image '/storage/references/4-abc.webp' / null; client rendered; description shown as text.
   */
  it('builds the project cards of the current language', () => {
    const list = fixture.componentInstance.projects;
    expect(ctx.publicData.get).toHaveBeenCalledWith('public/web/references');
    expect(list.map(p => [p.id, p.name, p.isActive])).toEqual([[4, 'Alfa', false], [7, 'Beta', false]]);
    expect(list.map(p => [p.category, p.size, p.role, p.result])).toEqual([['Webový vývoj', 'Na míru', null, null], [null, null, null, 'Výsledek']]);
    expect(list.map(p => p.image)).toEqual(['/storage/references/4-abc.webp', null]);
    expect(list[0].stack).toEqual([{ label: 'Databáze', value: 'MariaDB' }]);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('A s.r.o.');
    const description = el.querySelector('.ref-description') as HTMLElement;
    expect(description.textContent).toBe('Řádek 1\nŘádek <b>2</b>');
    expect(description.querySelector('b')).toBeNull();
  });

  /**
   * @description A project with an image shows its key features in one column next to the image;
   *   one without keeps the two-column list.
   * @input Alfa (image), Beta (no image).
   * @output Alfa: .ref-showcase--image with the image (alt = name, lazy); Beta: no image layout.
   */
  it('shows the image next to the key features', () => {
    const items = fixture.nativeElement.querySelectorAll('.ref-item') as NodeListOf<HTMLElement>;
    const image = items[0].querySelector('.ref-showcase--image .ref-image img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('/storage/references/4-abc.webp');
    expect(image.alt).toBe('Alfa');
    expect(image.getAttribute('loading')).toBe('lazy');
    expect(items[1].querySelector('.ref-showcase--image')).toBeNull();
    expect(items[1].querySelectorAll('.ref-features li').length).toBe(1);
  });

  /**
   * @description Another language: its texts, 'Cannot load text' where missing; an expanded card
   *   stays expanded.
   * @input Expand Alfa; switch to en.
   * @output names [Alpha, Cannot load text]; category 'Web development'; features [Cart, Cannot
   *   load text]; Alfa still open.
   */
  it('follows the language and keeps the expanded cards', () => {
    const component = fixture.componentInstance;
    component.toggleProject(component.projects[0]);
    ctx.localization.currentLanguage$.next('en');
    fixture.detectChanges();
    expect(component.projects.map(p => p.name)).toEqual(['Alpha', 'Cannot load text']);
    expect(component.projects[0].category).toBe('Web development');
    expect(component.projects[0].features).toEqual(['Cart', 'Cannot load text']);
    expect(component.projects.map(p => p.isActive)).toEqual([true, false]);
  });

  /**
   * @description Toggling a card expands / collapses it; the category row is shown only when the
   *   project has one.
   * @input toggleProject twice; expand both cards.
   * @output true → false; category row in Alfa ('Webový vývoj'), none in Beta.
   */
  it('toggles cards and shows the category only when set', () => {
    const component = fixture.componentInstance;
    const beta = component.projects[1];
    component.toggleProject(beta);
    expect(beta.isActive).toBeTrue();
    component.toggleProject(beta);
    expect(beta.isActive).toBeFalse();

    const items = fixture.nativeElement.querySelectorAll('.ref-item') as NodeListOf<HTMLElement>;
    const rows = (item: HTMLElement) => Array.from(item.querySelectorAll('dt')).map(dt => dt.textContent?.trim());
    expect(rows(items[0])).toContain('Category');
    expect(items[0].textContent).toContain('Webový vývoj');
    expect(rows(items[1])).not.toContain('Category');
  });
});
