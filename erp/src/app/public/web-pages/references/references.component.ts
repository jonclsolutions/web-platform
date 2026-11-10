/**
 * @file references.component.ts
 * @path src/app/public/web-pages/references/references.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description References page of the public web: accordion of the delivered projects. The
 *   projects come from the database (admin: web/edit-website, tab References) in all languages;
 *   the static texts of the page (headings, labels) from the `projects` translations.
 * @note A text missing in the current language shows 'Cannot load text'; an optional field
 *   (category, scope, role, result) empty in every language is not shown. Texts are plain text - their line
 *   breaks are kept (CSS `white-space: pre-line`), never HTML. A project with an image shows its
 *   key features in one column with the image next to them (under them on a narrow screen).
 * @dependencies
 * - BasePublicComponent (translations, current language), WebContentService (the projects),
 *   PublicDataService (URL of the image).
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { RouterModule } from '../../../shared/imports/web-providers';
import { BasePublicComponent } from '../../base-public.component';
import { WebContentService, localizedText, optionalText } from '../../../shared/services/web-content.service';

/** One project of the page in the current language. */
export interface ReferenceView {
  /** Id of the project (ids of the accordion elements). */
  id: number;
  name: string;
  duration: string | null;
  client: string | null;
  /** Optional fields: null = empty in every language (not shown). */
  category: string | null;
  size: string | null;
  role: string | null;
  result: string | null;
  description: string;
  features: string[];
  stack: { label: string; value: string }[];
  /** URL of the image, null = none. */
  image: string | null;
  /** Expanded in the accordion. */
  isActive: boolean;
}

@Component({
  selector: 'app-references',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './references.component.html',
  styleUrls: ['../shared-styles/theme.css', '../shared-styles/animations.css', '../shared-styles/cta.css', '../../../shared/styles/base.css', '../shared-styles/content-page.css', './references.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReferencesComponent extends BasePublicComponent {

  protected readonly translationKey = 'projects';
  projects: ReferenceView[] = [];

  private readonly webContent = inject(WebContentService);

  /** @description Loads the projects and follows the current language (expanded ones stay expanded). */
  protected override onInit(): void {
    combineLatest([this.webContent.references(), this.currentLanguage$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([references, lang]) => {
        const open = new Set(this.projects.filter(p => p.isActive).map(p => p.id));
        this.projects = (Array.isArray(references) ? references : []).map(reference => ({
          id: reference.id,
          name: localizedText(reference.name, lang),
          category: optionalText(reference.category, lang),
          duration: reference.duration || null,
          client: reference.client || null,
          size: optionalText(reference.size, lang),
          role: optionalText(reference.role, lang),
          result: optionalText(reference.result, lang),
          description: localizedText(reference.description, lang),
          features: (reference.features ?? []).map(feature => localizedText(feature, lang)),
          stack: (reference.stack ?? []).map(layer => ({ label: localizedText(layer.label, lang), value: localizedText(layer.value, lang) })),
          image: reference.image ? this.publicDataService.getStorageUrl(reference.image) : null,
          isActive: open.has(reference.id),
        }));
        this.cdr.markForCheck();
      });
  }

  toggleProject(project: ReferenceView): void {
    project.isActive = !project.isActive;
    this.cdr.markForCheck();
  }
}
