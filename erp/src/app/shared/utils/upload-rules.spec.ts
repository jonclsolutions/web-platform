/**
 * @file upload-rules.spec.ts
 * @path src/app/shared/utils/upload-rules.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the attachment rule helpers: extension of a file name, the type
 *   check (an empty list allows everything - the API decides), the label of the allowed types
 *   and the detection of a 422 refusal of an attachment.
 */

import { extensionsLabel, fileExtension, isAttachmentRejection, isExtensionAllowed } from './upload-rules';

describe('upload-rules', () => {
  /**
   * @description The extension is lower case and without the dot; a name without one, a hidden
   *   file and a trailing dot give ''.
   * @input 'Report.PDF'; 'archive.tar.gz'; 'README'; '.env'; 'name.'.
   * @output 'pdf'; 'gz'; ''; ''; ''.
   */
  it('reads the extension of a file name', () => {
    expect(fileExtension('Report.PDF')).toBe('pdf');
    expect(fileExtension('archive.tar.gz')).toBe('gz');
    expect(fileExtension('README')).toBe('');
    expect(fileExtension('.env')).toBe('');
    expect(fileExtension('name.')).toBe('');
  });

  /**
   * @description Only listed extensions pass (case-insensitive); svg / xml / no extension are
   *   refused; an empty list (rules not known) refuses nothing.
   * @input list ['pdf', 'png'] with 'a.PDF', 'logo.svg', 'feed.xml', 'README'; empty list with 'x.xml'.
   * @output true, false, false, false; true.
   */
  it('checks the extension against the list', () => {
    const list = ['pdf', 'png'];
    expect(isExtensionAllowed('a.PDF', list)).toBeTrue();
    expect(isExtensionAllowed('logo.svg', list)).toBeFalse();
    expect(isExtensionAllowed('feed.xml', list)).toBeFalse();
    expect(isExtensionAllowed('README', list)).toBeFalse();
    expect(isExtensionAllowed('x.xml', [])).toBeTrue();
  });

  /**
   * @description The label of the allowed types (shown in a type error) is upper case, comma separated.
   * @input ['pdf', 'docx']; [].
   * @output 'PDF, DOCX'; ''.
   */
  it('builds the label of the allowed types', () => {
    expect(extensionsLabel(['pdf', 'docx'])).toBe('PDF, DOCX');
    expect(extensionsLabel([])).toBe('');
  });

  /**
   * @description Only a 422 with an error of an attachment field counts as a refused attachment.
   * @input 422 with attachments.0 / attachments / cv_file / attachment; 422 with email; 500; null.
   * @output true ×4; false ×3.
   */
  it('detects a 422 refusal of an attachment', () => {
    const e422 = (key: string) => ({ status: 422, error: { errors: { [key]: ['x'] } } });
    expect(isAttachmentRejection(e422('attachments.0'))).toBeTrue();
    expect(isAttachmentRejection(e422('attachments'))).toBeTrue();
    expect(isAttachmentRejection(e422('cv_file'))).toBeTrue();
    expect(isAttachmentRejection(e422('attachment'))).toBeTrue();
    expect(isAttachmentRejection(e422('email'))).toBeFalse();
    expect(isAttachmentRejection({ status: 500, error: { errors: { attachment: ['x'] } } })).toBeFalse();
    expect(isAttachmentRejection(null)).toBeFalse();
    expect(isAttachmentRejection({ status: 422 })).toBeFalse();
  });
});
