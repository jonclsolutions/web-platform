/**
 * @file portal-files.component.spec.ts
 * @path src/app/apps/project-portal/public/sections/files/portal-files.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PortalFilesComponent: files loaded fresh when the section opens and
 *   after a refresh (signed links), listed with author and source; the source opens (a thread in
 *   Communication - also one no longer in the list, an update, an approval); a failed load.
 * @dependencies ../../portal.testing (stubs, sample data); fakeAsync for timers.
 */

import { TestBed, discardPeriodicTasks, fakeAsync } from '@angular/core/testing';
import { failWith, setUpPortal, testFiles } from '../../portal.testing';
import { PortalFilesComponent } from './portal-files.component';

describe('PortalFilesComponent', () => {
  /**
   * @description Files: loaded on open and on refresh; rows; source labels; opening the source; error.
   * @input files section; refreshed$; files of a thread (2, 9), an update, an approval; failing load.
   * @output GET …/files twice; 2 rows with 'Jana Nová'; labels 'Hosting' / 'file_source_update: Week 2' /
   *   'file_source_approval: Homepage'; requested thread 2 / stub 9 + Communication; Updates; Approvals; 'files_error'.
   */
  it('lists the files and opens their source', fakeAsync(() => {
    const ctx = setUpPortal({ imports: [PortalFilesComponent] });
    const fixture = TestBed.createComponent(PortalFilesComponent);
    const view = fixture.componentInstance;
    fixture.detectChanges();
    ctx.session.refreshed$.next();
    expect(ctx.get.calls.allArgs().filter((a: any[]) => a[0] === 'projects/public/tok/files').length).toBe(2);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pp-file-row').length).toBe(2);
    expect(el.querySelector('.pp-file-row')!.textContent).toContain('Jana Nová');
    expect(el.querySelector('.pp-file-row')!.textContent).toContain('2 KB');

    const [inThread, gone] = ctx.session.files();
    const fromUpdate = { ...testFiles()[0], source: 'update' as const, source_title: 'Week 2', thread_id: null, thread_subject: null };
    const fromApproval = { ...testFiles()[0], source: 'approval' as const, source_title: 'Homepage', thread_id: null, thread_subject: null };
    expect(view.fileSourceLabel(inThread)).toBe('Hosting');
    expect(view.fileSourceLabel(fromUpdate)).toBe('file_source_update: Week 2');
    expect(view.fileSourceLabel(fromApproval)).toBe('file_source_approval: Homepage');

    (el.querySelector('.pp-file-row .pp-link') as HTMLButtonElement).click();
    expect(ctx.session.requestedThread()!.id).toBe(2);
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects', 'tok', 'threads']);
    view.openFileThread(gone);
    expect(ctx.session.requestedThread()).toEqual(jasmine.objectContaining({ id: 9, subject: 'Gone' }));
    view.openFileThread(fromUpdate);
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects', 'tok', 'updates']);
    view.openFileThread(fromApproval);
    expect(ctx.navigate).toHaveBeenCalledWith(['/projects', 'tok', 'approvals']);

    ctx.replies['/tok/files'] = failWith(500);
    ctx.session.loadFiles();
    fixture.detectChanges();
    expect(el.textContent).toContain('files_error');
    fixture.destroy();
    discardPeriodicTasks();
  }));
});
