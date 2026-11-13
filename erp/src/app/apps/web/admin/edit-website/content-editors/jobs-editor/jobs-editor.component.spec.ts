/**
 * @file jobs-editor.component.spec.ts
 * @path src/app/apps/web/admin/edit-website/content-editors/jobs-editor/jobs-editor.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of JobsEditorComponent: loading the positions, missing translations
 *   (optional fields only when filled in another language), the URL made from the title, URL
 *   validation (invalid / duplicate - not saved), adding / reordering / removing positions and
 *   blocks and saving all positions.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler / permission / i18n / alert stubs).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { JobsEditorComponent } from './jobs-editor.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../../../testing/admin-test-helpers';

describe('JobsEditorComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<JobsEditorComponent>;
  let component: JobsEditorComponent;

  const languages = [{ code: 'cz', name: 'Čeština', active: true }, { code: 'en', name: 'English', active: true }];
  const rows = () => [
    { id: 1, slug: 'ui-designer', is_active: true,
      title_i18n: { cz: 'UI designer', en: 'UI designer' }, summary_i18n: { cz: 'Design', en: 'Design' },
      type_i18n: { cz: 'Plný úvazek' }, location_i18n: {},
      sections: [{ id: 5, heading_i18n: {}, body_i18n: { cz: 'Úvod', en: 'Intro' } }, { id: 6, heading_i18n: { cz: 'Úkoly:' }, body_i18n: { cz: '• a', en: '• a' } }] },
    { id: 2, slug: 'sales-rep', is_active: false, title_i18n: { cz: 'Obchodník' }, summary_i18n: { cz: 'Prodej' }, type_i18n: {}, location_i18n: {}, sections: [] },
  ];

  /** Creates the editor with the default answers of the API. */
  const create = () => {
    (ctx.dataHandler as any).get.and.callFake((url: string) => of(url === 'languages/web' ? languages : rows()));
    fixture = TestBed.createComponent(JobsEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [JobsEditorComponent], providers: ctx.providers }).compileComponents();
    create();
  });

  afterEach(() => fixture?.destroy());

  /**
   * @description Loads web/jobs; positions collapsed with their URL and status; every text with
   *   every language.
   * @input Two positions (second hidden).
   * @output get('web/jobs'); open [false, false]; status texts; location { cz: '', en: '' }.
   */
  it('loads the positions', () => {
    expect((ctx.dataHandler as any).get).toHaveBeenCalledWith('web/jobs');
    expect(component.entries.map(j => [j.slug, j.is_active, j.open])).toEqual([['ui-designer', true, false], ['sales-rep', false, false]]);
    expect(component.entries[0].location_i18n).toEqual({ cz: '', en: '' });
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('/jobs/ui-designer');
    expect(text).toContain('web-content-editor.jobs_status_hidden');
  });

  /**
   * @description Missing translations: required texts always, optional ones (type, location,
   *   heading) only when filled in another language.
   * @input en: type filled in cz only, heading in cz only, sales-rep without en texts.
   * @output cz 0; en 4 (type, heading, sales-rep title + summary); per position [2, 2].
   */
  it('counts missing translations of optional fields only when used', () => {
    expect(component.missingCount('cz')).toBe(0);
    expect(component.missingCount('en')).toBe(4);
    component.switchLang('en');
    expect(component.entries.map(j => component.missingIn(j))).toEqual([2, 2]);
  });

  /**
   * @description A new position: expanded, hidden, one empty block; its URL is made from the title
   *   (accents removed) and never overwritten; invalid / duplicate URLs are reported and not saved.
   * @input addJob; title 'Junior vývojář & tester'; blur twice; URL 'Bad URL'; URL 'sales-rep'.
   * @output open, is_active false, 1 block; slug 'junior-vyvojar-tester'; problems for the bad /
   *   duplicate URL; save shows a warning, no PUT.
   */
  it('makes and checks the URL of a new position', () => {
    component.addJob();
    const job = component.entries[2];
    expect([job.open, job.is_active, job.sections.length]).toEqual([true, false, 1]);

    job.title_i18n['cz'] = 'Junior vývojář & tester';
    component.suggestSlug(job);
    expect(job.slug).toBe('junior-vyvojar-tester');
    job.title_i18n['cz'] = 'Other';
    component.suggestSlug(job);
    expect(job.slug).toBe('junior-vyvojar-tester');
    expect(component.slugProblem(job)).toBe('');

    job.slug = 'Bad URL';
    expect(component.slugProblem(job)).toBe('web-content-editor.jobs_slug_invalid');
    component.save();
    expect(ctx.alert.open).toHaveBeenCalledWith('web-content-editor.invalid_title', 'web-content-editor.jobs_slug_invalid', 'warning');

    job.slug = 'sales-rep';
    expect(component.slugProblem(job)).toBe('web-content-editor.jobs_slug_duplicate');
    component.save();
    expect(ctx.alert.open).toHaveBeenCalledWith('web-content-editor.invalid_title', 'web-content-editor.jobs_slug_duplicate', 'warning');
    expect((ctx.dataHandler as any).put).not.toHaveBeenCalled();
  });

  /**
   * @description Blocks are added / reordered / removed, positions reordered; the payload has no
   *   client-only fields.
   * @input Add a block to the first position, move it to the top, remove the old second block,
   *   swap the positions, expand the second one, save.
   * @output PUT web/jobs { jobs: [sales-rep, ui-designer (new block, block 5)] }; saved state;
   *   the expanded position stays expanded.
   */
  it('edits the blocks and saves all positions', () => {
    const first = component.entries[0];
    component.addSection(first);
    component.move(first.sections, 2, -1);
    component.move(first.sections, 1, -1);
    component.remove(first.sections, 2);
    component.move(component.entries, 0, 1);

    component.toggle(component.entries[1]);
    (ctx.dataHandler as any).put.and.returnValue(of(rows()));
    component.save();
    expect(component.entries.map(j => j.open)).toEqual([false, true]);
    const [url, body] = (ctx.dataHandler as any).put.calls.mostRecent().args;
    expect(url).toBe('web/jobs');
    expect(body.jobs.map((j: any) => j.slug)).toEqual(['sales-rep', 'ui-designer']);
    expect(body.jobs[1].sections).toEqual([
      { id: null, heading_i18n: { cz: '', en: '' }, body_i18n: { cz: '', en: '' } },
      { id: 5, heading_i18n: { cz: '', en: '' }, body_i18n: { cz: 'Úvod', en: 'Intro' } },
    ]);
    expect(Object.keys(body.jobs[0])).toEqual(['id', 'slug', 'is_active', 'title_i18n', 'summary_i18n', 'type_i18n', 'location_i18n', 'sections']);
    expect(component.isDirty).toBeFalse();
  });

  /**
   * @description Expanding a position renders its fields; the title falls back to the URL.
   * @input toggle the first position; title of a position without one.
   * @output inputs rendered (URL, title, summary, type, location, 2 × heading / body); title = slug.
   */
  it('expands a position and names it', () => {
    component.toggle(component.entries[0]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.ce-input').length).toBe(9);
    component.entries[1].title_i18n['cz'] = '';
    expect(component.titleOf(component.entries[1])).toBe('sales-rep');
  });
});
