/**
 * @file card-selection.ts
 * @path src/app/apps/js-creator/admin/shared/card-selection.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Selection of cards of a list (multiselect of templates, blocks and sets): ids of
 *   the selected items, "select all" of the listed items, at most `max` items (the limit of a
 *   bulk action of the API). Plain state - the page marks its view for check after a change.
 * @usage `selection = new CardSelection(200); selection.toggle(item.id); selection.ids()`.
 * @dependencies none.
 */

export class CardSelection {
  private readonly selected = new Set<number>();

  /**
   * @param max Most selected items.
   */
  constructor(private readonly max: number) {}

  /** @description Number of selected items. */
  get size(): number {
    return this.selected.size;
  }

  /**
   * @description Whether an item is selected.
   * @param id Item.
   */
  has(id: number): boolean {
    return this.selected.has(id);
  }

  /**
   * @description Selects an item or takes it out of the selection (no more than `max`).
   * @param id Item.
   */
  toggle(id: number): void {
    if (this.selected.has(id)) this.selected.delete(id);
    else if (this.selected.size < this.max) this.selected.add(id);
  }

  /**
   * @description Whether every listed item is selected.
   * @param items Listed items.
   */
  allOf(items: readonly { id: number }[]): boolean {
    return items.length > 0 && items.every(item => this.selected.has(item.id));
  }

  /**
   * @description Selects every listed item (up to `max`), or none when all are selected.
   * @param items Listed items.
   */
  toggleAll(items: readonly { id: number }[]): void {
    if (this.allOf(items)) {
      this.selected.clear();
      return;
    }
    for (const item of items) {
      if (this.selected.size >= this.max) break;
      this.selected.add(item.id);
    }
  }

  /** @description Empties the selection. */
  clear(): void {
    this.selected.clear();
  }

  /** @description Selected ids in the order of selecting. */
  ids(): number[] {
    return [...this.selected];
  }
}
