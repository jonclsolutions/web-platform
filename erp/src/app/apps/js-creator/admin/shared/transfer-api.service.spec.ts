/**
 * @file transfer-api.service.spec.ts
 * @path src/app/apps/js-creator/admin/shared/transfer-api.service.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of TransferApiService and its helpers: paths and bodies of the bulk
 *   actions, of the export and of the import (multipart, quietly), the download of a package as
 *   a .json file, the file names of an export and the text of a refused export.
 * @dependencies TransferApiService, exportFileName, exportErrorKey, admin-test-helpers.ts.
 */

import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { TransferApiService, exportErrorKey, exportFileName } from './transfer-api.service';
import { TransferPackage } from './js-creator.models';
import { AdminTestContext, createAdminTestContext } from '../../../../../testing/admin-test-helpers';
import cz from '../i18n/cz.json';
import en from '../i18n/en.json';

describe('TransferApiService', () => {
  let ctx: AdminTestContext;
  let service: TransferApiService;

  beforeEach(() => {
    ctx = createAdminTestContext();
    TestBed.configureTestingModule({ providers: ctx.providers });
    service = TestBed.inject(TransferApiService);
  });

  /**
   * @description Bulk action, export and import go to the paths of the section.
   * @input bulk blocks delete [1, 2]; export {set_ids: [3]}; import of pack.json
   * @output POST …/blocks/bulk {action, ids}; quiet POST …/export; quiet POST …/import with `file`
   */
  it('calls the API', () => {
    service.bulk('images', 'blocks', 'delete', [1, 2]).subscribe();
    expect(ctx.dataHandler.post).toHaveBeenCalledWith('js-creator/images/blocks/bulk', { action: 'delete', ids: [1, 2] });
    service.export('images', { set_ids: [3] }).subscribe();
    expect(ctx.dataHandler.postQuietly).toHaveBeenCalledWith('js-creator/images/export', { set_ids: [3] });
    service.import('images', new File(['{}'], 'pack.json', { type: 'application/json' })).subscribe();
    const [url, form] = ctx.dataHandler.postQuietly.calls.mostRecent().args as [string, FormData];
    expect(url).toBe('js-creator/images/import');
    expect((form.get('file') as File).name).toBe('pack.json');
  });

  /**
   * @description A package is saved as a .json file through a temporary link.
   * @input download of a package as "js-creator-sets"
   * @output a link with download "js-creator-sets.json" and a blob URL is clicked
   */
  it('downloads a package', () => {
    const click = spyOn(HTMLAnchorElement.prototype, 'click');
    spyOn(URL, 'createObjectURL').and.returnValue('blob:pkg');
    const pkg = { format: 'js-creator', version: 1, section: 'images', exported_at: '', templates: [], blocks: [], sets: [], assets: [], fonts: [] } as TransferPackage;
    service.download(pkg, 'js-creator-sets');
    expect(click).toHaveBeenCalled();
    const link = click.calls.mostRecent().object as HTMLAnchorElement;
    expect(link.download).toBe('js-creator-sets.json');
    expect(link.href).toBe('blob:pkg');
  });

  /**
   * @description File names: kind, slug of a single name without diacritics, date.
   * @input sets, "Léto – Akce 2026!", 5. 3. 2026; templates, several
   * @output js-creator-sets-leto-akce-2026-2026-03-05; js-creator-templates-2026-03-05
   */
  it('names the files and explains refusals', () => {
    const date = new Date(2026, 2, 5);
    expect(exportFileName('sets', 'Léto – Akce 2026!', date)).toBe('js-creator-sets-leto-akce-2026-2026-03-05');
    expect(exportFileName('templates', null, date)).toBe('js-creator-templates-2026-03-05');
    expect(exportErrorKey(new HttpErrorResponse({ status: 422, error: { error_code: 'export_too_large' } }))).toBe('export_too_large');
    expect(exportErrorKey(new HttpErrorResponse({ status: 500 }))).toBe('export_failed');
  });

  /**
   * @description Texts of the multiselect, export and import exist in both languages (a missing
   *   key would show "Cannot load text"); the logs know the new events and module.
   * @input keys of js-creator-shared used by the lists and the import popup; js-creator-logs
   * @output every key is a non-empty text in cz and en
   */
  it('has the texts in both languages', () => {
    const shared = ['select', 'select_all', 'selected', 'selection_label', 'clear_selection', 'export', 'export_one', 'delete', 'restore', 'destroy',
      'bulk_delete_title', 'bulk_delete_text', 'bulk_destroy_title', 'bulk_destroy_text', 'bulk_skipped_title', 'bulk_skipped_text',
      'export_failed_title', 'export_failed', 'export_too_large', 'import', 'import_title', 'import_text', 'import_names_hint', 'import_choose',
      'import_file_hint', 'import_not_json', 'import_not_package', 'import_running', 'import_submit', 'import_cancel', 'import_close',
      'import_refused', 'import_quota', 'import_error', 'import_done', 'import_count_templates', 'import_count_blocks', 'import_count_sets',
      'import_count_assets', 'import_count_fonts', 'import_count_fonts_reused', 'import_renamed', 'import_type_template', 'import_type_block',
      'import_type_set', 'import_type_asset', 'import_type_font'];
    for (const lang of [cz, en] as Record<string, Record<string, string>>[]) {
      for (const key of shared) expect(lang['js-creator-shared'][key]).withContext(key).toBeTruthy();
      for (const key of ['event_export', 'event_import', 'module_transfer']) expect(lang['js-creator-logs'][key]).withContext(key).toBeTruthy();
    }
  });
});
