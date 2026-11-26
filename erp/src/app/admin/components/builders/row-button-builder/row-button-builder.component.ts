/**
 * @file row-button-builder.component.ts
 * @path src/app/admin/components/builders/row-button-builder/row-button-builder.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Shared row of buttons of the administration - one look for page tabs, filters,
 *   view switches and language tabs: a grey pill with the buttons (icon + text, optional
 *   number / dot / flag), the active one is white. The page only passes the buttons and the
 *   active value and reacts to `selected`.
 * @usage
 *   <app-row-button-builder kind="tabs" [items]="tabs" [active]="activeTab" [ariaLabel]="…"
 *                           (selected)="switchTab($event)" />
 *   kind: `tabs` (role tablist, aria-selected), `filter` (role group, aria-pressed - default),
 *   `nav` (links with routerLink, aria-current="page"). size: `md` (page tabs) / `sm` (inside
 *   cards, language tabs). stretch: the buttons share the full width on mobile. phoneSelect
 *   (tabs): a drop-down instead of the row on a phone (≤ 640 px) and wider whenever the row does
 *   not fit its place (measured on resize - no tab is hidden behind the edge);
 *   othersHint = text of the "+n" on its trigger (other tabs have a number / dot).
 * @dependencies AdminIconComponent (icons), NgTemplateOutlet (content of a button), RouterLink (kind nav)
 */

import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostBinding, HostListener, Input, NgZone, OnChanges, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminIconComponent } from '../../admin-icon/admin-icon.component';
import { RowButton } from './row-button';

@Component({
  selector: 'app-row-button-builder',
  standalone: true,
  imports: [NgTemplateOutlet, AdminIconComponent, RouterLink],
  templateUrl: './row-button-builder.component.html',
  styleUrl: './row-button-builder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RowButtonBuilderComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** Buttons of the row (hidden ones are left out). */
  @Input() items: readonly RowButton[] = [];
  /** Value of the active button (null = none). */
  @Input() active: string | null | undefined = null;
  /** Semantics: tabs of a page, filter / switch, links to sub-pages. */
  @Input() kind: 'tabs' | 'filter' | 'nav' = 'filter';
  /** Size: md = page tabs, sm = inside a card / language tabs. */
  @Input() size: 'md' | 'sm' = 'md';
  /** The buttons share the full width on mobile. */
  @Input() stretch = false;
  /** Accessible name of the row. */
  @Input() ariaLabel = '';

  /**
   * Tabs: a drop-down instead of the row on a phone (≤ 640 px, CSS) and wider whenever the row
   * does not fit (`collapsed`, measured).
   */
  @Input() phoneSelect = false;
  /** Tabs with `phoneSelect`: text of the "+n" of the trigger - other tabs wait (number / dot). */
  @Input() othersHint = '';

  /** Value of the clicked button (not emitted for the active or a disabled one). */
  @Output() selected = new EventEmitter<string>();

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly cd = inject(ChangeDetectorRef);

  /** Trigger of the drop-down (focus comes back to it). */
  @ViewChild('selectTrigger') private selectTrigger?: ElementRef<HTMLButtonElement>;

  /** The list of the drop-down is open. */
  menuOpen = false;

  /** `phoneSelect`: the row does not fit its place - the drop-down replaces it (any width). */
  collapsed = false;

  /**
   * @description `phoneSelect` tabs take the whole width they are given (also inside a flex
   *   row) - the measured place then never depends on what is shown: a narrow drop-down would
   *   otherwise shrink the place and keep itself shown on a wide screen.
   */
  @HostBinding('class.rbb-host--select')
  get selectHost(): boolean {
    return this.phoneSelect && this.kind === 'tabs';
  }

  private readonly zone = inject(NgZone);
  private resizeObserver?: ResizeObserver;
  private measureFrame = 0;

  /** @description Starts watching the width of the place and of the row (`phoneSelect` tabs). */
  ngAfterViewInit(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => this.scheduleMeasure());
      this.resizeObserver.observe(this.host.nativeElement);
      const row = this.row();
      if (row) this.resizeObserver.observe(row);
    });
    this.scheduleMeasure();
  }

  /** @description New buttons / texts / numbers change the width of the row - measure again. */
  ngOnChanges(): void {
    this.scheduleMeasure();
  }

  /** @description Stops watching. */
  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.measureFrame);
  }

  /**
   * @description Compares the whole width of the row (measured also while it is hidden -
   *   `.rbb--measure` keeps its natural width) with its place; changes `collapsed` only when the
   *   answer changes. Not for the phone (there the CSS shows the drop-down anyway).
   */
  measure(): void {
    const row = this.row();
    if (!this.phoneSelect || this.kind !== 'tabs' || !row) {
      this.setCollapsed(false);
      return;
    }
    const place = this.host.nativeElement.clientWidth;
    if (!place || getComputedStyle(row).display === 'none') return;
    this.setCollapsed(row.scrollWidth > place + 1);
  }

  /** @description One measurement per frame (resize bursts). */
  private scheduleMeasure(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    cancelAnimationFrame(this.measureFrame);
    this.measureFrame = requestAnimationFrame(() => this.measure());
  }

  /**
   * @description Switches between the row and the drop-down; a closing drop-down closes its list.
   * @param value The row does not fit.
   */
  private setCollapsed(value: boolean): void {
    if (this.collapsed === value) return;
    this.zone.run(() => {
      this.collapsed = value;
      if (!value) this.menuOpen = false;
      this.cd.markForCheck();
    });
  }

  /** @returns The row of the buttons (tabs). */
  private row(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>(':scope > .rbb');
  }

  /** @description The active button (the trigger of the drop-down shows it). */
  get activeItem(): RowButton | undefined {
    return this.visibleItems.find(item => this.isActive(item));
  }

  /**
   * @description How many other (not active) tabs wait - have a number or a dot; the trigger
   *   shows "+n" (its own number / dot are the active tab's).
   */
  get othersWaiting(): number {
    return this.visibleItems.filter(item => !this.isActive(item) && (!!item.dot || (item.count !== null && item.count !== undefined && item.count !== 0))).length;
  }

  /** @description Opens / closes the list; opening moves the focus to the active tab. */
  toggleMenu(): void {
    this.menuOpen ? this.closeMenu(false) : this.openMenu();
  }

  /**
   * @description Picks a tab of the list and closes it. Picked by the keyboard (a click with
   *   `detail` 0 - Enter / Space) the focus goes back to the trigger; picked by a tap / mouse it
   *   does not (no focus ring around the trigger after a tap).
   * @param item Picked button.
   * @param event The click of the option.
   */
  choose(item: RowButton, event?: MouseEvent): void {
    this.select(item);
    const byKeyboard = !event || event.detail === 0;
    this.closeMenu(byKeyboard);
    if (!byKeyboard) (document.activeElement as HTMLElement | null)?.blur();
  }

  /**
   * @description Keyboard of the drop-down: arrows / Home / End move between the tabs (the arrow
   *   on the trigger opens the list), Escape closes it, Tab leaves it closed.
   * @param event Key pressed inside the drop-down.
   */
  onSelectKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.menuOpen) {
      event.preventDefault();
      this.closeMenu(true);
      return;
    }
    if (event.key === 'Tab') {
      this.closeMenu(false);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (!this.menuOpen) {
      this.openMenu();
      return;
    }
    const options = this.options();
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const last = options.length - 1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? last
      : event.key === 'ArrowDown' ? Math.min(last, index + 1) : Math.max(0, index - 1);
    options[next]?.focus();
  }

  /** @description A press outside the drop-down closes it. */
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: Event): void {
    if (this.menuOpen && !this.host.nativeElement.contains(event.target as Node)) {
      this.closeMenu(false);
    }
  }

  /** @description Opens the list and focuses the active tab once it is rendered. */
  private openMenu(): void {
    this.menuOpen = true;
    this.cd.markForCheck();
    setTimeout(() => {
      const options = this.options();
      (options.find(o => o.classList.contains('active')) ?? options[0])?.focus();
    });
  }

  /**
   * @description Closes the list.
   * @param refocus Move the focus back to the trigger (keyboard / a pick).
   */
  private closeMenu(refocus: boolean): void {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    this.cd.markForCheck();
    if (refocus) this.selectTrigger?.nativeElement.focus();
  }

  /** @returns The enabled options of the open list. */
  private options(): HTMLButtonElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLButtonElement>('.rbb-select-option:not(:disabled)'));
  }

  /** @description Visible buttons. */
  get visibleItems(): RowButton[] {
    return this.items.filter(item => !item.hidden);
  }

  /** @description Whether a button is the active one. */
  isActive(item: RowButton): boolean {
    return this.active === item.value;
  }

  /**
   * @description Click of a button - emits its value unless it is already active or disabled.
   * @param item Clicked button.
   */
  select(item: RowButton): void {
    if (item.disabled || this.isActive(item)) return;
    this.selected.emit(item.value);
  }
}
