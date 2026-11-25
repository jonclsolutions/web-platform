/**
 * @file table-cards.spec.ts
 * @path src/app/admin/components/builders/table-cards.spec.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the layout of the phone cards of the admin tables: the title, the
 *   labels, the date and the short values chosen from the columns, and when a value shows its
 *   header.
 * @dependencies none
 */

import { CARD_META_MAX, cardLayoutOf, cardMetaNeedsLabel, primaryColumnOf } from './table-cards';

describe('table cards', () => {
  const keys = (cols: { key: string }[]) => cols.map(col => col.key);

  /**
   * @description Automatic layout: the main column is the title (primary flag, else the first
   *   non-ID column), the avatar the picture, columns with tones the labels, the first date the
   *   date; values: not the ID, not yes / no / counts, not a second date, at most CARD_META_MAX.
   * @input  leads-like columns (id, subject, status+tones, salesman, last contact date, created
   *   date, count, boolean, note, avatar)
   * @output title subject_name; thumb avatar; badges status; date last_contact_date; meta
   *   salesman_name + note (created_at, count and boolean left out)
   */
  it('picks the parts of a card automatically', () => {
    const layout = cardLayoutOf([
      { key: 'id', header: 'ID', type: 'text' },
      { key: 'subject_name', header: 'Subject', type: 'text' },
      { key: 'status', header: 'Status', type: 'text', tones: { new: 'info' } },
      { key: 'salesman_name', header: 'Salesman', type: 'text' },
      { key: 'last_contact_date', header: 'Last contact', type: 'date' },
      { key: 'created_at', header: 'Created', type: 'date' },
      { key: 'unread', header: 'Unread', type: 'count' },
      { key: 'is_active', header: 'Active', type: 'boolean' },
      { key: 'note', header: 'Note', type: 'text' },
      { key: 'avatar_url', header: 'Photo', type: 'avatar' },
    ] as any);
    expect([keys(layout.titles), layout.thumb?.key, keys(layout.badges), layout.date?.key, keys(layout.meta)])
      .toEqual([['subject_name'], 'avatar_url', ['status'], 'last_contact_date', ['salesman_name', 'note']]);
    expect(layout.meta.length).toBeLessThanOrEqual(CARD_META_MAX);
  });

  /**
   * @description `mobile` overrides: several 'title' columns are joined (surname + name); 'meta'
   *   columns come first and may be a type left out otherwise; false hides a column.
   * @input  customers-like columns with last_name / first_name 'title', a 'meta' price, phone false
   * @output titles [last_name, first_name]; meta [price, email]; phone not on the card
   */
  it('follows the mobile overrides of the columns', () => {
    const layout = cardLayoutOf([
      { key: 'id', header: 'ID', type: 'text' },
      { key: 'last_name', header: 'Surname', type: 'text', mobile: 'title' },
      { key: 'first_name', header: 'Name', type: 'text', mobile: 'title' },
      { key: 'email', header: 'E-mail', type: 'text' },
      { key: 'phone', header: 'Phone', type: 'text', mobile: false },
      { key: 'price', header: 'Price', type: 'currency', mobile: 'meta' },
    ] as any);
    expect([keys(layout.titles), keys(layout.meta)]).toEqual([['last_name', 'first_name'], ['price', 'email']]);
    expect(primaryColumnOf([{ key: 'id', type: 'text' }, { key: 'name', type: 'text', primary: true }] as any)?.key).toBe('name');
  });

  /**
   * @description Values that tell what they are (e-mail, phone, price, date, link) have no
   *   header on the card; others have it.
   * @input  contact_email, phone, price (currency), url (link), note
   * @output false ×4, true
   */
  it('shows a header only where the value needs it', () => {
    expect([
      cardMetaNeedsLabel({ key: 'contact_email', type: 'text' } as any),
      cardMetaNeedsLabel({ key: 'phone', type: 'text' } as any),
      cardMetaNeedsLabel({ key: 'price', type: 'currency' } as any),
      cardMetaNeedsLabel({ key: 'url', type: 'link' } as any),
      cardMetaNeedsLabel({ key: 'note', type: 'text' } as any),
    ]).toEqual([false, false, false, false, true]);
  });
});
