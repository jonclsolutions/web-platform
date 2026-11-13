/**
 * @file jobs-list.component.spec.ts
 * @path src/app/apps/web/public/jobs/jobs-list/jobs-list.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of JobsListComponent: the open positions come from the database
 *   (public/web/jobs) in the current language; a text missing in it shows 'Cannot load text'; a
 *   failed request gives an empty list.
 * @dependencies
 * - createPublicPageContext (public/web/jobs answered by the PublicDataService stub).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { JobsListComponent } from './jobs-list.component';
import { PublicPageContext, createPublicPageContext } from '../../../../../../testing/public-test-helpers';

describe('JobsListComponent', () => {
  let ctx: PublicPageContext;
  let fixture: ComponentFixture<JobsListComponent>;

  /** Positions of public/web/jobs. */
  const JOBS = [
    { slug: 'dev', title: { cz: 'Vývojář', en: 'Developer' }, summary: { cz: 'Kód', en: 'Code' }, type: {}, location: {}, sections: [] },
    { slug: 'ops', title: { cz: 'Provoz' }, summary: { cz: 'Servery' }, type: {}, location: {}, sections: [] },
  ];

  /** Creates the page; `answer` = the response of public/web/jobs. */
  function create(answer = of(JOBS as unknown)): void {
    ctx = createPublicPageContext({ translations: { jobs: { list_header_1: 'Jobs' } }, settings: { settings: {} } });
    ctx.publicData.get.and.returnValue(answer);
    TestBed.configureTestingModule({ imports: [JobsListComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(JobsListComponent);
    fixture.detectChanges();
  }

  /**
   * @description The positions are listed in their order in the current language and follow a
   *   language switch; a missing text shows the placeholder.
   * @input Two positions (cz complete, en only for the first); switch to en.
   * @output cz titles / descriptions rendered with their links; en: Developer / Code, then
   *   'Cannot load text' for the second.
   */
  it('lists the positions in the current language', () => {
    create();
    expect(ctx.publicData.get).toHaveBeenCalledOnceWith('public/web/jobs');
    expect(fixture.componentInstance.availableJobs).toEqual([
      { id: 'dev', title: 'Vývojář', shortDescription: 'Kód' },
      { id: 'ops', title: 'Provoz', shortDescription: 'Servery' },
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Servery');
    expect(fixture.nativeElement.querySelector('a.job-card')?.getAttribute('href')).toBe('/jobs/dev');

    ctx.localization.setLanguage('en');
    expect(fixture.componentInstance.availableJobs).toEqual([
      { id: 'dev', title: 'Developer', shortDescription: 'Code' },
      { id: 'ops', title: 'Cannot load text', shortDescription: 'Cannot load text' },
    ]);
  });

  /**
   * @description A failed request leaves the list empty (the page still renders).
   * @input public/web/jobs fails.
   * @output availableJobs [].
   */
  it('shows no positions when they cannot be loaded', () => {
    create(throwError(() => new Error('down')));
    expect(fixture.componentInstance.availableJobs).toEqual([]);
  });
});
