/**
 * @file project-updates-section.component.spec.ts
 * @path src/app/admin/web-pages/project-detail/project-updates-section.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ProjectUpdatesSectionComponent (sub-page "Updates" of a project):
 *   loading drafts and published updates, writing a draft or publishing at once (multipart with
 *   files, the number of client e-mails reported), editing, publishing / taking back a draft and
 *   deleting after a confirmation, read-only mode.
 * @dependencies testing/admin-test-helpers (DataHandler, i18n, alert, confirm, upload rules doubles)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ProjectUpdate, ProjectUpdatesSectionComponent } from './project-updates-section.component';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';

describe('ProjectUpdatesSectionComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ProjectUpdatesSectionComponent>;
  let component: ProjectUpdatesSectionComponent;
  const dh = () => ctx.dataHandler as any;

  const updates = (): ProjectUpdate[] => [
    { id: 2, title: 'Week 2', body: 'Design done', author_label: 'Petr', is_published: true, published_at: '2026-11-11 09:00:00', attachments: [], created_at: '2026-11-11 08:00:00' },
    { id: 1, title: 'Draft', body: 'Soon', author_label: 'Petr', is_published: false, published_at: null, attachments: [{ id: 5, original_filename: 'plan.pdf', size_bytes: 1024, download_url: 'https://x/5' }], created_at: '2026-11-10 08:00:00' },
  ];

  beforeEach(async () => {
    ctx = createAdminTestContext();
    dh().getCollection.and.returnValue(of(updates()));
    await TestBed.configureTestingModule({ imports: [ProjectUpdatesSectionComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(ProjectUpdatesSectionComponent);
    component = fixture.componentInstance;
    component.projectId = 7;
    component.canEdit = true;
  });

  afterEach(() => fixture.destroy());

  /**
   * @description Drafts and published updates load on init and render.
   * @input  2 updates (published, draft)
   * @output getCollection('web/projects/7/updates'); 2 items; the file of the draft listed
   */
  it('loads the updates', () => {
    fixture.detectChanges();
    expect(dh().getCollection).toHaveBeenCalledWith('web/projects/7/updates');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.ps-item').length).toBe(2);
    expect(el.textContent).toContain('plan.pdf');
  });

  /**
   * @description A new update is a draft (publish 0) or published at once (publish 1, the number of
   *   client e-mails reported); title and text are required; editing sends no publish flag unless
   *   publishing; a failure keeps the form.
   * @input  save(true) empty; draft 'Week 3'; published 'Week 4' (notified 2); edit Draft; failure
   * @output post FormData publish '0' / '1'; alert 'update_published_message' once; edit URL …/updates/1 without publish
   */
  it('writes drafts and publishes updates', () => {
    fixture.detectChanges();
    const changed = spyOn(component.changed, 'emit');
    component.openAdd();
    component.save(true);
    expect(dh().postWithMeta).not.toHaveBeenCalled();

    component.draft = { title: ' Week 3 ', body: ' Testing ' };
    component.files = [new File(['x'], 'shot.png')];
    dh().postWithMeta.and.returnValue(of({ data: { ...updates()[1], id: 3, title: 'Week 3' }, meta: { notified: 0 } }));
    component.save(false);
    let [url, form] = dh().postWithMeta.calls.mostRecent().args as [string, FormData];
    expect(url).toBe('web/projects/7/updates');
    expect([form.get('title'), form.get('body'), form.get('publish')]).toEqual(['Week 3', 'Testing', '0']);
    expect(form.getAll('attachments[]').length).toBe(1);
    expect(ctx.alert.open).not.toHaveBeenCalled();
    expect(component.updates[0].id).toBe(3);

    component.openAdd();
    component.draft = { title: 'Week 4', body: 'Live' };
    dh().postWithMeta.and.returnValue(of({ data: { ...updates()[0], id: 4, title: 'Week 4' }, meta: { notified: 2 } }));
    component.save(true);
    expect((dh().postWithMeta.calls.mostRecent().args[1] as FormData).get('publish')).toBe('1');
    expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'projects.update_published_message', 'success');
    expect(changed).toHaveBeenCalledTimes(2);

    component.openEdit(component.updates.find(u => u.id === 1)!);
    expect(component.draft).toEqual({ title: 'Draft', body: 'Soon' });
    expect(component.editing?.id).toBe(1);
    component.toggleRemove(5);
    dh().postWithMeta.and.returnValue(of({ data: { ...updates()[1], body: 'Later', attachments: [] }, meta: { notified: 0 } }));
    component.draft.body = 'Later';
    component.save(false);
    [url, form] = dh().postWithMeta.calls.mostRecent().args as [string, FormData];
    expect(url).toBe('web/projects/7/updates/1');
    expect(form.get('publish')).toBeNull();
    expect(form.getAll('remove_attachment_ids[]')).toEqual(['5']);

    component.openAdd();
    component.draft = { title: 'X', body: 'Y' };
    dh().postWithMeta.and.returnValue(throwError(() => new Error('422')));
    component.save(false);
    expect(component.formMode).toBe('add');
    expect(component.saving).toBeFalse();
  });

  /**
   * @description Publishing a draft / taking an update back and deleting ask first; read-only does nothing.
   * @input  publish Draft (declined, confirmed, notified 1); unpublish Week 2; delete Week 2; canEdit false
   * @output postWithMeta('…/updates/1', { publish: true }); success alert; { publish: false } without alert;
   *   delete('…/updates/2'); nothing read-only
   */
  it('publishes, takes back and deletes after a confirmation', async () => {
    fixture.detectChanges();
    ctx.confirm.open.and.returnValue(Promise.resolve(false));
    await component.setPublished(component.updates[1], true);
    expect(dh().postWithMeta).not.toHaveBeenCalled();

    ctx.confirm.open.and.returnValue(Promise.resolve(true));
    dh().postWithMeta.and.returnValue(of({ data: { ...updates()[1], is_published: true }, meta: { notified: 1 } }));
    await component.setPublished(component.updates[1], true);
    expect(dh().postWithMeta).toHaveBeenCalledWith('web/projects/7/updates/1', { publish: true });
    expect(component.updates[1].is_published).toBeTrue();
    expect(ctx.alert.open).toHaveBeenCalledTimes(1);
    dh().postWithMeta.and.returnValue(of({ data: { ...updates()[0], is_published: false }, meta: { notified: 0 } }));
    await component.setPublished(component.updates[0], false);
    expect(dh().postWithMeta).toHaveBeenCalledWith('web/projects/7/updates/2', { publish: false });
    expect(ctx.alert.open).toHaveBeenCalledTimes(1);

    dh().delete.and.returnValue(of(null));
    await component.remove(component.updates[0]);
    expect(dh().delete).toHaveBeenCalledWith('web/projects/7/updates/2');
    expect(component.updates.map(u => u.id)).toEqual([1]);

    dh().delete.and.returnValue(throwError(() => new Error('x')));
    await component.remove(component.updates[0]);
    expect(component.busyId).toBeNull();
    component.canEdit = false;
    dh().delete.calls.reset();
    await component.remove(component.updates[0]);
    await component.setPublished(component.updates[0], true);
    expect(dh().delete).not.toHaveBeenCalled();
  });
});
