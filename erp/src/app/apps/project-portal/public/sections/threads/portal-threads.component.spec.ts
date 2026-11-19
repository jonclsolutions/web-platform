/**
 * @file portal-threads.component.spec.ts
 * @path src/app/apps/project-portal/public/sections/threads/portal-threads.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of PortalThreadsComponent (Communication): the thread list (search,
 *   waiting labels, priorities), opening a thread (detail, unread badge, polling of new messages,
 *   older messages), the status change, attachment validation with the rules of the API, replies
 *   and new threads incl. send errors, message authors, a thread asked for by another section and
 *   the refresh of the header.
 * @dependencies ../../portal.testing (stubs, sample data); fakeAsync for timers.
 */

import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { PortalTestContext, failWith, fileEvent, setUpPortal, testFile, testThreadDetail } from '../../portal.testing';
import { PortalThreadsComponent } from './portal-threads.component';

describe('PortalThreadsComponent', () => {
  let ctx: PortalTestContext;
  let fixture: ComponentFixture<PortalThreadsComponent>;
  let threads: PortalThreadsComponent;

  /**
   * @description Sets up the portal (started session) and opens Communication - inside fakeAsync,
   *   so the polling timers are fake.
   * @param before Runs before the component is created (e.g. a requested thread).
   */
  function create(before?: () => void): void {
    ctx = setUpPortal({ imports: [PortalThreadsComponent] });
    before?.();
    fixture = TestBed.createComponent(PortalThreadsComponent);
    threads = fixture.componentInstance;
    fixture.detectChanges();
  }
  /** Ends the test: destroys the view (polling stops). */
  function finish(): void {
    fixture.destroy();
    discardPeriodicTasks();
  }

  /**
   * @description Opening a thread loads the detail, clears its unread badge (also against the
   *   polling of the list) and polls new messages immediately and every 15 s (appended with the
   *   new status; empty answers ignored; errors logged and the polling goes on); a failure of the
   *   detail just stops the spinner; closing stops the polling.
   * @input openThread(1); new message 11 + status 'closed'; error; message 12; detail of thread 2 failing; close.
   * @output detail shown, unread 0, openThreadId 1; messages [10, 11], closed; console.error; [10, 11, 12];
   *   loading false; selectedThread null, openThreadId null, no more polls.
   */
  it('opens a thread and polls its new messages', fakeAsync(() => {
    create();
    threads.openThread(ctx.session.threads()[0]);
    tick();
    expect(threads.selectedThread!.messages!.map(m => m.id)).toEqual([10]);
    expect(ctx.session.threads()[0].unread_count).toBe(0);
    expect(ctx.session.openThreadId).toBe(1);
    expect(threads.threadDetailLoading).toBeFalse();
    expect(ctx.getWithMeta).toHaveBeenCalledWith(jasmine.stringMatching('/threads/1/new-messages\\?after_id=10$'));

    ctx.replies['/new-messages'] = () => of({ data: [{ id: 11, body: 'New', author_type: 'admin', author_label: 'PM', created_at: '' }], meta: { status: 'closed' } });
    tick(15000);
    expect(threads.selectedThread!.messages!.map(m => m.id)).toEqual([10, 11]);
    expect(threads.selectedThread!.status).toBe('closed');

    spyOn(console, 'error');
    ctx.replies['/new-messages'] = failWith(500);
    tick(15000);
    expect(console.error).toHaveBeenCalled();
    ctx.replies['/new-messages'] = () => of({ data: [{ id: 12, body: 'Again', author_type: 'admin', author_label: 'PM', created_at: '' }], meta: { status: 'active' } });
    tick(15000);
    expect(threads.selectedThread!.messages!.map(m => m.id)).toEqual([10, 11, 12]);

    ctx.replies['/threads/2'] = failWith(500);
    threads.openThread(ctx.session.threads()[1]);
    expect(threads.threadDetailLoading).toBeFalse();
    threads.closeThread();
    expect(threads.selectedThread).toBeNull();
    expect(ctx.session.openThreadId).toBeNull();
    ctx.getWithMeta.calls.reset();
    tick(30000);
    expect(ctx.getWithMeta).not.toHaveBeenCalled();
    finish();
  }));

  /**
   * @description Older messages are prepended (only when more exist, not twice in parallel).
   * @input no thread; thread with has_more; reply [{id 5}] + has_more false; again; no messages.
   * @output messages [5, 10]; has_more false; further calls make no request.
   */
  it('loads older messages', fakeAsync(() => {
    create();
    threads.loadOlderMessages();
    threads.openThread(ctx.session.threads()[0]);
    tick();
    ctx.replies['/messages'] = () => of({ data: [{ id: 5, body: 'Old', author_type: 'admin', author_label: null, created_at: '' }], meta: { has_more_older_messages: false } });
    threads.loadOlderMessages();
    tick();
    expect(ctx.getWithMeta).toHaveBeenCalledWith(jasmine.stringMatching('/threads/1/messages\\?before_message_id=10$'));
    expect(threads.selectedThread!.messages!.map(m => m.id)).toEqual([5, 10]);
    const calls = ctx.getWithMeta.calls.count();
    threads.loadOlderMessages();
    expect(ctx.getWithMeta.calls.count()).toBe(calls);

    threads.selectedThread!.has_more_older_messages = true;
    threads.selectedThread!.messages = [];
    threads.loadOlderMessages();
    expect(ctx.getWithMeta.calls.count()).toBe(calls);
    finish();
  }));

  /**
   * @description Status change: same status or no thread ignored; success updates detail +
   *   list; 404 (thread gone) closes it and reloads the list; other errors keep it.
   * @input updateThreadStatus('closed') without a thread; 'active' (same); 'closed' ok; 500; 404
   *   with a failing list reload.
   * @output No post; status closed in detail and list; thread kept; thread closed, list kept.
   */
  it('changes the thread status', fakeAsync(() => {
    create();
    threads.updateThreadStatus('closed');
    expect(ctx.post).not.toHaveBeenCalled();
    threads.openThread(ctx.session.threads()[0]);
    tick();
    threads.updateThreadStatus('active');
    expect(ctx.post).not.toHaveBeenCalled();

    ctx.replies['/status'] = () => of({ status: 'closed' });
    threads.updateThreadStatus('closed');
    expect(ctx.post).toHaveBeenCalledWith('projects/public/tok/threads/1/status', { status: 'closed' });
    expect(threads.selectedThread!.status).toBe('closed');
    expect(ctx.session.threads()[0].status).toBe('closed');

    ctx.replies['/status'] = failWith(500);
    threads.updateThreadStatus('active');
    expect(threads.selectedThread).not.toBeNull();
    ctx.replies['/status'] = failWith(404);
    ctx.replies['/tok/threads'] = failWith(500);
    threads.updateThreadStatus('active');
    expect(threads.selectedThread).toBeNull();
    expect(ctx.session.threads().length).toBe(2);
    finish();
  }));

  /**
   * @description Attachments: max 5, allowed extensions, 15 MB limit - first error shown,
   *   valid files kept; removal clears the error; empty selection ignored.
   * @input 1 exe + 1 pdf; 16 MB png; 6 files; remove; empty input; new thread zip + no files.
   * @output exe refused (type error with the allowed types), pdf kept; size error; too-many error and 5 files; error cleared.
   */
  it('validates attachments', fakeAsync(() => {
    create();
    threads.onReplyFilesSelected(fileEvent(testFile('virus.exe'), testFile('brief.pdf')));
    expect(threads.replyFileError).toBe('attachment_error_type attachment_allowed_types');
    expect(threads.replyFiles.map(f => f.name)).toEqual(['brief.pdf']);
    threads.onReplyFilesSelected(fileEvent(testFile('big.png', 16 * 1024 * 1024)));
    expect(threads.replyFileError).toBe('attachment_error_size');
    threads.onReplyFilesSelected(fileEvent(...['1', '2', '3', '4', '5'].map(n => testFile(`${n}.jpg`))));
    expect(threads.replyFileError).toBe('attachment_error_too_many');
    expect(threads.replyFiles.length).toBe(5);
    threads.removeReplyFile(0);
    expect(threads.replyFileError).toBeNull();
    expect(threads.replyFiles.length).toBe(4);
    threads.onReplyFilesSelected(fileEvent());

    threads.onNewThreadFilesSelected(fileEvent(testFile('a.zip')));
    threads.onNewThreadFilesSelected({ target: { files: null } } as unknown as Event);
    expect(threads.newThreadFiles.map(f => f.name)).toEqual(['a.zip']);
    threads.removeNewThreadFile(0);
    expect(threads.newThreadFiles).toEqual([]);
    finish();
  }));

  /**
   * @description The limits and types come from the rules of the API (project_thread): the
   *   pickers offer every file and no type list is shown up front; svg / xml files and a name
   *   without extension are refused when chosen and only that error lists the allowed types.
   *   Without the rules the fallback limits (5 files, 15 MB) apply and the type is left to the API.
   * @input new thread form opened by its button; limits; reply logo.svg + feed.xml; new thread README; attachmentRules null + tool.exe.
   * @output no accept, no type list; type error + 'attachment_allowed_types', nothing kept;
   *   '' types text, 5 / 15, tool.exe kept.
   */
  it('takes the attachment rules from the API', fakeAsync(() => {
    create();
    (fixture.nativeElement.querySelector('.pp-threads-toolbar .pp-btn-primary-small') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(threads.newThreadMode).toBeTrue();
    expect(fixture.nativeElement.querySelector('input[type="file"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[type="file"][accept]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('attachment_allowed_types');
    expect(threads.attachmentTypesText).toBe('attachment_allowed_types');
    expect([threads.maxAttachments, threads.maxAttachmentSizeMb]).toEqual([5, 15]);
    threads.onReplyFilesSelected(fileEvent(testFile('logo.svg'), testFile('feed.xml')));
    expect(threads.replyFileError).toBe('attachment_error_type attachment_allowed_types');
    expect(threads.replyFiles).toEqual([]);
    threads.onNewThreadFilesSelected(fileEvent(testFile('README')));
    expect(threads.newThreadFileError).toBe('attachment_error_type attachment_allowed_types');
    expect(threads.newThreadFiles).toEqual([]);

    threads.attachmentRules = null;
    expect(threads.attachmentTypesText).toBe('');
    expect([threads.maxAttachments, threads.maxAttachmentSizeMb]).toEqual([5, 15]);
    threads.onReplyFilesSelected(fileEvent(testFile('tool.exe')));
    expect(threads.replyFiles.map(f => f.name)).toEqual(['tool.exe']);
    finish();
  }));

  /**
   * @description Reply: empty / no thread ignored; JSON body without files, FormData with
   *   files; success clears, reloads the thread and the list; failure shows `error_send_failed`.
   * @input Reply 'x' without a thread; '  '; ' Thanks ' ok; 'With file' + pdf ok; 'Fail' → 500.
   * @output No post; {body: 'Thanks'} + list reloaded; FormData body + attachments[]; replySendError rendered.
   */
  it('sends replies and reports a failed send', fakeAsync(() => {
    create();
    threads.replyBody = 'x';
    threads.sendReply();
    threads.openThread(ctx.session.threads()[0]);
    tick();
    threads.replyBody = '  ';
    threads.sendReply();
    expect(ctx.post).not.toHaveBeenCalled();

    ctx.get.calls.reset();
    threads.replyBody = ' Thanks ';
    threads.sendReply();
    expect(ctx.post).toHaveBeenCalledWith('projects/public/tok/threads/1/messages', { body: 'Thanks' });
    expect(threads.replyBody).toBe('');
    expect(ctx.get).toHaveBeenCalledWith('projects/public/tok/threads');

    threads.replyBody = 'With file';
    threads.onReplyFilesSelected(fileEvent(testFile('brief.pdf')));
    threads.sendReply();
    const fd = ctx.post.calls.mostRecent().args[1] as FormData;
    expect(fd.get('body')).toBe('With file');
    expect((fd.get('attachments[]') as File).name).toBe('brief.pdf');
    tick();

    ctx.replies['/messages'] = failWith(500);
    threads.replyBody = 'Fail';
    threads.sendReply();
    expect(threads.replySendError).toBe('error_send_failed');
    expect(threads.replyBody).toBe('Fail');
    expect(threads.replySending).toBeFalse();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.pp-send-error')?.textContent.trim()).toBe('error_send_failed');
    finish();
  }));

  /**
   * @description New thread: form reset on open, cancel; subject + body required; JSON or
   *   FormData; success closes the form; failure keeps it with `error_send_failed`.
   * @input open; submit empty; subject + body ok; with file; failing.
   * @output defaults; no post; {subject, priority medium, body}; FormData; newThreadSendError.
   */
  it('creates new threads and reports a failed send', fakeAsync(() => {
    create();
    threads.openNewThreadForm();
    expect([threads.newThreadMode, threads.newThreadPriority, threads.newThreadSubject]).toEqual([true, 'medium', '']);
    threads.submitNewThread();
    expect(ctx.post).not.toHaveBeenCalled();
    threads.cancelNewThread();
    expect(threads.newThreadMode).toBeFalse();

    threads.openNewThreadForm();
    threads.newThreadSubject = 'Bug';
    threads.newThreadBody = 'Broken';
    threads.submitNewThread();
    expect(ctx.post).toHaveBeenCalledWith('projects/public/tok/threads', { subject: 'Bug', priority: 'medium', body: 'Broken' });
    expect(threads.newThreadMode).toBeFalse();

    threads.openNewThreadForm();
    threads.newThreadSubject = 'Files';
    threads.newThreadBody = 'See';
    threads.onNewThreadFilesSelected(fileEvent(testFile('a.png')));
    ctx.replies['/tok/threads'] = failWith(500);
    threads.submitNewThread();
    expect(ctx.post.calls.mostRecent().args[1] instanceof FormData).toBeTrue();
    expect(threads.newThreadSendError).toBe('error_send_failed');
    expect(threads.newThreadMode).toBeTrue();
    expect(threads.newThreadSending).toBeFalse();
    finish();
  }));

  /**
   * @description Thread search matches the subject or a loaded message.
   * @input ' hosting '; 'colours'; 'xyz'; ''.
   * @output [2]; [1]; []; both.
   */
  it('searches the threads', fakeAsync(() => {
    create();
    threads.threadSearch = ' hosting ';
    expect(threads.filteredThreads.map(t => t.id)).toEqual([2]);
    threads.threadSearch = 'colours';
    expect(threads.filteredThreads.map(t => t.id)).toEqual([1]);
    threads.threadSearch = 'xyz';
    expect(threads.filteredThreads).toEqual([]);
    threads.threadSearch = '';
    expect(threads.filteredThreads.length).toBe(2);
    finish();
  }));

  /**
   * @description Messages name their authors: "You" for the own account, a colleague's name for
   *   another client account, the supplier's name (or "Supplier"); waiting labels; priorities.
   * @input own message (account 5), colleague (account 6 'Petr'), customer without name, supplier
   *   'Jana PM' / without name; threads waiting on customer / supplier / closed; rendered detail.
   * @output 'author_you', 'Petr', 'author_client', 'Jana PM', 'author_supplier'; isMine only for
   *   the own; 'waiting_on_you' / 'waiting_on_supplier' / ''; 1 own + 2 supplier messages.
   */
  it('names the authors and shows whose turn it is', fakeAsync(() => {
    create();
    const msg = (author_type: 'customer' | 'admin', author_label: string | null, author_account_id: number | null = null) =>
      ({ id: 1, body: '', created_at: '', author_type, author_label, author_account_id });
    expect(threads.authorName(msg('customer', 'Jana Nová', 5))).toBe('author_you');
    expect(threads.authorName(msg('customer', 'Petr', 6))).toBe('Petr');
    expect(threads.authorName(msg('customer', null, 6))).toBe('author_client');
    expect(threads.authorName(msg('admin', 'Jana PM'))).toBe('Jana PM');
    expect(threads.authorName(msg('admin', null))).toBe('author_supplier');
    expect(threads.isMine(msg('customer', 'x', 5))).toBeTrue();
    expect(threads.isMine(msg('admin', 'x', 5))).toBeFalse();

    const list = ctx.session.threads();
    expect(threads.waitingLabel(list[0])).toBe('waiting_on_you');
    expect(threads.waitingLabel(list[1])).toBe('waiting_on_supplier');
    expect(threads.waitingLabel({ ...list[1], waiting_on: null })).toBe('');
    expect(threads.priorityLabel('high')).toBe('priority_high');

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.pp-waiting[data-waiting="customer"]')!.textContent).toContain('waiting_on_you');
    expect(el.querySelector('.pp-thread-item-meta')!.textContent).toContain('priority_medium');
    expect(el.querySelector('.pp-thread-unread-badge')!.textContent!.trim()).toBe('2');

    ctx.replies['/threads/1'] = () => of({ data: { ...testThreadDetail(1), messages: [msg('customer', 'Jana Nová', 5), { ...msg('admin', 'PM'), id: 2 }] }, meta: {} });
    threads.openThread(list[0]);
    ctx.replies['/new-messages'] = () => of({ data: [{ ...msg('admin', 'PM'), id: 3 }], meta: { status: 'active', waiting_on: 'customer' } });
    tick();
    expect(threads.selectedThread!.waiting_on).toBe('customer');
    fixture.detectChanges();
    expect(el.querySelectorAll('.pp-message-mine').length).toBe(1);
    expect(el.querySelectorAll('.pp-message-supplier').length).toBe(2);
    finish();
  }));

  /**
   * @description A thread asked for by another section (news item, file) opens at once and the
   *   request is taken; a refresh of the header reloads the open thread.
   * @input requestedThread = thread 2; refreshed$.
   * @output detail of thread 2 requested, requestedThread null; requested again after the refresh.
   */
  it('opens a requested thread and reloads it on refresh', fakeAsync(() => {
    create(() => ctx.session.requestedThread.set(ctx.session.threads()[1]));
    tick();
    expect(ctx.getWithMeta).toHaveBeenCalledWith('projects/public/tok/threads/2');
    expect(ctx.session.requestedThread()).toBeNull();
    expect(threads.selectedThread!.id).toBe(2);
    ctx.getWithMeta.calls.reset();
    ctx.session.refreshed$.next();
    expect(ctx.getWithMeta).toHaveBeenCalledWith('projects/public/tok/threads/2');
    finish();
    expect(ctx.session.openThreadId).toBeNull();
  }));
});
