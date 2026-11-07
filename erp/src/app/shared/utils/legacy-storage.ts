/**
 * @file legacy-storage.ts
 * @path src/app/shared/utils/legacy-storage.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Moves a browser storage value from its former brand-specific key ('rpsw_…') to
 * the neutral key of the application, so a visitor keeps the cookie consent, the chosen language
 * or the cached language list after the rename.
 * @dependencies none
 */

/**
 * @description Copies the value of `legacyKey` to `key` when `key` has no value yet, then removes
 * `legacyKey`. Safe without storage (private mode, tests without a DOM): errors are ignored.
 * @param storage localStorage / sessionStorage.
 * @param key Current key.
 * @param legacyKey Former key.
 * @usage `migrateLegacyKey(localStorage, 'jsw_cookie_consent', 'rpsw_cookie_consent')` before
 *   the first read of `key`.
 */
export function migrateLegacyKey(storage: Storage | undefined, key: string, legacyKey: string): void {
  try {
    if (!storage) return;
    const legacy = storage.getItem(legacyKey);
    if (legacy === null) return;
    if (storage.getItem(key) === null) storage.setItem(key, legacy);
    storage.removeItem(legacyKey);
  } catch {
    // Storage unavailable - nothing to move.
  }
}
