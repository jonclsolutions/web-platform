/**
 * @file import-dialog.component.spec.ts
 * @path src/app/apps/js-creator/admin/shared/import-dialog/import-dialog.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of ImportDialogComponent: only a .json file within the size limit that
 *   holds a package of JS Creator can be sent; a refusal of the API lists its paths; a success
 *   shows the counts and the renamed items and emits `imported`.
 * @dependencies ImportDialogComponent, admin-test-helpers.ts, TEST_UPLOAD_RULES.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ImportDialogComponent } from './import-dialog.component';
import { ImportSummary } from '../js-creator.models';
import { AdminTestContext, createAdminTestContext } from '../../../../../../testing/admin-test-helpers';

/**
 * @description Change event of a file input with one file.
 * @param file File.
 */
function chosen(file: File): Event {
  const input = document.createElement('input');
  input.type = 'file';
  Object.defineProperty(input, 'files', { value: [file] });
  return { target: input } as unknown as Event;
}

describe('ImportDialogComponent', () => {
  let fixture: ComponentFixture<ImportDialogComponent>;
  let component: ImportDialogComponent;
  let ctx: AdminTestContext;

  beforeEach(async () => {
    ctx = createAdminTestContext();
    await TestBed.configureTestingModule({ imports: [ImportDialogComponent], providers: ctx.providers }).compileComponents();
    fixture = TestBed.createComponent(ImportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * @description Wrong files are refused in the browser; nothing is sent.
   * @input pack.txt; broken JSON; JSON of another format
   * @output problems import_file_hint (20 MB), import_not_json, import_not_package; no file, no request
   */
  it('refuses wrong files before sending', async () => {
    await component.choose(chosen(new File(['{}'], 'pack.txt')));
    expect(component.problems[0].message).toBe('js-creator-shared.import_file_hint');
    await component.choose(chosen(new File(['{"format": '], 'pack.json')));
    expect(component.problems[0].message).toBe('js-creator-shared.import_not_json');
    await component.choose(chosen(new File(['{"format": "other"}'], 'pack.json')));
    expect(component.problems[0].message).toBe('js-creator-shared.import_not_package');
    expect(component.file).toBeNull();
    component.submit();
    expect(ctx.dataHandler.postQuietly).not.toHaveBeenCalled();
  });

  /**
   * @description A refusal of the API lists the paths of the errors.
   * @input valid file; 422 invalid_package with `templates.0.document.pages.0.layers.1.size`
   * @output problems: import_refused + the path with its message
   */
  it('lists the problems of a refused file', async () => {
    await component.choose(chosen(new File(['{"format": "js-creator"}'], 'pack.json')));
    ctx.dataHandler.postQuietly.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 422, error: { error_code: 'invalid_package', errors: { 'templates.0.document.pages.0.layers.1.size': ['Out of range.'] } },
    })) as never);
    component.submit();
    fixture.detectChanges();
    expect(component.problems.map(p => p.message)).toEqual(['js-creator-shared.import_refused', 'Out of range.']);
    expect(fixture.nativeElement.querySelector('.im-problems code').textContent).toContain('templates.0.document');

    ctx.dataHandler.postQuietly.and.returnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { error_code: 'quota_exceeded' } })) as never);
    component.submit();
    expect(component.problems[0].message).toBe('js-creator-shared.import_quota');
  });

  /**
   * @description A successful import shows its result and emits it.
   * @input valid file; answer 2 templates, 1 set, renamed template "Post" → "Post (2)"
   * @output quiet POST js-creator/images/import; `imported` with the summary; counts and the renamed row shown
   */
  it('imports a package', async () => {
    const summary: ImportSummary = {
      templates: 2, blocks: 0, sets: 1, assets: 0, fonts: 0, fonts_reused: 0,
      renamed: [{ type: 'template', from: 'Post', to: 'Post (2)' }], template_ids: [7, 8], block_ids: [],
    };
    ctx.dataHandler.postQuietly.and.returnValue(of(summary) as never);
    const imported = jasmine.createSpy('imported');
    component.imported.subscribe(imported);
    await component.choose(chosen(new File(['{"format": "js-creator"}'], 'pack.json')));
    component.submit();
    fixture.detectChanges();
    expect(ctx.dataHandler.postQuietly.calls.mostRecent().args[0]).toBe('js-creator/images/import');
    expect(imported).toHaveBeenCalledWith(summary);
    expect(component.resultRows).toEqual(['js-creator-shared.import_count_templates: 2', 'js-creator-shared.import_count_sets: 1']);
    expect(fixture.nativeElement.querySelector('.im-renamed').textContent).toContain('„Post“ → „Post (2)“');
  });
});
