/**
 * @file language-preference.spec.ts
 * @path src/app/shared/utils/language-preference.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the first-visit language: browser tag → translation code (Czech
 *   `cs` → `cz`, regions ignored), the first preferred language offered, the English default,
 *   the first offered language when English is missing, and the browser language list.
 * @dependencies none
 */

import { browserLanguages, languageCodeOfBrowserTag, pickInitialLanguage } from './language-preference';

describe('language preference', () => {
  /**
   * @description Browser tags map to translation codes by their primary subtag.
   * @input 'cs-CZ', 'CS', 'en-GB', 'de_AT', '', ' fr '.
   * @output 'cz', 'cz', 'en', 'de', '', 'fr'.
   */
  it('maps browser tags to translation codes', () => {
    expect(languageCodeOfBrowserTag('cs-CZ')).toBe('cz');
    expect(languageCodeOfBrowserTag('CS')).toBe('cz');
    expect(languageCodeOfBrowserTag('en-GB')).toBe('en');
    expect(languageCodeOfBrowserTag('de_AT')).toBe('de');
    expect(languageCodeOfBrowserTag('')).toBe('');
    expect(languageCodeOfBrowserTag(' fr ')).toBe('fr');
  });

  /**
   * @description The first browser language that is offered wins, in the browser's order.
   * @input offered [cz, en]; browser [de-DE, cs-CZ, en]; browser [en-US, cs].
   * @output 'cz'; 'en'.
   */
  it('picks the first preferred language that is offered', () => {
    expect(pickInitialLanguage(['cz', 'en'], ['de-DE', 'cs-CZ', 'en'])).toBe('cz');
    expect(pickInitialLanguage(['cz', 'en'], ['en-US', 'cs'])).toBe('en');
  });

  /**
   * @description No preferred language offered: English, then the first offered, then English
   *   when nothing is offered; the code keeps the spelling of the offered list.
   * @input [cz, en] + [fr]; [cz, de] + [fr]; [] + [cs]; [CZ, EN] + [cs-CZ].
   * @output 'en'; 'cz'; 'en'; 'CZ'.
   */
  it('falls back to English, then to the first language offered', () => {
    expect(pickInitialLanguage(['cz', 'en'], ['fr'])).toBe('en');
    expect(pickInitialLanguage(['cz', 'de'], ['fr'])).toBe('cz');
    expect(pickInitialLanguage([], ['cs'])).toBe('en');
    expect(pickInitialLanguage(['CZ', 'EN'], ['cs-CZ'])).toBe('CZ');
  });

  /**
   * @description The browser list comes from navigator.languages.
   * @input navigator.languages ['cs', 'en'].
   * @output ['cs', 'en'].
   */
  it('reads the browser languages', () => {
    spyOnProperty(navigator, 'languages').and.returnValue(['cs', 'en']);
    expect(browserLanguages()).toEqual(['cs', 'en']);
  });

  /**
   * @description Older browsers without a language list: navigator.language alone.
   * @input navigator.languages []; navigator.language 'de'.
   * @output ['de'].
   */
  it('falls back to navigator.language', () => {
    spyOnProperty(navigator, 'languages').and.returnValue([]);
    spyOnProperty(navigator, 'language').and.returnValue('de');
    expect(browserLanguages()).toEqual(['de']);
  });
});
