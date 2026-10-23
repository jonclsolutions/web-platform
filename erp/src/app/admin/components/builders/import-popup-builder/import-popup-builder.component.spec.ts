/**
 * @file import-popup-builder.component.spec.ts
 * @path src/app/admin/components/builders/import-popup-builder/import-popup-builder.component.spec.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of ImportPopupBuilderComponent – the 4-step import wizard
 *   (format → upload → validation summary → done): template download, validation request,
 *   commit request, alerts and guards against double submits / closing while busy.
 * @dependencies
 * - src/testing/admin-test-helpers.ts (DataHandler spy, alert spy, i18n stub),
 *   HttpTestingController (template download), ScrollLockService (spy)
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { NEVER, of, throwError } from 'rxjs';

import { ImportPopupBuilderComponent } from './import-popup-builder.component';
import { ScrollLockService } from '../../../../core/services/scroll-lock.service';
import { environment } from '../../../../../environments/environment';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';

describe('ImportPopupBuilderComponent', () => {
  let ctx: AdminTestContext;
  let fixture: ComponentFixture<ImportPopupBuilderComponent>;
  let component: ImportPopupBuilderComponent;
  let http: HttpTestingController;

  const validation = { import_token: 42, total_rows: 3, valid_rows: 2, invalid_rows: 1, errors: [], can_commit: true };

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({
      imports: [ImportPopupBuilderComponent],
      providers: [...ctx.providers, { provide: ScrollLockService, useValue: jasmine.createSpyObj('ScrollLockService', ['lock', 'unlock']) }]
    }).compileComponents();
    fixture = TestBed.createComponent(ImportPopupBuilderComponent);
    component = fixture.componentInstance;
    component.resource = 'core/users';
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const withFile = () => {
    component.selectFormat('csv');
    component.onFileSelected({ target: { files: [new File(['a;b'], 'users.csv')] } } as any);
  };

  /**
   * @description The wizard starts at the format step; Excel is not offered for import.
   * @input  new component
   * @output step 'format'; formatOptions without 'xlsx'
   */
  it('starts at the format step without xlsx', () => {
    expect(component.step).toBe('format');
    expect(component.formatOptions.map(o => o.value)).not.toContain('xlsx');
  });

  /**
   * @description Picking a format moves to the upload step; going back clears the file.
   * @input  selectFormat('json'); select a file; backToFormat()
   * @output step 'upload' with selectedFormat 'json'; then step 'format', selectedFile null, validation null
   */
  it('moves between format and upload steps', () => {
    component.selectFormat('json');
    expect(component.step).toBe('upload');
    expect(component.selectedFormat).toBe('json');
    component.onFileSelected({ target: { files: [new File(['x'], 'a.json')] } } as any);
    component.backToFormat();
    expect(component.step).toBe('format');
    expect(component.selectedFile).toBeNull();
    expect(component.validation).toBeNull();
  });

  /**
   * @description Validation uploads the file with the format to <resource>/import/validate.
   * @input  csv + users.csv; runValidation()
   * @output upload('core/users/import/validate', FormData{format: 'csv', file: users.csv}); step 'summary'; validation stored
   */
  it('validates the uploaded file', () => {
    (ctx.dataHandler as any).upload.and.returnValue(of(validation));
    withFile();
    component.runValidation();
    const [url, fd] = (ctx.dataHandler as any).upload.calls.mostRecent().args;
    expect(url).toBe('core/users/import/validate');
    expect(fd.get('format')).toBe('csv');
    expect((fd.get('file') as File).name).toBe('users.csv');
    expect(component.step).toBe('summary');
    expect(component.validation).toEqual(validation);
    expect(component.hasErrors).toBeTrue();
  });

  /**
   * @description Validation needs a file and is not started twice.
   * @input  runValidation() without file; then with file while a validation is pending, call again
   * @output no upload without file; upload called once
   */
  it('runValidation() requires a file and ignores double clicks', () => {
    component.selectFormat('csv');
    component.runValidation();
    expect((ctx.dataHandler as any).upload).not.toHaveBeenCalled();
    (ctx.dataHandler as any).upload.and.returnValue(NEVER);
    withFile();
    component.runValidation();
    component.runValidation();
    expect((ctx.dataHandler as any).upload).toHaveBeenCalledTimes(1);
  });

  /**
   * @description A failed validation keeps the user on the upload step.
   * @input  upload fails
   * @output isValidating false; step 'upload'
   */
  it('stays on upload when validation fails', () => {
    (ctx.dataHandler as any).upload.and.returnValue(throwError(() => new Error('x')));
    withFile();
    component.runValidation();
    expect(component.isValidating).toBeFalse();
    expect(component.step).toBe('upload');
  });

  /**
   * @description A synchronous import commits with the token and reports imported/skipped counts.
   * @input  validation token 42; commit returns { queued: false, imported_count: 2, skipped_count: 1 }
   * @output post('core/users/import/commit', { import_token: 42 }); step 'done'; success alert; imported emitted
   */
  it('commits the import and reports the result', () => {
    ctx.i18n.getValue.and.callFake((p: string) => (p === 'import-popup.import_done_message' ? '{imported}/{skipped}' : p));
    (ctx.dataHandler as any).upload.and.returnValue(of(validation));
    (ctx.dataHandler as any).post.and.returnValue(of({ queued: false, imported_count: 2, skipped_count: 1 }));
    let imported = 0;
    component.imported.subscribe(() => imported++);
    withFile();
    component.runValidation();
    component.confirmCommit();
    expect((ctx.dataHandler as any).post).toHaveBeenCalledWith('core/users/import/commit', { import_token: 42 });
    expect(component.step).toBe('done');
    expect(ctx.alert.open).toHaveBeenCalledWith('import-popup.import_done_title', '2/1', 'success');
    expect(imported).toBe(1);
  });

  /**
   * @description A queued (background) import shows the server message.
   * @input  commit returns { queued: true, message: 'Queued!' }
   * @output alert ('import-popup.import_queued_title', 'Queued!', 'success')
   */
  it('reports a queued import', () => {
    (ctx.dataHandler as any).upload.and.returnValue(of(validation));
    (ctx.dataHandler as any).post.and.returnValue(of({ queued: true, message: 'Queued!' }));
    withFile();
    component.runValidation();
    component.confirmCommit();
    expect(ctx.alert.open).toHaveBeenCalledWith('import-popup.import_queued_title', 'Queued!', 'success');
  });

  /**
   * @description Commit without a validation does nothing.
   * @input  confirmCommit() at the format step
   * @output post not called
   */
  it('confirmCommit() requires a validation', () => {
    component.confirmCommit();
    expect((ctx.dataHandler as any).post).not.toHaveBeenCalled();
  });

  /**
   * @description The template is downloaded from <api>/<resource>/import/template?format=…
   * @input  selectFormat('csv'); downloadTemplate(); server returns a blob
   * @output GET <base>/core/users/import/template?format=csv; link clicked with name 'import-sablona-core-users.csv'
   */
  it('downloads the import template', () => {
    const click = spyOn(HTMLAnchorElement.prototype, 'click');
    component.selectFormat('csv');
    component.downloadTemplate();
    const req = http.expectOne(r => r.url === `${environment.base_api_url}/core/users/import/template`);
    expect(req.request.params.get('format')).toBe('csv');
    req.flush(new Blob(['a;b']));
    expect(click).toHaveBeenCalled();
    expect((click.calls.mostRecent().object as HTMLAnchorElement).download).toBe('import-sablona-core-users.csv');
    expect(component.isDownloadingTemplate).toBeFalse();
  });

  /**
   * @description A missing template (404) shows "template not configured", other errors a generic message.
   * @input  template request answered 404, then 500
   * @output alerts 'import-popup.template_not_configured', then 'import-popup.template_download_failed'
   */
  it('reports template download errors', () => {
    component.selectFormat('csv');
    component.downloadTemplate();
    http.expectOne(() => true).flush(new Blob([]), { status: 404, statusText: 'Not Found' });
    component.downloadTemplate();
    http.expectOne(() => true).flush(new Blob([]), { status: 500, statusText: 'Error' });
    const messages = ctx.alert.open.calls.allArgs().map(a => a[1]);
    expect(messages).toEqual(['import-popup.template_not_configured', 'import-popup.template_download_failed']);
  });

  /**
   * @description The popup cannot be closed while validating or committing.
   * @input  isValidating true → onClose(); then false → onClose()
   * @output closed emitted once (only the second time)
   */
  it('cannot be closed while busy', () => {
    let closed = 0;
    component.closed.subscribe(() => closed++);
    component.isValidating = true;
    component.onClose();
    component.isValidating = false;
    component.onClose();
    expect(closed).toBe(1);
  });
  /**
   * @description Remaining wizard paths: scroll lock on open, file cleared, failed commit
   *   releases the button, overlay click closes only on the backdrop, texts of the section.
   * @input ngOnInit; clearSelectedFile; commit error; overlay click on the backdrop / inside.
   * @output lock(); file null; isCommitting false, step not done; closed once; t('x') 'import-popup.x'.
   */
  it('handles the remaining wizard paths', () => {
    component.ngOnInit();
    expect(TestBed.inject(ScrollLockService).lock).toHaveBeenCalled();
    withFile();
    component.clearSelectedFile();
    expect(component.selectedFile).toBeNull();

    (ctx.dataHandler as any).upload.and.returnValue(of(validation));
    (ctx.dataHandler as any).post.and.returnValue(throwError(() => new Error('x')));
    withFile();
    component.runValidation();
    component.confirmCommit();
    expect(component.isCommitting).toBeFalse();
    expect(component.step).not.toBe('done');

    let closed = 0;
    component.closed.subscribe(() => closed++);
    const backdrop = {};
    component.onOverlayClick({ target: backdrop, currentTarget: backdrop } as any);
    component.onOverlayClick({ target: {}, currentTarget: backdrop } as any);
    expect(closed).toBe(1);
    expect(component.t('x')).toBe('import-popup.x');
    expect(component.strings.title).toBe('import-popup.title');
  });
});
