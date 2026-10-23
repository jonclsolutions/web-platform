/**
 * @file references.component.spec.ts
 * @path src/app/public/web-pages/references/references.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ReferencesComponent: project cards built from the `project_*` keys of the
 *   translations (sorted, collapsed), expanding a card and the category legend labels.
 * @dependencies
 * - createPublicPageContext.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReferencesComponent } from './references.component';
import { PublicPageContext, createPublicPageContext } from '../../../../testing/public-test-helpers';

describe('ReferencesComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<ReferencesComponent>;
  const projects = {
    header_1: 'References', legend_web: 'Web', legend_ai: 'AI',
    project_2: { name: 'Beta', category: 'ai', client: 'B s.r.o.', features: ['F1'], stack: [{ label: 'FE', value: 'Angular' }] },
    project_1: { name: 'Alpha', category: 'web' }
  };

  beforeEach(() => {
    ctx = createPublicPageContext({ translations: { projects } });
    TestBed.configureTestingModule({ imports: [ReferencesComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(ReferencesComponent);
    fixture.detectChanges();
  });

  /**
   * @description Only project_* keys become cards, sorted by key, collapsed, with their id.
   * @input project_2 (Beta), project_1 (Alpha), other keys.
   * @output [Alpha, Beta], ids project_1 / project_2, isActive false; names + client rendered.
   */
  it('builds sorted project cards from the translations', () => {
    const list = fixture.componentInstance.projects;
    expect(list.map(p => [p.id, p.name, p.isActive])).toEqual([['project_1', 'Alpha', false], ['project_2', 'Beta', false]]);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Alpha');
    expect(text).toContain('B s.r.o.');
    expect(text).toContain('Angular');
  });

  /**
   * @description Toggling a card expands / collapses it; category labels come from the legend,
   *   unknown categories are shown as they are.
   * @input toggleProject twice; categories web, ai, desktop, other.
   * @output true → false; 'Web', 'AI', 'desktop' (no legend text), 'other'.
   */
  it('toggles cards and labels categories', () => {
    const component = fixture.componentInstance;
    const beta = component.projects[1];
    component.toggleProject(beta);
    expect(beta.isActive).toBeTrue();
    component.toggleProject(beta);
    expect(beta.isActive).toBeFalse();

    expect(component.getCategoryLabel('web')).toBe('Web');
    expect(component.getCategoryLabel('ai')).toBe('AI');
    expect(component.getCategoryLabel('desktop')).toBe('desktop');
    expect(component.getCategoryLabel('other')).toBe('other');
  });
});
