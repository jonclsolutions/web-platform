/**
 * @file legal-document-sections.component.ts
 * @path src/app/public/legal/legal-document-sections/legal-document-sections.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The sections of a legal document (GET public/legal/{slug}): heading, content as
 *   plain text (new lines kept, never HTML), subsections with their bullet lists. Colours come from the
 *   `--legal-*` custom properties of the host page (dark / light look).
 * @usage `<app-legal-document-sections [sections]="doc.sections">`
 * @note No view encapsulation: the styles are scoped by `.legal-sections` (shared by the dark and
 *   light pages through their `--legal-*` custom properties).
 */

import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';

/** @description Subsection of a legal document section. */
export interface LegalSubsection {
  id: number | string;
  heading: string;
  text?: string | null;
  list?: string[] | null;
}

/** @description Section of a legal document. */
export interface LegalSection {
  id: number | string;
  heading: string;
  content: string;
  subsections?: LegalSubsection[] | null;
}

@Component({
  selector: 'app-legal-document-sections',
  standalone: true,
  templateUrl: './legal-document-sections.component.html',
  styleUrl: './legal-document-sections.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalDocumentSectionsComponent {
  /** Sections of the document in their order. */
  @Input() sections: LegalSection[] = [];
}
