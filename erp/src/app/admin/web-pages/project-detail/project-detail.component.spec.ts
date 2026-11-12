/**
 * @file project-detail.component.spec.ts
 * @path src/app/admin/web-pages/project-detail/project-detail.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ProjectDetailComponent – the page of one client project
 *   (web/projects/:id): loading / not found, the settings form (dirty state, saving only the
 *   changed fields, discard, read-only without permission), leaving with unsaved changes or an
 *   uncopied one-time password, the password handed over from the list (memory only, VT-08),
 *   copy / regenerate, checkpoints (status dropdown), the conversations of the project (filters, unread counts,
 *   opening marks read, status, replies with validated attachments, older messages, periodic refresh).
 * @dependencies
 * - src/testing/admin-test-helpers.ts (all admin doubles), ActivatedRoute (stub with the id),
 *   Router.navigate (spy), ProjectPasswordHandoffService, navigator.clipboard (spy)
 */

import { ComponentFixture, TestBed, fakeAsync, tick, flush, discardPeriodicTasks } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ProjectDetailComponent, THREAD_REFRESH_SECONDS } from './project-detail.component';
import { ProjectPasswordHandoffService } from '../projects/project-password-handoff.service';
import { AdminTestContext, createAdminTestContext } from '../../../../testing/admin-test-helpers';
import { TEST_UPLOAD_RULES } from '../../../../testing/upload-rules-stub';

describe('ProjectDetailComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ProjectDetailComponent>;
  let component: ProjectDetailComponent;
  let navigate: jasmine.Spy;
  let routeId: string | null;

  const dh = () => ctx.dataHandler as any;
  const project = () => ({
    id: 7, name: 'Shop', description: null, platform: 'web', project_lead: 'Jan', contact_phone: null, contact_email: null,
    technologies: null, estimated_completion_from: '2026-12-01', estimated_completion_to: null, visibility: 'private',
    status: 'development', public_url: 'https://x/p/7', created_at: '2026-11-01 10:00:00', unread_messages_count: 3,
    checkpoints: [{ id: 1, label: 'Design', status: 'new', sort_order: 1 }]
  });
  const threads = () => [
    { id: 3, subject: 'Launch', priority: 'high', status: 'active', last_message_at: '2026-11-10 09:00:00', admin_unread_count: 2 },
    { id: 4, subject: 'Hosting', priority: 'low', status: 'closed', last_message_at: null, admin_unread_count: 1 },
    { id: 5, subject: 'Logo', priority: 'medium', status: 'active', last_message_at: null, admin_unread_count: 0 }
  ];
  const file = (name: string, size = 10) => {
    const f = new File(['x'], name);
    Object.defineProperty(f, 'size', { value: size });
    return f;
  };
  const fileEvent = (...files: File[]) => {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    const input = document.createElement('input');
    input.type = 'file';
    input.files = dt.files;
    return { target: input } as unknown as Event;
  };
  /** Message list element whose scrollTop assignments are recorded. */
  const scrollList = (scrollHeight: number) => {
    const el = document.createElement('div');
    const sets: number[] = [];
    Object.defineProperty(el, 'scrollHeight', { value: scrollHeight });
    Object.defineProperty(el, 'scrollTop', { get: () => sets[sets.length - 1] ?? 0, set: (v: number) => sets.push(v) });
    return { el, sets };
  };
  /** Creates the page (ngOnInit runs) and leaves the polling to the caller's fakeAsync zone. */
  const init = () => { fixture.detectChanges(); };

  beforeEach(async () => {
    routeId = '7';
    ctx = createAdminTestContext();
    dh().get.and.callFake(() => of(project()));
    dh().getCollection.and.callFake(() => of(threads()));
    await TestBed.configureTestingModule({
      imports: [ProjectDetailComponent],
      // The id is read when ngOnInit runs, so a test can change routeId before init().
      providers: [...ctx.providers, {
        provide: ActivatedRoute,
        useValue: { snapshot: { get paramMap() { return convertToParamMap(routeId ? { id: routeId } : {}); } } }
      }]
    }).compileComponents();
    fixture = TestBed.createComponent(ProjectDetailComponent);
    component = fixture.componentInstance;
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
  });

  afterEach(() => fixture.destroy());

  describe('loading', () => {
    /**
     * @description The page loads the project, its settings form (edit fields without the order
     *   link), checkpoints and the threads of THIS project with their unread counts.
     * @input  route id 7
     * @output get('web/projects/7'); getCollection('web/project-threads', { project_id: 7, no_pagination });
     *   form name 'Shop' / description ''; fields without order_id; 1 checkpoint; unreadTotal 3; not dirty
     */
    it('loads the project and its conversations', fakeAsync(() => {
      init();
      expect(dh().get).toHaveBeenCalledWith('web/projects/7');
      expect(dh().getCollection).toHaveBeenCalledWith('web/project-threads', { project_id: 7, no_pagination: 'true' });
      expect(component.loading).toBeFalse();
      expect(component.notFound).toBeFalse();
      expect(component.form['name']).toBe('Shop');
      expect(component.form['description']).toBe('');
      expect(component.fields.map(f => f.column_name)).not.toContain('order_id');
      expect(component.fields.length).toBe(11);
      expect(component.checkpoints.length).toBe(1);
      expect(component.checkpointStatusLabels['done']).toBe('projects.checkpoint_status_done');
      expect(component.unreadTotal).toBe(3);
      expect(component.dirty).toBeFalse();
      expect(component.attachmentRules as unknown).toEqual(TEST_UPLOAD_RULES.project_thread);
      discardPeriodicTasks();
    }));

    /**
     * @description An invalid id or a failed load shows "not found".
     * @input  route id 'abc'; then the API failing for id 7
     * @output notFound without any request; notFound after the failure
     */
    it('shows not found for a wrong id or a failed load', fakeAsync(() => {
      routeId = 'abc';
      init();
      expect(component.notFound).toBeTrue();
      expect(dh().get).not.toHaveBeenCalled();
      fixture.destroy();

      routeId = '7';
      dh().get.and.returnValue(throwError(() => ({ status: 404 })));
      fixture = TestBed.createComponent(ProjectDetailComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.notFound).toBeTrue();
      expect(component.loading).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description The conversations refresh every minute silently and the open thread keeps its messages.
     * @input  thread 3 open with messages; the API closes thread 3; THREAD_REFRESH_SECONDS pass
     * @output getCollection called again; threadsLoading stays false; selectedThread status 'closed', messages kept
     */
    it('refreshes the conversations periodically', fakeAsync(() => {
      init();
      component.selectedThread = { ...threads()[0], messages: [{ id: 1 } as any] };
      dh().getCollection.calls.reset();
      dh().getCollection.and.returnValue(of([{ ...threads()[0], status: 'closed' }]));
      tick(THREAD_REFRESH_SECONDS * 1000);
      expect(dh().getCollection).toHaveBeenCalledTimes(1);
      expect(component.threadsLoading).toBeFalse();
      expect(component.selectedThread!.status).toBe('closed');
      expect(component.selectedThread!.messages!.length).toBe(1);
      dh().getCollection.and.returnValue(throwError(() => new Error('x')));
      component.loadThreads();
      expect(component.threadsLoading).toBeFalse();
      discardPeriodicTasks();
    }));
  });

  describe('settings', () => {
    /**
     * @description Saving sends only the changed fields (cleared text as null) and resets the dirty state.
     * @input  name 'Shop 2', project_lead '' ; saveSettings(); API answers the updated project
     * @output put('web/projects/7', { name: 'Shop 2', project_lead: null }); success alert; dirty false; saving false
     */
    it('saves the changed settings', fakeAsync(() => {
      init();
      component.form['name'] = 'Shop 2';
      component.form['project_lead'] = '  ';
      expect(component.dirty).toBeTrue();
      dh().put.and.returnValue(of({ ...project(), name: 'Shop 2', project_lead: null, checkpoints: undefined }));
      component.saveSettings();
      expect(dh().put).toHaveBeenCalledWith('web/projects/7', { name: 'Shop 2', project_lead: null });
      expect(ctx.alert.open).toHaveBeenCalledWith('shared.success', 'projects.project_updated_message', 'success');
      expect(component.dirty).toBeFalse();
      expect(component.saving).toBeFalse();
      expect(component.checkpoints.length).toBe(1);
      discardPeriodicTasks();
    }));

    /**
     * @description Nothing is sent without changes, while saving, with an empty required field or
     *   without permission; a failed save keeps the changes.
     * @input  the guard states; then put failing
     * @output put only for the failing call; dirty stays true; saving false
     */
    it('guards saving', fakeAsync(() => {
      init();
      component.saveSettings();
      component.form['name'] = '  ';
      component.saveSettings();
      component.form['name'] = 'X';
      component.saving = true;
      component.saveSettings();
      component.saving = false;
      ctx.permissions.granted = new Set();
      component.saveSettings();
      expect(dh().put).not.toHaveBeenCalled();
      ctx.permissions.granted = 'all';
      dh().put.and.returnValue(throwError(() => new Error('x')));
      component.saveSettings();
      expect(dh().put).toHaveBeenCalledTimes(1);
      expect(component.dirty).toBeTrue();
      expect(component.saving).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description Discarding restores the saved values.
     * @input  name changed; discardChanges()
     * @output name 'Shop'; dirty false
     */
    it('discards the changes', fakeAsync(() => {
      init();
      component.form['name'] = 'Other';
      component.discardChanges();
      expect(component.form['name']).toBe('Shop');
      expect(component.dirty).toBeFalse();
      discardPeriodicTasks();
    }));
  });

  describe('leaving the page', () => {
    /**
     * @description Back asks first with unsaved settings; cancel stays, confirm leaves to the list.
     * @input  dirty form; confirm false, then true; then clean form
     * @output confirm('projects.detail_unsaved_title', …); no navigation after cancel; navigate(['/admin/web/projects']);
     *   clean form leaves without asking
     */
    it('asks before leaving with unsaved settings', fakeAsync(async () => {
      init();
      component.form['name'] = 'Other';
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.goBack();
      expect(ctx.confirm.open).toHaveBeenCalledWith('projects.detail_unsaved_title', 'projects.detail_unsaved_message');
      expect(navigate).not.toHaveBeenCalled();
      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      await component.goBack();
      expect(navigate).toHaveBeenCalledWith(['/admin/web/projects']);
      component.discardChanges();
      ctx.confirm.open.calls.reset();
      await component.goBack();
      expect(ctx.confirm.open).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description The browser asks on reload / close while settings are unsaved or the one-time
     *   password was not copied.
     * @input  clean; dirty; clean with an uncopied password; copied
     * @output defaultPrevented false, true, true, false
     */
    it('protects unsaved work on reload', fakeAsync(() => {
      init();
      const unload = () => { const e = new Event('beforeunload', { cancelable: true }); component.onBeforeUnload(e as BeforeUnloadEvent); return e.defaultPrevented; };
      expect(unload()).toBeFalse();
      component.form['name'] = 'Other';
      expect(unload()).toBeTrue();
      component.discardChanges();
      component.revealedPassword = { password: 'pw', url: 'u', generatedAt: 'x' };
      expect(unload()).toBeTrue();
      spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
      component.copyPassword();
      expect(unload()).toBeFalse();
      discardPeriodicTasks();
    }));
  });

  describe('access', () => {
    /**
     * @description The password of a just created project comes from the list in memory, once, for
     *   this project only; leaving without copying it asks first.
     * @input  handoff.put(7, 'S3cret', 'u'); page of project 7; goBack with confirm false, then true
     * @output revealedPassword S3cret visible; handoff empty; confirm('projects.close_uncopied_password_title', …);
     *   navigation only after confirm; revealedPassword cleared
     */
    it('shows the handed over password and asks before leaving it uncopied', fakeAsync(async () => {
      TestBed.inject(ProjectPasswordHandoffService).put(7, 'S3cret', 'u');
      init();
      expect(component.revealedPassword?.password).toBe('S3cret');
      expect(component.passwordVisible).toBeTrue();
      expect(TestBed.inject(ProjectPasswordHandoffService).take(7)).toBeNull();
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.goBack();
      expect(ctx.confirm.open).toHaveBeenCalledWith('projects.close_uncopied_password_title', 'projects.close_uncopied_password_message');
      expect(navigate).not.toHaveBeenCalled();
      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      await component.goBack();
      expect(navigate).toHaveBeenCalledWith(['/admin/web/projects']);
      expect(component.revealedPassword).toBeNull();
      discardPeriodicTasks();
    }));

    /**
     * @description A password handed over for another project is not shown (and stays for it).
     * @input  handoff.put(8, …); page of project 7
     * @output revealedPassword null; take(8) still returns it
     */
    it('ignores the password of another project', fakeAsync(() => {
      const handoff = TestBed.inject(ProjectPasswordHandoffService);
      handoff.put(8, 'pw', 'u');
      init();
      expect(component.revealedPassword).toBeNull();
      expect(handoff.take(8)?.password).toBe('pw');
      discardPeriodicTasks();
    }));

    /**
     * @description The password can be shown / hidden and copied; the URL falls back to the project URL;
     *   copying works without the Clipboard API too.
     * @input  no password: copyPassword; password { pw, u }: toggle, copy both; then no password; then no clipboard
     * @output clipboard 'pw', 'u', then 'https://x/p/7'; success alerts; no error without clipboard
     */
    it('reveals and copies the password and URL', fakeAsync(() => {
      init();
      const write = spyOn(navigator.clipboard, 'writeText').and.returnValue(Promise.resolve());
      component.copyPassword();
      expect(write).not.toHaveBeenCalled();
      component.revealedPassword = { password: 'pw', url: 'u', generatedAt: 'x' };
      component.togglePasswordVisibility();
      expect(component.passwordVisible).toBeTrue();
      component.copyPassword();
      component.copyPublicUrl();
      expect(write.calls.allArgs()).toEqual([['pw'], ['u']]);
      expect(ctx.alert.open).toHaveBeenCalledWith('projects.copied_title', 'projects.password_copied_message', 'success');
      expect(ctx.alert.open).toHaveBeenCalledWith('projects.copied_title', 'projects.url_copied_message', 'success');
      component.revealedPassword = null;
      component.copyPublicUrl();
      expect(write).toHaveBeenCalledWith('https://x/p/7');
      component.project = null;
      write.calls.reset();
      component.copyPublicUrl();
      expect(write).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description Regenerating asks first and shows the new password - in the component only.
     * @input  confirm → true; API { generated_password: 'New1' }; then guards (busy, cancelled, no permission, failure)
     * @output post('web/projects/7/regenerate-password', {}); revealedPassword 'New1' visible, not copied;
     *   success alert; guards send nothing; failure resets the flag
     */
    it('regenerates the client password', fakeAsync(async () => {
      init();
      dh().post.and.returnValue(of({ generated_password: 'New1' }));
      await component.regeneratePassword();
      expect(ctx.confirm.open).toHaveBeenCalledWith('projects.regenerate_password_confirm_title', 'projects.regenerate_password_confirm_message');
      expect(dh().post).toHaveBeenCalledWith('web/projects/7/regenerate-password', {});
      expect(component.revealedPassword).toEqual(jasmine.objectContaining({ password: 'New1', url: 'https://x/p/7' }));
      expect(component.passwordVisible).toBeTrue();
      expect(component.passwordCopied).toBeFalse();
      expect(ctx.alert.open).toHaveBeenCalledWith('projects.password_regenerated_title', 'projects.password_regenerated_message', 'success');

      dh().post.calls.reset();
      component.passwordRegenerating = true;
      await component.regeneratePassword();
      component.passwordRegenerating = false;
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.regeneratePassword();
      ctx.permissions.granted = new Set();
      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      await component.regeneratePassword();
      expect(dh().post).not.toHaveBeenCalled();
      ctx.permissions.granted = 'all';
      dh().post.and.returnValue(throwError(() => new Error('x')));
      await component.regeneratePassword();
      expect(component.passwordRegenerating).toBeFalse();
      discardPeriodicTasks();
    }));
  });

  describe('checkpoints', () => {
    /**
     * @description A checkpoint is added with the trimmed title and description (empty description
     *   = none); empty titles or no permission send nothing.
     * @input  '  '; then '  Launch ' with description '  Go live  '; then 'Docs' without description; then no permission
     * @output post(…, { label: 'Launch', description: 'Go live' }), post(…, { label: 'Docs', description: null });
     *   inputs cleared
     */
    it('adds checkpoints', fakeAsync(() => {
      init();
      component.newCheckpointLabel = '  ';
      component.addCheckpoint();
      expect(dh().post).not.toHaveBeenCalled();
      dh().post.and.returnValue(of({ id: 2, label: 'Launch', description: 'Go live', status: 'new', sort_order: 2 }));
      component.newCheckpointLabel = '  Launch ';
      component.newCheckpointDescription = '  Go live  ';
      component.addCheckpoint();
      expect(dh().post).toHaveBeenCalledWith('web/projects/7/checkpoints', { label: 'Launch', description: 'Go live' });
      expect(component.checkpoints.length).toBe(2);
      expect(component.newCheckpointLabel).toBe('');
      expect(component.newCheckpointDescription).toBe('');
      component.newCheckpointLabel = 'Docs';
      component.addCheckpoint();
      expect(dh().post).toHaveBeenCalledWith('web/projects/7/checkpoints', { label: 'Docs', description: null });
      dh().post.calls.reset();
      ctx.permissions.granted = new Set();
      component.newCheckpointLabel = 'X';
      component.addCheckpoint();
      expect(dh().post).not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    /**
     * @description The status is picked in the checkpoint's dropdown (no cycling by clicks): the
     *   picked status is saved; the same status, a busy row or no permission send nothing; a failed
     *   save puts the dropdown back.
     * @input  checkpoint 1 (new); dropdown 'done'; then 'done' again; busy; no permission; failure on 'active'
     * @output put('web/projects/7/checkpoints/1', { status: 'done' }) once; status 'done'; dropdown back to 'done' after
     *   the guards and the failure; busy flag cleared
     */
    it('sets the checkpoint status picked in the dropdown', fakeAsync(() => {
      init();
      const select = (value: string) => { const el = document.createElement('select'); ['new', 'active', 'done'].forEach(v => el.add(new Option(v, v))); el.value = value; return el; };
      const cp = component.checkpoints[0];
      dh().put.and.returnValue(of({ ...cp, status: 'done' }));
      component.setCheckpointStatus(cp, select('done'));
      expect(dh().put).toHaveBeenCalledWith('web/projects/7/checkpoints/1', { status: 'done' });
      const saved = component.checkpoints[0];
      expect(saved.status).toBe('done');
      component.setCheckpointStatus(saved, select('done'));
      component.checkpointBusyIds.add(1);
      let el = select('new');
      component.setCheckpointStatus(saved, el);
      expect(el.value).toBe('done');
      component.checkpointBusyIds.clear();
      ctx.permissions.granted = new Set();
      el = select('new');
      component.setCheckpointStatus(saved, el);
      expect(el.value).toBe('done');
      expect(dh().put).toHaveBeenCalledTimes(1);
      ctx.permissions.granted = 'all';
      dh().put.and.returnValue(throwError(() => new Error('x')));
      el = select('active');
      component.setCheckpointStatus(saved, el);
      expect(el.value).toBe('done');
      expect(component.checkpoints[0].status).toBe('done');
      expect(component.checkpointBusyIds.has(1)).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description "Add checkpoint" opens the form (closing an open editor), cancel closes it and
     *   forgets the text, a successful add closes it; the header shows how many are done.
     * @input  editor of Design open; openAddCheckpoint; type; cancel; open again; add 'Launch'; no permission
     * @output addingCheckpoint true + editor closed; texts cleared on cancel; closed after add;
     *   checkpointsDone 0 → 1 after Launch (done); no form without permission; rendered form with input + textarea
     */
    it('opens and closes the new checkpoint form', fakeAsync(() => {
      init();
      component.startEditCheckpoint(component.checkpoints[0]);
      component.openAddCheckpoint();
      expect(component.addingCheckpoint).toBeTrue();
      expect(component.editingCheckpointId).toBeNull();
      component.newCheckpointLabel = 'X';
      component.newCheckpointDescription = 'Y';
      component.cancelAddCheckpoint();
      expect([component.addingCheckpoint, component.newCheckpointLabel, component.newCheckpointDescription]).toEqual([false, '', '']);

      const el = fixture.nativeElement as HTMLElement;
      fixture.detectChanges();
      (el.querySelector('#pd-cp-title')!.closest('.pd-card')!.querySelector('.pd-card-head-actions .pd-btn') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el.querySelector('.pd-cp-new input')).not.toBeNull();
      expect(el.querySelector('.pd-cp-new textarea')).not.toBeNull();

      expect(component.checkpointsDone).toBe(0);
      dh().post.and.returnValue(of({ id: 2, label: 'Launch', status: 'done', sort_order: 2 }));
      component.newCheckpointLabel = 'Launch';
      component.addCheckpoint();
      expect(component.addingCheckpoint).toBeFalse();
      expect(component.checkpointsDone).toBe(1);

      ctx.permissions.granted = new Set();
      component.openAddCheckpoint();
      expect(component.addingCheckpoint).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description The title and description are edited in the row's editor: only changed fields
     *   are sent (cleared description = null), nothing when unchanged or with an empty title, the
     *   editor stays open on a failure; cancel closes it; without permission it does not open.
     * @input  edit Design: description '  Wireframes ', save; edit again unchanged; title '  ', save;
     *   title 'UX', failure; cancel; no permission
     * @output put(…/checkpoints/1, { description: 'Wireframes' }); editor closed + list updated; unchanged
     *   closes without request; empty title sends nothing; put({ label: 'UX' }) failure keeps editor;
     *   cancel → null; no editor without permission
     */
    it('edits the title and description of a checkpoint', fakeAsync(() => {
      init();
      const cp = component.checkpoints[0];
      component.startEditCheckpoint(cp);
      expect(component.editingCheckpointId).toBe(1);
      expect(component.checkpointDraft).toEqual({ label: 'Design', description: '' });
      component.checkpointDraft.description = '  Wireframes ';
      dh().put.and.returnValue(of({ ...cp, description: 'Wireframes' }));
      component.saveCheckpoint(cp);
      expect(dh().put).toHaveBeenCalledWith('web/projects/7/checkpoints/1', { description: 'Wireframes' });
      expect(component.editingCheckpointId).toBeNull();
      const saved = component.checkpoints[0];
      expect(saved.description).toBe('Wireframes');

      component.startEditCheckpoint(saved);
      component.saveCheckpoint(saved);
      expect(component.editingCheckpointId).toBeNull();
      component.startEditCheckpoint(saved);
      component.checkpointDraft.label = '  ';
      component.saveCheckpoint(saved);
      expect(dh().put).toHaveBeenCalledTimes(1);

      component.checkpointDraft = { label: 'UX', description: '' };
      dh().put.and.returnValue(throwError(() => new Error('x')));
      component.saveCheckpoint(saved);
      expect(dh().put).toHaveBeenCalledWith('web/projects/7/checkpoints/1', { label: 'UX', description: null });
      expect(component.editingCheckpointId).toBe(1);
      expect(component.checkpointBusyIds.has(1)).toBeFalse();
      component.cancelEditCheckpoint();
      expect(component.editingCheckpointId).toBeNull();

      ctx.permissions.granted = new Set();
      component.startEditCheckpoint(saved);
      expect(component.editingCheckpointId).toBeNull();
      discardPeriodicTasks();
    }));

    /**
     * @description A description is previewed under the title; the editor replaces it while editing.
     * @input  Design with description 'Wireframes'; then a click on its edit button
     * @output .pd-cp-description 'Wireframes'; then .pd-cp-editor with input + textarea, no preview
     */
    it('renders the description preview and the editor', fakeAsync(() => {
      dh().get.and.callFake(() => of({ ...project(), checkpoints: [{ id: 1, label: 'Design', description: 'Wireframes', status: 'new', sort_order: 1 }] }));
      init();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.pd-cp-description')!.textContent).toContain('Wireframes');
      (el.querySelector('.pd-cp-action') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(component.editingCheckpointId).toBe(1);
      expect(el.querySelector('.pd-cp-editor input')).not.toBeNull();
      expect(el.querySelector('.pd-cp-editor textarea')).not.toBeNull();
      expect(el.querySelector('.pd-cp-description')).toBeNull();
      discardPeriodicTasks();
    }));

    /**
     * @description The checkpoint row renders a dropdown with all statuses and the current one selected.
     * @input  checkpoint 'Design' (new)
     * @output select.pd-cp-status with 3 options, value 'new', aria-label naming the checkpoint
     */
    it('renders the checkpoint status as a dropdown', fakeAsync(() => {
      init();
      fixture.detectChanges();
      const select = (fixture.nativeElement as HTMLElement).querySelector('select.pd-cp-status') as HTMLSelectElement;
      expect(select.options.length).toBe(3);
      expect(select.value).toBe('new');
      expect(select.getAttribute('aria-label')).toBe('projects.checkpoint_status_label: Design');
      discardPeriodicTasks();
    }));

    /**
     * @description Deleting a checkpoint asks with its label first.
     * @input  message '{label}?'; confirm false, then true
     * @output confirm('…title', 'Design?'); delete('web/projects/7/checkpoints/1') only after confirm; removed
     */
    it('deletes a checkpoint after confirmation', fakeAsync(async () => {
      ctx.i18n.getValue.and.callFake((p: string) => (p === 'projects.delete_checkpoint_confirm_message' ? '{label}?' : p));
      init();
      const cp = component.checkpoints[0];
      ctx.confirm.open.and.returnValue(Promise.resolve(false));
      await component.deleteCheckpoint(cp);
      expect(ctx.confirm.open).toHaveBeenCalledWith('projects.delete_checkpoint_confirm_title', 'Design?');
      expect(dh().delete).not.toHaveBeenCalled();
      ctx.confirm.open.and.returnValue(Promise.resolve(true));
      await component.deleteCheckpoint(cp);
      expect(dh().delete).toHaveBeenCalledWith('web/projects/7/checkpoints/1');
      expect(component.checkpoints).toEqual([]);
      discardPeriodicTasks();
    }));
  });

  describe('conversations', () => {
    /**
     * @description The filter chips show the active (default), closed or all threads with their counts.
     * @input  threads 3 (active), 4 (closed), 5 (active); filters active / closed / all
     * @output visible ids [3, 5] / [4] / [3, 4, 5]; counts 2 / 1 / 3
     */
    it('filters the threads', fakeAsync(() => {
      init();
      expect(component.visibleThreads.map(t => t.id)).toEqual([3, 5]);
      component.setThreadFilter('closed');
      expect(component.visibleThreads.map(t => t.id)).toEqual([4]);
      component.setThreadFilter('all');
      expect(component.visibleThreads.map(t => t.id)).toEqual([3, 4, 5]);
      expect([component.threadCount('active'), component.threadCount('closed'), component.threadCount('all')]).toEqual([2, 1, 3]);
      discardPeriodicTasks();
    }));

    /**
     * @description Opening a thread loads its messages (the API marks it read), clears its unread
     *   badge and scrolls to the newest message; a failure ends the loading.
     * @input  openThread(thread 3); message list 100 px; then a failing request
     * @output getWithMeta('web/project-threads/3'); has_more from meta; admin_unread_count 0, unreadTotal 1;
     *   scrollTop 100; loading false after failure; closeThread clears it
     */
    it('opens a thread and marks it read', fakeAsync(() => {
      init();
      const list = scrollList(100);
      component.messageList = { nativeElement: list.el } as any;
      dh().getWithMeta.and.returnValue(of({ data: { ...threads()[0], messages: [{ id: 10, author_type: 'customer', body: 'Hi' }] }, meta: { has_more_older_messages: true } }));
      component.openThread(threads()[0]);
      expect(dh().getWithMeta).toHaveBeenCalledWith('web/project-threads/3');
      expect(component.selectedThread?.has_more_older_messages).toBeTrue();
      expect(component.threads.find(t => t.id === 3)!.admin_unread_count).toBe(0);
      expect(component.unreadTotal).toBe(1);
      expect(component.threadLoading).toBeFalse();
      tick();
      expect(list.sets).toEqual([100]);
      dh().getWithMeta.and.returnValue(throwError(() => new Error('x')));
      component.openThread(threads()[1]);
      expect(component.threadLoading).toBeFalse();
      component.closeThread();
      expect(component.selectedThread).toBeNull();
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description Changing the status updates the open thread and the list; no thread or no permission sends nothing.
     * @input  thread 3 open; changeThreadStatus('closed'); then guards
     * @output put('web/project-threads/3/status', { status: 'closed' }); both copies closed; put once
     */
    it('changes the thread status', fakeAsync(() => {
      init();
      component.selectedThread = { ...threads()[0] };
      dh().put.and.returnValue(of({ ...threads()[0], status: 'closed' }));
      component.changeThreadStatus('closed');
      expect(dh().put).toHaveBeenCalledWith('web/project-threads/3/status', { status: 'closed' });
      expect(component.selectedThread!.status).toBe('closed');
      expect(component.threads[0].status).toBe('closed');
      ctx.permissions.granted = new Set();
      component.changeThreadStatus('active');
      ctx.permissions.granted = 'all';
      component.selectedThread = null;
      component.changeThreadStatus('active');
      expect(dh().put).toHaveBeenCalledTimes(1);
      discardPeriodicTasks();
    }));

    /**
     * @description A text reply is posted as JSON, then the thread and the list reload.
     * @input  thread 3 open; replyBody '  Hello '
     * @output post('web/project-threads/3/reply', { body: 'Hello' }); thread reloaded; threads reloaded; reply cleared
     */
    it('sends a text reply', fakeAsync(async () => {
      init();
      component.selectedThread = { ...threads()[0] };
      component.replyBody = '  Hello ';
      dh().getCollection.calls.reset();
      await component.sendReply();
      expect(dh().post).toHaveBeenCalledWith('web/project-threads/3/reply', { body: 'Hello' });
      expect(dh().getWithMeta).toHaveBeenCalledWith('web/project-threads/3');
      expect(dh().getCollection).toHaveBeenCalledWith('web/project-threads', { project_id: 7, no_pagination: 'true' });
      expect(component.replyBody).toBe('');
      expect(component.replySending).toBeFalse();
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description A reply with files is sent as multipart FormData (body + attachments[]).
     * @input  replyFiles [a.pdf]; replyBody 'See file'
     * @output FormData body 'See file' with one attachments[]; files cleared
     */
    it('sends a reply with attachments as FormData', fakeAsync(async () => {
      init();
      component.selectedThread = { ...threads()[0] };
      component.replyFiles = [file('a.pdf')];
      component.replyBody = 'See file';
      await component.sendReply();
      const body = dh().post.calls.mostRecent().args[1] as FormData;
      expect(body.get('body')).toBe('See file');
      expect(body.getAll('attachments[]').length).toBe(1);
      expect(component.replyFiles).toEqual([]);
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description Empty replies, no thread, a running send or no permission send nothing; a failure keeps the text.
     * @input  guard states; then post fails
     * @output post not called for the guards; replyBody kept and replySending false after the failure
     */
    it('guards and recovers reply sending', fakeAsync(async () => {
      init();
      component.replyBody = '  ';
      component.selectedThread = { ...threads()[0] };
      await component.sendReply();
      component.replyBody = 'x';
      component.selectedThread = null;
      await component.sendReply();
      component.selectedThread = { ...threads()[0] };
      component.replySending = true;
      await component.sendReply();
      component.replySending = false;
      ctx.permissions.granted = new Set();
      await component.sendReply();
      expect(dh().post).not.toHaveBeenCalled();
      ctx.permissions.granted = 'all';
      dh().post.and.returnValue(throwError(() => new Error('x')));
      await component.sendReply();
      expect(component.replyBody).toBe('x');
      expect(component.replySending).toBeFalse();
      discardPeriodicTasks();
    }));

    /**
     * @description Older messages are prepended and the scroll position is kept; guards send nothing.
     * @input  thread with message 20 and has_more; list 100 px; API [10] has_more false; then the guards and a failure
     * @output getWithMeta('…/messages?before_message_id=20'); messages [10, 20]; has_more false; scrollTop 0;
     *   loading false after failure
     */
    it('loads older messages', fakeAsync(() => {
      init();
      const list = scrollList(100);
      component.messageList = { nativeElement: list.el } as any;
      component.selectedThread = { ...threads()[0], has_more_older_messages: true, messages: [{ id: 20 } as any] };
      dh().getWithMeta.and.returnValue(of({ data: [{ id: 10 }], meta: { has_more_older_messages: false } }));
      component.loadOlderMessages();
      expect(dh().getWithMeta).toHaveBeenCalledWith('web/project-threads/3/messages?before_message_id=20');
      expect(component.selectedThread!.messages!.map(m => m.id)).toEqual([10, 20]);
      expect(component.selectedThread!.has_more_older_messages).toBeFalse();
      tick();
      expect(list.sets).toEqual([0]);

      dh().getWithMeta.calls.reset();
      component.loadOlderMessages();
      component.selectedThread = { ...threads()[0], has_more_older_messages: true, messages: [] };
      component.loadOlderMessages();
      component.selectedThread = null;
      component.loadOlderMessages();
      component.selectedThread = { ...threads()[0], has_more_older_messages: true, messages: [{ id: 20 } as any] };
      component.olderMessagesLoading = true;
      component.loadOlderMessages();
      expect(dh().getWithMeta).not.toHaveBeenCalled();
      component.olderMessagesLoading = false;
      dh().getWithMeta.and.returnValue(throwError(() => new Error('x')));
      component.loadOlderMessages();
      expect(component.olderMessagesLoading).toBeFalse();
      flush();
      discardPeriodicTasks();
    }));

    /**
     * @description Status, priority and author labels are translated.
     * @input  threadStatusLabel / threadPriorityLabel / threadAuthorLabel
     * @output 'projects.thread_status_closed' / '…_active'; 'projects.thread_priority_high'; author admin / customer
     */
    it('translates the thread labels', fakeAsync(() => {
      init();
      expect(component.threadStatusLabel('closed')).toBe('projects.thread_status_closed');
      expect(component.threadStatusLabel('active')).toBe('projects.thread_status_active');
      expect(component.threadPriorityLabel('high')).toBe('projects.thread_priority_high');
      expect(component.threadAuthorLabel('admin')).toBe('projects.thread_author_admin');
      expect(component.threadAuthorLabel('customer')).toBe('projects.thread_author_customer');
      discardPeriodicTasks();
    }));
  });

  describe('reply attachments', () => {
    /**
     * @description Allowed files are added; wrong type, too large and files without extension are
     *   refused (first error shown); without rules the type is left to the server.
     * @input  a.PDF, virus.exe, big.zip (16 MB), README; then big.zip alone; remove; no rules + tool.exe
     * @output ['a.PDF'] with the type error; size error; removed and error cleared; tool.exe kept
     */
    it('validates selected reply files', fakeAsync(() => {
      init();
      const event = fileEvent(file('a.PDF'), file('virus.exe'), file('big.zip', 16 * 1024 * 1024), file('README'));
      component.onReplyFilesSelected(event);
      expect(component.replyFiles.map(f => f.name)).toEqual(['a.PDF']);
      expect(component.replyFileError).toBe('projects.attachment_error_type projects.attachment_allowed_types');
      expect((event.target as HTMLInputElement).value).toBe('');
      component.onReplyFilesSelected(fileEvent(file('big.zip', 16 * 1024 * 1024)));
      expect(component.replyFileError).toBe('projects.attachment_error_size');
      component.removeReplyFile(0);
      expect(component.replyFiles).toEqual([]);
      expect(component.replyFileError).toBeNull();
      component.attachmentRules = null;
      component.onReplyFilesSelected(fileEvent(file('tool.exe')));
      expect(component.replyFiles.map(f => f.name)).toEqual(['tool.exe']);
      discardPeriodicTasks();
    }));

    /**
     * @description At most the allowed number of attachments; an empty selection changes nothing; sizes are formatted.
     * @input  6 pdf files; empty selection; formatFileSize values
     * @output 5 files; 'projects.attachment_error_too_many'; '0 KB', '2 KB', '5.0 MB', ''
     */
    it('limits the attachments and formats sizes', fakeAsync(() => {
      init();
      component.onReplyFilesSelected(fileEvent(...[1, 2, 3, 4, 5, 6].map(i => file(`f${i}.pdf`))));
      expect(component.replyFiles.length).toBe(component.maxAttachments);
      expect(component.replyFileError).toBe('projects.attachment_error_too_many');
      component.onReplyFilesSelected(fileEvent());
      expect(component.replyFiles.length).toBe(component.maxAttachments);
      expect(component.formatFileSize(0)).toBe('0 KB');
      expect(component.formatFileSize(2048)).toBe('2 KB');
      expect(component.formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
      expect(component.formatFileSize(undefined as any)).toBe('');
      component.attachmentRules = null;
      expect([component.maxAttachments, component.maxAttachmentSizeMb]).toEqual([5, 15]);
      discardPeriodicTasks();
    }));
  });

  describe('rendering', () => {
    /**
     * @description The page renders the header (name, unread badge), the thread list with unread
     *   counts, the settings form with the save bar and the access / checkpoint cards.
     * @input  project 7 with threads (2 + 1 unread)
     * @output name 'Shop'; unread chip; 2 active threads listed, 1 with a count; settings inputs; save bar; 'Design'
     */
    it('renders the project page', fakeAsync(() => {
      init();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.pd-title')!.textContent).toContain('Shop');
      expect(el.querySelector('.pd-chip--unread')).not.toBeNull();
      expect(el.querySelectorAll('.pd-thread').length).toBe(2);
      expect(el.querySelectorAll('.pd-thread .pd-count--unread').length).toBe(1);
      expect(el.querySelectorAll('.pd-form .pd-input').length).toBe(11);
      expect(el.querySelector('.pd-savebar')).not.toBeNull();
      expect(el.textContent).toContain('Design');
      discardPeriodicTasks();
    }));

    /**
     * @description Without the update permission everything is read-only: no save bar, no reply, no regenerate, inputs disabled.
     * @input  granted only web-projects-view
     * @output read-only note; no .pd-savebar / .pd-reply / .pd-btn--warn; first input disabled
     */
    it('renders read-only without the update permission', fakeAsync(() => {
      ctx.permissions.granted = new Set(['web-projects-view']);
      init();
      tick();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('projects.detail_readonly');
      expect(el.querySelector('.pd-savebar')).toBeNull();
      expect(el.querySelector('.pd-btn--warn')).toBeNull();
      expect((el.querySelector('.pd-form .pd-input') as HTMLInputElement).disabled).toBeTrue();
      discardPeriodicTasks();
    }));

    /**
     * @description A wrong project shows the "not found" state with a link back.
     * @input  API fails
     * @output 'projects.detail_not_found'; link to /admin/web/projects
     */
    it('renders the not found state', fakeAsync(() => {
      dh().get.and.returnValue(throwError(() => ({ status: 404 })));
      init();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('projects.detail_not_found');
      expect(el.querySelector('a[href="/admin/web/projects"]')).not.toBeNull();
      discardPeriodicTasks();
    }));
  });
});
