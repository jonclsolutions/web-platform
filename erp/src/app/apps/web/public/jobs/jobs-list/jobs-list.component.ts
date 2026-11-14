/**
 * @file jobs-list.component.ts
 * @path src/app/apps/web/public/jobs/jobs-list/jobs-list.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Careers page: the list of the open positions (title, short description) linking
 * to their detail. The positions come from the database (admin: web/edit-website, tab Jobs) in all
 * languages; the static texts of the page from the `jobs` translations.
 * @note A text missing in the current language shows 'Cannot load text' (WebContentService).
 * @dependencies
 * - BasePublicComponent (translations, site settings, current language), WebContentService.
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BasePublicComponent } from '../../../../../public/base-public.component';
import { JobItem } from './';
import { combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { WebContentService, localizedText } from '../../web-content.service';

@Component({
  selector: 'app-jobs-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './jobs-list.component.html',
  styleUrls: ['../../shared-styles/theme.css', '../../../../../shared/styles/base.css', '../../shared-styles/animations.css', '../../shared-styles/content-page.css', './jobs-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobsListComponent extends BasePublicComponent {
  
  protected readonly translationKey = 'jobs';
  protected override readonly loadSiteSettings = true;

  availableJobs: JobItem[] = [];

  private readonly webContent = inject(WebContentService);

  /** @description Loads the active positions and follows the current language. */
  protected override onInit(): void {
    combineLatest([this.webContent.jobs(), this.currentLanguage$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([jobs, lang]) => {
        this.availableJobs = (Array.isArray(jobs) ? jobs : []).map(job => ({
          id: job.slug,
          title: localizedText(job.title, lang),
          shortDescription: localizedText(job.summary, lang),
        }));
        this.cdr.markForCheck();
      });
  }
}
