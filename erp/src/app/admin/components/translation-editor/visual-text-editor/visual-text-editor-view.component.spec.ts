/**
 * @file visual-text-editor-view.component.spec.ts
 * @path src/app/admin/components/translation-editor/visual-text-editor/visual-text-editor-view.component.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the path check of the frame of the visual text editor (only pages of
 *   the own website). The editor itself is tested with the page of the website
 *   (web-text-editor.component.spec.ts).
 * @dependencies safeFramePath
 */

import { safeFramePath } from './visual-text-editor-view.component';

describe('safeFramePath', () => {
  /**
   * @description Paths of the own website pass (with a query), anything that could leave it -
   *   another host, a protocol, a backslash trick, whitespace, nothing - becomes the home page.
   * @input '/', '/faq', '/jobs/1?x=2'; '//evil.example', '/\\evil', 'https://evil.example',
   *   'javascript:alert(1)', '/a b', '', null
   * @output the same for the first three, '/' for the rest
   */
  it('lets through only paths of the own website', () => {
    for (const path of ['/', '/faq', '/jobs/1?x=2']) {
      expect(safeFramePath(path)).toBe(path);
    }
    for (const path of ['//evil.example', '/\\evil', 'https://evil.example', 'javascript:alert(1)', '/a b', '', null, undefined]) {
      expect(safeFramePath(path as string)).toBe('/');
    }
  });
});
