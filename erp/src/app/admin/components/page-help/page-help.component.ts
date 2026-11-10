/**
 * @file page-help.component.ts
 * @path src/app/admin/components/page-help/page-help.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Help button ("?") in the header of an admin page: opens the page of the
 *   knowledge base about that admin page - `data.help` of the page route
 *   (`admin-routing.module.ts`), e.g. core/administrators -> /admin/intranet/knowledge-base/administrators.
 * @dependencies
 * - ActivatedRoute: route of the page the button is placed in (optional - nothing is shown without it).
 * - AdminLocalizationService: tooltip text (`page-help.title`).
 */

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminLocalizationService } from '../../../core/services/admin-localization.service';

/** Home of the knowledge base (internal manual of the administration). */
export const KNOWLEDGE_BASE_URL = '/admin/intranet/knowledge-base';

/**
 * @description Renders the "?" link to the knowledge base page of the current admin page; a page
 *   route without a (valid) `data.help` renders nothing.
 * @usage `<app-page-help></app-page-help>` at the right end of the page header (next to "Actions").
 */
@Component({
  selector: 'app-page-help',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (link) {
      <a class="page-help-btn" [routerLink]="link" [title]="title" [attr.aria-label]="title">?</a>
    }
  `,
  styles: [`
    :host { display: inline-flex; flex-shrink: 0; }
    .page-help-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      border: 1px solid var(--color-zinc-200);
      background: var(--color-zinc-100);
      color: var(--color-zinc-700);
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      line-height: 1;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .page-help-btn:hover { background: var(--color-zinc-200); }
    .page-help-btn:focus-visible { outline: 2px solid var(--color-zinc-900); outline-offset: 2px; }
  `]
})
export class PageHelpComponent {
  private readonly i18n = inject(AdminLocalizationService);

  /** Knowledge base page of the current admin page, null = no help topic (button hidden). */
  readonly link: string | null;

  constructor() {
    const help = inject(ActivatedRoute, { optional: true })?.snapshot?.data?.['help'];
    this.link = typeof help === 'string' && /^[a-z0-9-]+$/.test(help) ? `${KNOWLEDGE_BASE_URL}/${help}` : null;

    // Re-render the tooltip after a switch of the admin language.
    const cdr = inject(ChangeDetectorRef);
    const subscription = this.i18n.translations$.subscribe(() => cdr.markForCheck());
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  /** Tooltip / accessible name of the button. */
  get title(): string {
    return this.i18n.getValue('page-help.title');
  }
}
