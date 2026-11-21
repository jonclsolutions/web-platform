/**
 * @file delivery-countries.spec.ts
 * @path src/app/apps/shop/shared/delivery-countries.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of delivery-countries.ts (audit U-02) - the country list, names in a
 *   language, options sorted by name and postal codes by country.
 * @dependencies none
 */

import { DELIVERY_COUNTRIES, countryName, countryOptions, isValidPostalCode } from './delivery-countries';

describe('delivery-countries', () => {
  /**
   * @description The list matches the API (EU 27 + CH, GB, IS, LI, NO), codes only once.
   * @input DELIVERY_COUNTRIES.
   * @output 32 unique two-letter codes containing CZ, SK, CH, NO.
   */
  it('lists the delivery countries of the API', () => {
    expect(DELIVERY_COUNTRIES.length).toBe(32);
    expect(new Set(DELIVERY_COUNTRIES).size).toBe(32);
    expect(DELIVERY_COUNTRIES.every(code => /^[A-Z]{2}$/.test(code))).toBeTrue();
    expect(['CZ', 'SK', 'CH', 'NO'].every(code => DELIVERY_COUNTRIES.includes(code))).toBeTrue();
  });

  /**
   * @description Names in the language of the application ('cz' = Czech); other values unchanged.
   * @input CZ / DE in cz and en; legacy "Czechia"; null.
   * @output Česko, Německo, Czechia, Germany; "Czechia"; ''.
   */
  it('names a country in a language', () => {
    expect([countryName('CZ', 'cz'), countryName('DE', 'cz')]).toEqual(['Česko', 'Německo']);
    expect([countryName('CZ', 'en'), countryName('DE', 'en')]).toEqual(['Czechia', 'Germany']);
    expect(countryName('Czechia', 'cz')).toBe('Czechia');
    expect(countryName(null, 'cz')).toBe('');
  });

  /**
   * @description Options sorted by the name in the language (Czech collation).
   * @input SK, AT, CZ in cz.
   * @output Česko, Rakousko, Slovensko.
   */
  it('sorts the options by name', () => {
    expect(countryOptions(['SK', 'AT', 'CZ'], 'cz')).toEqual([
      { code: 'CZ', name: 'Česko' }, { code: 'AT', name: 'Rakousko' }, { code: 'SK', name: 'Slovensko' }
    ]);
  });

  /**
   * @description Postal codes: CZ / SK three + two digits, other countries a general shape.
   * @input "110 00" / "11000" / "1100" in CZ; "811 01" in SK; "1010" / "SW1A 1AA" / "!" elsewhere.
   * @output valid, valid, invalid; valid; valid (AT), valid (GB), invalid.
   */
  it('checks postal codes by country', () => {
    expect([isValidPostalCode('110 00', 'CZ'), isValidPostalCode('11000', 'CZ'), isValidPostalCode('1100', 'CZ')]).toEqual([true, true, false]);
    expect(isValidPostalCode('811 01', 'SK')).toBeTrue();
    expect([isValidPostalCode('1010', 'AT'), isValidPostalCode('SW1A 1AA', 'GB'), isValidPostalCode('!', 'DE')]).toEqual([true, true, false]);
  });
});
