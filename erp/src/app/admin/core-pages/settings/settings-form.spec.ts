/**
 * @file settings-form.spec.ts
 * @path src/app/admin/core-pages/settings/settings-form.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the pure helpers of the company profile form: unsaved-changes check
 *   of a tab, the body of a tab save, taking the stored values of a tab into the form, web
 *   addresses and the merge of loaded social links.
 * @dependencies settings-form.ts
 */

import { SiteSetting, SocialLink } from './';
import {
  isWebUrl, mergeSocialLinks, settingsForTab, settingsTabDirty, socialLinkDirty, takeSavedTab,
} from './settings-form';

describe('settings-form', () => {
  const stored = (): SiteSetting => ({
    company_name: 'RPSW', ico: '1', dic: 'CZ1', contact_email: 'a@b.cz', contact_phone: null, address: 'Praha',
    google_analytics_id: null, footer_text: 'F', logo_path: 'logo.png',
    brand_tagline: 'Tag', brand_tagline_i18n: { cz: 'Tag', en: '' },
    copyright_text: '©', copyright_text_i18n: { cz: '©', en: '' },
    hidden_fields: ['google_analytics_id', 'contact_phone'],
  });

  /**
   * @description A tab is dirty only by its own fields / checkboxes; null and '' are the same,
   *   a missing language is an empty text.
   * @input  copies of the stored values; company name changed; tagline en typed; GA switched on;
   *   phone null vs ''; tagline map without en
   * @output company dirty only on the name; brand dirty on the tagline; social dirty on the GA
   *   checkbox; '' phone and a missing empty language are not changes
   */
  it('checks the unsaved changes of one tab', () => {
    const saved = stored();
    const draft = { ...stored(), contact_phone: '', brand_tagline_i18n: { cz: 'Tag' } };
    expect(['company', 'brand', 'social'].map(tab => settingsTabDirty(draft, saved, tab as any))).toEqual([false, false, false]);

    expect(settingsTabDirty({ ...draft, company_name: 'X' }, saved, 'company')).toBeTrue();
    expect(settingsTabDirty({ ...draft, company_name: 'X' }, saved, 'brand')).toBeFalse();
    expect(settingsTabDirty({ ...draft, brand_tagline_i18n: { cz: 'Tag', en: 'Slogan' } }, saved, 'brand')).toBeTrue();
    expect(settingsTabDirty({ ...draft, hidden_fields: ['contact_phone'] }, saved, 'social')).toBeTrue();
    expect(settingsTabDirty({ ...draft, hidden_fields: ['contact_phone'] }, saved, 'company')).toBeFalse();
  });

  /**
   * @description The body of a tab save: stored values + the fields and checkboxes of the tab;
   *   the edits of the other tabs are not sent.
   * @input  draft with a new name (company), a new footer (brand) and DIČ switched off; save brand
   * @output body.footer_text 'New'; body.company_name 'RPSW' (stored); hidden_fields keep the
   *   stored company / social checkboxes (DIČ not hidden); i18n maps are copies
   */
  it('builds the body of one tab', () => {
    const saved = stored();
    const draft = { ...stored(), company_name: 'Draft', footer_text: 'New', hidden_fields: ['google_analytics_id', 'contact_phone', 'dic', 'footer_text'] as any };
    const body = settingsForTab(draft, saved, 'brand');
    expect(body.footer_text).toBe('New');
    expect(body.company_name).toBe('RPSW');
    expect(body.hidden_fields).toEqual(['google_analytics_id', 'contact_phone', 'footer_text']);
    expect(body.brand_tagline_i18n).not.toBe(draft.brand_tagline_i18n);
    expect(settingsForTab(draft, saved, 'company').hidden_fields).toEqual(['google_analytics_id', 'contact_phone', 'dic']);
  });

  /**
   * @description Taking the stored values of a tab into the form keeps the other tabs as typed.
   * @input  draft with a typed name and footer; stored values with another footer and logo; take brand
   * @output footer from the stored values, name stays typed, logo_path from the stored values
   */
  it('takes the stored values of one tab', () => {
    const saved = { ...stored(), footer_text: 'Stored', logo_path: 'new.png' };
    const draft = { ...stored(), company_name: 'Typed', footer_text: 'Typed', hidden_fields: ['dic'] as any };
    const form = takeSavedTab(draft, saved, 'brand');
    expect([form.company_name, form.footer_text, form.logo_path]).toEqual(['Typed', 'Stored', 'new.png']);
    expect(form.hidden_fields).toEqual(['dic']);
  });

  /**
   * @description Only full http(s) addresses are web addresses.
   * @input  https / http addresses, 'facebook.com', 'javascript:…', '', null
   * @output true, true, false, false, false, false
   */
  it('recognises web addresses', () => {
    expect(['https://facebook.com/x', 'http://x.cz', 'facebook.com', 'javascript:alert(1)', '', null].map(isWebUrl))
      .toEqual([true, true, false, false, false, false]);
  });

  /**
   * @description Loaded social links: dirty rows stay as typed (dropped when deleted meanwhile),
   *   new rows stay last, clean rows take the loaded version.
   * @input  rows 1 (clean), 2 (renamed), 3 (renamed, deleted on the server), a new row; loaded 1', 2', 4
   * @output [1' loaded, 2 typed, 4, new]; socialLinkDirty of a new row / icon / moved row true
   */
  it('merges loaded social links into the form', () => {
    const row = (id: number, name: string, position: number, savedName = name): SocialLink =>
      ({ id, name, url: 'https://x', icon_path: '', position, _key: id, _saved: { name: savedName, url: 'https://x', position } });
    const rows = [row(1, 'A', 1), row(2, 'B typed', 2, 'B'), row(3, 'C typed', 3, 'C'),
      { name: '', url: '', icon_path: '', position: 4, _key: 9, _isNew: true }];
    const loaded = [row(1, 'A loaded', 1), row(2, 'B', 2), row(4, 'D', 3)];
    expect(mergeSocialLinks(rows, loaded).map(link => link.name)).toEqual(['A loaded', 'B typed', 'D', '']);

    expect(socialLinkDirty(rows[3])).toBeTrue();
    expect(socialLinkDirty({ ...row(5, 'E', 1), _iconFile: new File([], 'i.png') })).toBeTrue();
    expect(socialLinkDirty({ ...row(5, 'E', 1), position: 2 })).toBeTrue();
    expect(socialLinkDirty({ ...row(5, 'E', 1), _saved: null })).toBeFalse();
  });
});
