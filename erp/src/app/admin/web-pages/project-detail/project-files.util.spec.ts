/**
 * @file project-files.util.spec.ts
 * @path src/app/admin/web-pages/project-detail/project-files.util.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the file helpers of the project sub-pages (approvals, updates):
 *   picking files against the upload rules (count, type, size, no rules) and the size label.
 * @dependencies project-files.util, testing/upload-rules-stub (rules equal to the API)
 */

import { formatProjectFileSize, pickProjectFiles } from './project-files.util';
import { TEST_UPLOAD_RULES } from '../../../../testing/upload-rules-stub';

describe('project-files.util', () => {
  const rules = TEST_UPLOAD_RULES.project_thread;
  const t = (key: string) => key;
  const file = (name: string, size = 10) => {
    const f = new File(['x'], name);
    Object.defineProperty(f, 'size', { value: size });
    return f;
  };

  /**
   * @description Allowed files are added to the chosen ones; a forbidden type and a too big file
   *   are skipped with the first reason; the limit of files stops adding.
   * @input  current [a.pdf]; picked b.PNG, virus.exe, big.zip (16 MB), c.txt; then 5 chosen + d.pdf
   * @output files a.pdf, b.PNG, c.txt; error 'attachment_error_type'; at the limit 'attachment_error_too_many', 5 files
   */
  it('checks picked files against the upload rules', () => {
    const picked = pickProjectFiles([file('a.pdf')], [file('b.PNG'), file('virus.exe'), file('big.zip', 16 * 1024 * 1024), file('c.txt')], rules, t);
    expect(picked.files.map(f => f.name)).toEqual(['a.pdf', 'b.PNG', 'c.txt']);
    expect(picked.error).toContain('attachment_error_type');

    const size = pickProjectFiles([], [file('big.zip', 16 * 1024 * 1024)], rules, t);
    expect(size.files).toEqual([]);
    expect(size.error).toBe('attachment_error_size');

    const five = ['1', '2', '3', '4', '5'].map(n => file(n + '.pdf'));
    const full = pickProjectFiles(five, [file('d.pdf')], rules, t);
    expect(full.files.length).toBe(5);
    expect(full.error).toBe('attachment_error_too_many');
  });

  /**
   * @description Without rules (API unreachable) the type is left to the server and the
   *   defaults apply (5 files, 10 MB).
   * @input  rules null; tool.exe; 11 MB file
   * @output tool.exe accepted; the 11 MB file refused with 'attachment_error_size'
   */
  it('uses the defaults without rules', () => {
    expect(pickProjectFiles([], [file('tool.exe')], null, t)).toEqual({ files: [jasmine.any(File)] as any, error: null });
    expect(pickProjectFiles([], [file('big.bin', 11 * 1024 * 1024)], null, t).error).toBe('attachment_error_size');
  });

  /**
   * @description Sizes in KB under 1 MB, otherwise MB with one decimal.
   * @input  0, 2048, 1572864
   * @output '0 KB', '2 KB', '1.5 MB'
   */
  it('formats file sizes', () => {
    expect([formatProjectFileSize(0), formatProjectFileSize(2048), formatProjectFileSize(1572864)]).toEqual(['0 KB', '2 KB', '1.5 MB']);
  });
});
