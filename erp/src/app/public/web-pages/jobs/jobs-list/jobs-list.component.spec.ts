/**
 * @file jobs-list.component.spec.ts
 * @path src/app/public/web-pages/jobs/jobs-list/jobs-list.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of JobsListComponent: open positions are read from the numbered `job_N_*`
 *   translation keys (1-10); incomplete entries are skipped.
 * @dependencies
 * - createPublicPageContext.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobsListComponent } from './jobs-list.component';
import { createPublicPageContext } from '../../../../../testing/public-test-helpers';

describe('JobsListComponent', () => {
  let fixture: ComponentFixture<JobsListComponent>;

  /**
   * @description Complete entries 1 and 10 become jobs, entry 2 without description is skipped,
   *   entry 11 is outside the range; the list is rendered with settings present.
   * @input job_1 (complete), job_2 (no short_desc), job_10 (complete), job_11 (complete).
   * @output [dev, ops] with title + shortDescription; both titles rendered.
   */
  it('lists the complete job entries', () => {
    const jobs = {
      list_header_1: 'Jobs',
      job_1_id: 'dev', job_1_title: 'Developer', job_1_short_desc: 'Code',
      job_2_id: 'pm', job_2_title: 'PM',
      job_10_id: 'ops', job_10_title: 'Ops', job_10_short_desc: 'Servers',
      job_11_id: 'x', job_11_title: 'X', job_11_short_desc: 'Y'
    };
    const ctx = createPublicPageContext({ translations: { jobs }, settings: { settings: {} } });
    TestBed.configureTestingModule({ imports: [JobsListComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(JobsListComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.availableJobs).toEqual([
      { id: 'dev', title: 'Developer', shortDescription: 'Code' },
      { id: 'ops', title: 'Ops', shortDescription: 'Servers' }
    ]);
    expect(fixture.nativeElement.textContent).toContain('Developer');
    expect(fixture.nativeElement.textContent).toContain('Servers');
  });
});
