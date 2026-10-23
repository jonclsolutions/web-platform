/**
 * @file support-form.component.spec.ts
 * @path src/app/admin/intranet/knowledge-base/pages/support-form/support-form.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the intranet SupportFormComponent: default values and validation, optional
 *   attachment, multipart submit to web/support_tickets with the ticket number on success, the
 *   error path and starting a new ticket.
 * @dependencies
 * - createAdminTestContext (DataHandler.upload spy).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { SupportFormComponent } from './support-form.component';
import { AdminTestContext, createAdminTestContext } from '../../../../../../testing/admin-test-helpers';

describe('SupportFormComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<SupportFormComponent>;
  let form: SupportFormComponent;
  let upload: jasmine.Spy;

  beforeEach(() => {
    ctx = createAdminTestContext();
    upload = (ctx.dataHandler as any).upload;
    TestBed.configureTestingModule({ imports: [SupportFormComponent], providers: ctx.providers });
    fixture = TestBed.createComponent(SupportFormComponent);
    form = fixture.componentInstance;
    fixture.detectChanges();
  });

  const fill = () => form.supportForm.patchValue({ subject: 'Printer', description: 'Broken' });

  /**
   * @description Defaults category it / priority medium; subject + description required;
   *   invalid form is not sent; texts from kb-support-form.
   * @input Empty subject; submit.
   * @output invalid, no upload; t('x') 'kb-support-form.x'.
   */
  it('validates the ticket form', () => {
    expect(form.supportForm.value).toEqual({ category: 'it', priority: 'medium', subject: '', description: '' });
    expect(form.supportForm.valid).toBeFalse();
    form.onSubmit();
    expect(upload).not.toHaveBeenCalled();
    expect(form.t('x')).toBe('kb-support-form.x');
  });

  /**
   * @description Submit with attachment: FormData with all fields + file, success shows the
   *   ticket number; "new ticket" resets the form; empty file selection ignored.
   * @input file chosen; valid form; upload → {id: 42}; reset button.
   * @output POST web/support_tickets with fields + attachment; isSubmitted, '#42' rendered; form reset.
   */
  it('sends the ticket with an attachment', () => {
    form.onFileSelected({ target: { files: [] } });
    expect(form.selectedFile).toBeNull();
    form.onFileSelected({ target: { files: [new File(['x'], 'log.txt')] } });
    fill();
    upload.and.returnValue(of({ id: 42 }));
    form.onSubmit();
    const [url, fd] = upload.calls.mostRecent().args as [string, FormData];
    expect(url).toBe('web/support_tickets');
    expect([fd.get('category'), fd.get('priority'), fd.get('subject'), fd.get('description')]).toEqual(['it', 'medium', 'Printer', 'Broken']);
    expect((fd.get('attachment') as File).name).toBe('log.txt');
    expect([form.isSubmitted, form.lastTicketId]).toEqual([true, 42]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('#42');

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(form.isSubmitted).toBeFalse();
    expect(form.selectedFile).toBeNull();
    expect(form.supportForm.value.subject).toBe('');
  });

  /**
   * @description Without attachment no file field; an error keeps the form (DataHandler shows the dialog).
   * @input valid form, upload failing.
   * @output no 'attachment' in FormData; isSubmitted false; console.error.
   */
  it('keeps the form when sending fails', () => {
    spyOn(console, 'error');
    fill();
    upload.and.returnValue(throwError(() => new Error('500')));
    form.onSubmit();
    expect((upload.calls.mostRecent().args[1] as FormData).has('attachment')).toBeFalse();
    expect(form.isSubmitted).toBeFalse();
    expect(console.error).toHaveBeenCalled();
  });
});
