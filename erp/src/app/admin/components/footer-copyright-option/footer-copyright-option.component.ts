/**
 * @file footer-copyright-option.component.ts
 * @path src/app/admin/components/footer-copyright-option/footer-copyright-option.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Switch "show the copyright line in the footer" of the public pages of one
 *   application, on its texts page (Texty webu, Texty e-shopu): the copyright line is a text of
 *   the application (`footer.copyright_text`, edited with the other texts in every language); this
 *   switch hides or shows it in all languages. Saved at once (no Save button - one choice), the
 *   checkbox goes back when the save fails (the toast comes from DataHandler).
 * @usage `<app-footer-copyright-option textsOptions endpoint="web/settings/footer" [canUpdate]="canUpdate" />`
 *   inside `<app-translation-editor-view>` (slot `[textsOptions]` above the list of the texts).
 * @note A hidden text is not counted as missing (the API: AppManifest::hiddenTextKeys(); the
 *   editor: `shownChange` → setTextHidden()); a change refreshes the notifications (the dots).
 * @dependencies DataHandler, AdminLocalizationService (section translation-editor),
 *   AdminNotificationsService
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataHandler } from '../../../core/services/data-handler.service';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';
import { AdminNotificationsService } from '../../../core/services/admin-notifications.service';

/** Answer of the footer options endpoint of an application. */
export interface FooterOptions {
  show_footer_copyright: boolean;
}

/** How long the "Uloženo" mark stays (ms). */
const SAVED_MARK_MS = 2000;

@Component({
  selector: 'app-footer-copyright-option',
  standalone: true,
  templateUrl: './footer-copyright-option.component.html',
  styleUrl: './footer-copyright-option.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterCopyrightOptionComponent implements OnInit {
  /** Footer options endpoint of the application (e.g. `web/settings/footer`). */
  @Input({ required: true }) endpoint = '';
  /** The user may change it (the update permission of the texts page). */
  @Input() canUpdate = false;
  /** The stored state (after the load and after every saved change). */
  @Output() shownChange = new EventEmitter<boolean>();

  private readonly dataHandler = inject(DataHandler);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(AdminNotificationsService);
  readonly i18n = inject(AdminLocalizationService);

  /** The copyright line is shown (null = not loaded yet). */
  shown: boolean | null = null;
  /** A save is running. */
  saving = false;
  /** The "Uloženo" mark is shown. */
  saved = false;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @param key Key of the section `translation-editor`.
   * @returns Translated text.
   */
  t(key: string): string {
    return this.i18n.getValue(`translation-editor.${key}`);
  }

  /** @description Loads the option; redraws on a switch of the admin language. */
  ngOnInit(): void {
    this.i18n.translations$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cd.markForCheck());
    this.destroyRef.onDestroy(() => { if (this.savedTimer) clearTimeout(this.savedTimer); });
    this.dataHandler.get<FooterOptions>(this.endpoint).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.shown = res?.show_footer_copyright !== false;
        this.shownChange.emit(this.shown);
        this.cd.markForCheck();
      },
      error: () => {},
    });
  }

  /**
   * @description Saves the new choice at once; a failed save puts the checkbox back.
   * @param shown New state of the checkbox.
   */
  toggle(shown: boolean): void {
    if (this.saving || !this.canUpdate || this.shown === null) return;
    const previous = this.shown;
    this.shown = shown;
    this.saving = true;
    this.saved = false;
    this.cd.markForCheck();
    this.dataHandler.put<FooterOptions>(this.endpoint, { show_footer_copyright: shown }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.shown = res?.show_footer_copyright ?? shown;
        this.shownChange.emit(this.shown);
        this.notifications.refresh(); // a hidden text is not counted as missing any more
        this.saving = false;
        this.saved = true;
        if (this.savedTimer) clearTimeout(this.savedTimer);
        this.savedTimer = setTimeout(() => { this.saved = false; this.cd.markForCheck(); }, SAVED_MARK_MS);
        this.cd.markForCheck();
      },
      error: () => {
        this.shown = previous;
        this.saving = false;
        this.cd.markForCheck();
      },
    });
  }
}
