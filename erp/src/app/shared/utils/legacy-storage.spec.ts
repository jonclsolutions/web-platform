/**
 * @file legacy-storage.spec.ts
 * @path src/app/shared/utils/legacy-storage.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of migrateLegacyKey(): the former value moves to the new key once, an
 *   existing new value wins, a missing storage or a throwing one is ignored.
 * @dependencies Real localStorage (test keys cleared around tests).
 */

import { migrateLegacyKey } from './legacy-storage';

describe('migrateLegacyKey', () => {
  const clear = () => ['t_new', 't_old'].forEach(k => localStorage.removeItem(k));
  beforeEach(clear);
  afterEach(clear);

  /**
   * @description The former value moves to the new key and the former key is removed.
   * @input  t_old 'en'; migrate
   * @output t_new 'en', t_old null
   */
  it('moves the former value', () => {
    localStorage.setItem('t_old', 'en');
    migrateLegacyKey(localStorage, 't_new', 't_old');
    expect(localStorage.getItem('t_new')).toBe('en');
    expect(localStorage.getItem('t_old')).toBeNull();
  });

  /**
   * @description An existing new value is kept; nothing to move leaves the storage untouched.
   * @input  t_new 'cz' + t_old 'en'; migrate; migrate again without t_old
   * @output t_new 'cz', t_old null; unchanged
   */
  it('keeps an existing new value', () => {
    localStorage.setItem('t_new', 'cz');
    localStorage.setItem('t_old', 'en');
    migrateLegacyKey(localStorage, 't_new', 't_old');
    expect(localStorage.getItem('t_new')).toBe('cz');
    expect(localStorage.getItem('t_old')).toBeNull();
    migrateLegacyKey(localStorage, 't_new', 't_old');
    expect(localStorage.getItem('t_new')).toBe('cz');
  });

  /**
   * @description No storage or a throwing storage does not fail.
   * @input  undefined; a storage whose getItem throws
   * @output no exception
   */
  it('ignores a missing or broken storage', () => {
    const broken = { getItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(() => migrateLegacyKey(undefined, 't_new', 't_old')).not.toThrow();
    expect(() => migrateLegacyKey(broken, 't_new', 't_old')).not.toThrow();
  });
});
