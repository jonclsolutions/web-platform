/**
 * @file texts-broadcast.spec.ts
 * @path src/app/shared/utils/texts-broadcast.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the announcements of changed texts between tabs: a valid change
 *   reaches a listener (a real BroadcastChannel of the browser), an invalid message is dropped,
 *   stopping ends the listening.
 * @dependencies announceTexts, listenTexts, isTextsChange
 */

import { TEXTS_CHANNEL, TextsChange, announceTexts, isTextsChange, listenTexts } from './texts-broadcast';

describe('texts-broadcast', () => {
  /**
   * @description Only changes of a module (texts with a language code, or languages) are valid.
   * @input valid texts / languages; wrong kind, module, language, null
   * @output true ×2; false for the rest
   */
  it('accepts only valid changes', () => {
    expect(isTextsChange({ kind: 'texts', module: 'web', lang: 'cz' })).toBeTrue();
    expect(isTextsChange({ kind: 'languages', module: 'shop' })).toBeTrue();
    for (const bad of [null, 'x', { kind: 'other', module: 'web' }, { kind: 'texts', module: 'web' },
      { kind: 'texts', module: '../x', lang: 'cz' }, { kind: 'texts', module: 'web', lang: '<b>' }]) {
      expect(isTextsChange(bad)).toBeFalse();
    }
  });

  /**
   * @description An announcement reaches a listener of another channel; an invalid message on the
   *   channel is dropped; after stopping nothing arrives.
   * @input listen; announce texts web/en; a raw invalid message; stop; announce again
   * @output [{texts, web, en}] only
   */
  it('passes the changes to the listeners', async () => {
    const got: TextsChange[] = [];
    const stop = listenTexts(change => got.push(change));
    announceTexts({ kind: 'texts', module: 'web', lang: 'en' });
    const raw = new BroadcastChannel(TEXTS_CHANNEL);
    raw.postMessage({ kind: 'texts', module: 'web', lang: '"><script>' });
    raw.close();
    await new Promise(resolve => setTimeout(resolve, 50));
    stop();
    announceTexts({ kind: 'languages', module: 'web' });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(got).toEqual([{ kind: 'texts', module: 'web', lang: 'en' }]);
  });
});
