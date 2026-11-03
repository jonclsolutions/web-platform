/**
 * @file support-form.component.spec.ts
 * @path src/app/admin/intranet/knowledge-base/pages/support-form/support-form.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the intranet SupportFormComponent: default values and validation, optional
 *   attachment checked against the support_ticket upload rules, multipart submit to web/support_tickets with the ticket number on success, the
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

  /**
   * @description The picker offers every file and no type list is shown up front; a refused type
   *   of the API rules (support_ticket: xml, svg, no extension) is not kept and only its error
   *   lists the allowed types; a file over 20 MB is refused with the size error.
   * @input file input; feed.xml; logo.svg; README; big.pdf (21 MB); then ok.png.
   * @output no accept, no hint; type error + allowed types, selectedFile null, input cleared; size
   *   error; ok.png kept and the error cleared.
   */
  it('checks the attachment against the upload rules', () => {
    expect(form.allowedTypesText).toBe('kb-support-form.allowed_types_hint');
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.hasAttribute('accept')).toBeFalse();
    expect(fixture.nativeElement.textContent).not.toContain('kb-support-form.allowed_types_hint');

    for (const name of ['feed.xml', 'logo.svg', 'README']) {
      const event = { target: { files: [new File(['x'], name)], value: 'C:\\fakepath\\' + name } };
      form.onFileSelected(event);
      expect(form.fileError).toBe('kb-support-form.file_type_error kb-support-form.allowed_types_hint');
      expect(form.selectedFile).toBeNull();
      expect(event.target.value).toBe('');
    }
    const big = new File(['x'], 'big.pdf');
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 });
    form.onFileSelected({ target: { files: [big], value: 'x' } });
    expect(form.fileError).toBe('kb-support-form.file_size_error');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.kb-file-error')).not.toBeNull();

    form.onFileSelected({ target: { files: [new File(['x'], 'ok.png')], value: 'x' } });
    expect(form.fileError).toBeNull();
    expect(form.selectedFile!.name).toBe('ok.png');
  });

  /**
   * @description Without the rules of the API (unreachable) nothing is filtered in the browser -
   *   the API validates the attachment on submit.
   * @input attachmentRules null; tool.exe of 30 MB.
   * @output no type list; the file is kept (no error).
   */
  it('leaves the check to the API without rules', () => {
    form.attachmentRules = null;
    expect(form.allowedTypesText).toBe('');
    const exe = new File(['x'], 'tool.exe');
    Object.defineProperty(exe, 'size', { value: 30 * 1024 * 1024 });
    form.onFileSelected({ target: { files: [exe], value: 'x' } });
    expect(form.fileError).toBeNull();
    expect(form.selectedFile).toBe(exe);
  });
});
