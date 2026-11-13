/**
 * @file project-approvals-section.component.spec.ts
 * @path src/app/apps/project-portal/admin/project-detail/project-approvals-section.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ProjectApprovalsSectionComponent (sub-page "Approvals" of a project):
 *   loading and the open / all filter, the form of a new and of a pending request (multipart with
 *   files and removed files), asking again / cancelling / deleting after a confirmation, the
 *   read-only mode and the rendered list with the history of decisions.
 * @dependencies testing/admin-test-helpers (DataHandler, i18n, confirm, upload rules doubles)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ProjectApproval, ProjectApprovalsSectionComponent } from './project-approvals-section.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('ProjectApprovalsSectionComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ProjectApprovalsSectionComponent>;
  let component: ProjectApprovalsSectionComponent;
  const dh = () => ctx.dataHandler as any;

  const approvals = (): ProjectApproval[] => [
    { id: 4, title: 'Homepage', description: 'Final', status: 'pending', due_date: '2026-11-20', checkpoint_id: 1, checkpoint_label: 'Design',
      requested_by_label: 'Petr', requested_at: '2026-11-12 09:00:00', decided_at: null,
      attachments: [{ id: 30, original_filename: 'home.png', size_bytes: 4096, download_url: 'https://x/30' }], decisions: [] },
    { id: 3, title: 'Texts', description: null, status: 'changes_requested', due_date: null, checkpoint_id: null,
      requested_by_label: null, requested_at: '2026-11-08 09:00:00', decided_at: '2026-11-09 09:00:00',
      decisions: [{ id: 1, decision: 'changes_requested', comment: 'Shorter', author_label: 'Jana', created_at: '2026-11-09 09:00:00' }] },
    { id: 2, title: 'Logo', description: null, status: 'approved', due_date: null, checkpoint_id: null,
      requested_by_label: null, requested_at: '2026-11-01 09:00:00', decided_at: '2026-11-02 09:00:00', decisions: [] },
  ];
  const file = (name: string) => new File(['x'], name);

  beforeEach(async () => {
    ctx = createAdminTestContext();
    dh().getCollection.and.returnValue(of(approvals()));
    await TestBed.configureTestingModule({ imports: [ProjectApprovalsSectionComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(ProjectApprovalsSectionComponent);
    component = fixture.componentInstance;
    component.projectId = 7;
    component.canEdit = true;
    component.checkpoints = [{ id: 1, label: 'Design' }];
  });

  afterEach(() => fixture.destroy());

  /**
   * @description The requests load on init; "open" shows waiting + changes requested, "all" every
   *   one; the list renders the state, the files and the history.
   * @input  3 requests (pending, changes requested, approved)
   * @output getCollection('project-portal/projects/7/approvals'); openCount 2; visible 2 / 3; 2 items rendered,
   *   1 decision, the file name
   */
  it('loads the requests and filters the open ones', () => {
    fixture.detectChanges();
    expect(dh().getCollection).toHaveBeenCalledWith('project-portal/projects/7/approvals');
    expect(component.openCount).toBe(2);
    expect(component.visibleApprovals.map(a => a.id)).toEqual([4, 3]);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.ps-item').length).toBe(2);
    expect(el.querySelectorAll('.ps-decision').length).toBe(1);
    expect(el.textContent).toContain('home.png');
    component.filter = 'all';
    expect(component.visibleApprovals.length).toBe(3);
    expect(component.statusLabel('cancelled')).toBe('projects.approval_status_cancelled');
    expect(component.decisionLabel('approved')).toBe('projects.approval_decision_approved');
  });

  /**
   * @description A new request is sent as multipart (title, description, checkpoint, due date,
   *   files) and put first; the parent is told; a title is required; a failure keeps the form.
   * @input  openAdd; title ' Menu '; checkpoint '1'; due '2026-12-01'; file menu.pdf + virus.exe
   * @output post('project-portal/projects/7/approvals', FormData) with those values and 1 file; type error shown;
   *   approval first; form closed; changed emitted
   */
  it('asks for a new approval with files', () => {
    fixture.detectChanges();
    const changed = spyOn(component.changed, 'emit');
    component.openAdd();
    expect(component.formMode).toBe('add');
    component.save();
    expect(dh().post).not.toHaveBeenCalled();

    component.draft = { title: ' Menu ', description: ' Main menu ', checkpoint_id: '1', due_date: '2026-12-01' };
    component.onFilesSelected({ target: { files: [file('menu.pdf'), file('virus.exe')], value: 'x' } } as unknown as Event);
    expect(component.files.map(f => f.name)).toEqual(['menu.pdf']);
    expect(component.fileError).toContain('projects.attachment_error_type');
    dh().post.and.returnValue(of({ ...approvals()[0], id: 9, title: 'Menu' }));
    component.save();
    const [url, form] = dh().post.calls.mostRecent().args as [string, FormData];
    expect(url).toBe('project-portal/projects/7/approvals');
    expect([form.get('title'), form.get('description'), form.get('checkpoint_id'), form.get('due_date')]).toEqual(['Menu', 'Main menu', '1', '2026-12-01']);
    expect(form.getAll('attachments[]').length).toBe(1);
    expect(component.approvals[0].id).toBe(9);
    expect(component.formMode).toBeNull();
    expect(changed).toHaveBeenCalled();

    component.openAdd();
    component.draft.title = 'X';
    dh().post.and.returnValue(throwError(() => new Error('422')));
    component.save();
    expect(component.formMode).toBe('add');
    expect(component.saving).toBeFalse();
  });

  /**
   * @description Only a pending request is edited; saved files can be marked for removal (toggle);
   *   the change goes to the URL of the request and replaces it in the list.
   * @input  openEdit(Texts - changes requested); openEdit(Homepage); toggleRemove(30) twice + once; save
   * @output no form for Texts; draft from Homepage; post('project-portal/projects/7/approvals/4', FormData remove_attachment_ids[] 30)
   */
  it('changes a pending request', () => {
    fixture.detectChanges();
    component.openEdit(component.approvals[1]);
    expect(component.formMode).toBeNull();
    component.openEdit(component.approvals[0]);
    expect(component.draft).toEqual({ title: 'Homepage', description: 'Final', checkpoint_id: '1', due_date: '2026-11-20' });
    expect(component.editing?.id).toBe(4);
    component.toggleRemove(30);
    component.toggleRemove(30);
    expect(component.removeIds.size).toBe(0);
    component.toggleRemove(30);
    dh().post.and.returnValue(of({ ...approvals()[0], title: 'Homepage 2', attachments: [] }));
    component.save();
    const [url, form] = dh().post.calls.mostRecent().args as [string, FormData];
    expect(url).toBe('project-portal/projects/7/approvals/4');
    expect(form.getAll('remove_attachment_ids[]')).toEqual(['30']);
    expect(component.approvals[0].title).toBe('Homepage 2');
    component.openAdd();
    component.files = [file('a.pdf'), file('b.pdf')];
    component.removeFile(0);
    expect(component.files.map(f => f.name)).toEqual(['b.pdf']);
    component.cancelForm();
    expect([component.formMode, component.files.length]).toEqual([null, 0]);
  });

  /**
   * @description Ask again / cancel / delete need a confirmation; the answer replaces (or removes)
   *   the request; a declined confirmation, a running action and read-only do nothing.
   * @input  reopen Texts (declined, then confirmed); cancel Homepage; delete Logo; failure; canEdit false
   * @output post('…/approvals/3/reopen', {}); post('…/approvals/4/cancel', {}); delete('…/approvals/2');
   *   busyId null after a failure; no request read-only
   */
  it('asks again, cancels and deletes after a confirmation', async () => {
    fixture.detectChanges();
    const changed = spyOn(component.changed, 'emit');
    ctx.confirm.open.and.returnValue(Promise.resolve(false));
    await component.act(component.approvals[1], 'reopen');
    expect(dh().post).not.toHaveBeenCalled();
    expect(ctx.confirm.open).toHaveBeenCalledWith('projects.approval_reopen_confirm_title', 'projects.approval_reopen_confirm_message');

    ctx.confirm.open.and.returnValue(Promise.resolve(true));
    dh().post.and.returnValue(of({ ...approvals()[1], status: 'pending' }));
    await component.act(component.approvals[1], 'reopen');
    expect(dh().post).toHaveBeenCalledWith('project-portal/projects/7/approvals/3/reopen', {});
    expect(component.approvals[1].status).toBe('pending');
    dh().post.and.returnValue(of({ ...approvals()[0], status: 'cancelled' }));
    await component.act(component.approvals[0], 'cancel');
    expect(dh().post).toHaveBeenCalledWith('project-portal/projects/7/approvals/4/cancel', {});
    expect(component.approvals[0].status).toBe('cancelled');
    dh().delete.and.returnValue(of(null));
    await component.act(component.approvals[2], 'delete');
    expect(dh().delete).toHaveBeenCalledWith('project-portal/projects/7/approvals/2');
    expect(component.approvals.length).toBe(2);
    expect(changed).toHaveBeenCalledTimes(3);

    dh().post.and.returnValue(throwError(() => new Error('422')));
    await component.act(component.approvals[0], 'reopen');
    expect(component.busyId).toBeNull();
    component.canEdit = false;
    dh().post.calls.reset();
    await component.act(component.approvals[0], 'reopen');
    component.openAdd();
    expect(dh().post).not.toHaveBeenCalled();
    expect(component.formMode).toBeNull();
  });

  /**
   * @description A failed load leaves an empty list and stops loading.
   * @input  getCollection fails
   * @output loading false; no requests
   */
  it('survives a failed load', () => {
    dh().getCollection.and.returnValue(throwError(() => new Error('x')));
    fixture.detectChanges();
    expect(component.loading).toBeFalse();
    expect(component.approvals).toEqual([]);
    expect(component.formatFileSize(2048)).toBe('2 KB');
  });
});
