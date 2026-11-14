/**
 * @file legal-document-dialog.component.ts
 * @path src/app/public/legal/legal-document-dialog/legal-document-dialog.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Modal window with a legal document (privacy policy, terms of service …) for public
 *   pages outside a public area with its own legal pages (e.g. the order form of the project
 *   portal): loads the document in the language (LegalDocsService, cached), shows its title, date
 *   of the last update and sections; closes with the button, the backdrop or Escape. The page
 *   behind does not scroll while it is open (ScrollLockService). Light look.
 * @usage `<app-legal-document-dialog slug="gdpr" [lang]="lang" [heading]="…" [lastUpdateLabel]="…"
 *   [closeLabel]="…" [errorText]="…" (closed)="…">`
 * @dependencies LegalDocsService, ScrollLockService, LegalDocumentSectionsComponent.
 */

import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, HostListener, Input, OnChanges,
  OnDestroy, OnInit, Output, inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LegalDocsService } from '../../../shared/services/legal-docs.service';
import { ScrollLockService } from '../../../core/services/scroll-lock.service';
import { LegalDocumentSectionsComponent, LegalSection } from '../legal-document-sections/legal-document-sections.component';

/** @description Legal document as GET public/legal/{slug} returns it. */
interface LegalDocument {
  last_update_date?: string;
  sections?: LegalSection[];
}

@Component({
  selector: 'app-legal-document-dialog',
  standalone: true,
  imports: [LegalDocumentSectionsComponent],
  templateUrl: './legal-document-dialog.component.html',
  styleUrl: './legal-document-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalDocumentDialogComponent implements OnInit, OnChanges, OnDestroy {
  /** Slug of the document ('gdpr', 'tos', 'cookies'). */
  @Input({ required: true }) slug!: string;
  /** Language of the document. */
  @Input({ required: true }) lang!: string;
  /** Title of the window (translated by the host page). */
  @Input() heading = '';
  /** Label before the date of the last update. */
  @Input() lastUpdateLabel = '';
  /** Text of the close button (also its accessible name). */
  @Input() closeLabel = '';
  /** Text shown when the document cannot be loaded. */
  @Input() errorText = '';
  /** The user closed the window. */
  @Output() closed = new EventEmitter<void>();

  /** Loaded document (null while loading). */
  doc: LegalDocument | null = null;
  /** The document could not be loaded. */
  failed = false;

  private readonly legalDocs = inject(LegalDocsService);
  private readonly scrollLock = inject(ScrollLockService);
  private readonly cd = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  /** @description Locks the page scroll while the window is open. */
  ngOnInit(): void {
    this.scrollLock.lock();
  }

  /** @description (Re)loads the document for its slug and language. */
  ngOnChanges(): void {
    this.doc = null;
    this.failed = false;
    this.legalDocs.getDocument(this.slug, this.lang)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(doc => {
        this.doc = doc;
        this.failed = !doc;
        this.cd.markForCheck();
      });
  }

  /** @description Unlocks the page scroll. */
  ngOnDestroy(): void {
    this.scrollLock.unlock();
  }

  /** @description Escape closes the window. */
  @HostListener('document:keydown.escape')
  close(): void {
    this.closed.emit();
  }
}
