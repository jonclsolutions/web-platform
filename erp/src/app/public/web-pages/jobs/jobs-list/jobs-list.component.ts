/**
 * @file jobs-list.component.ts
 * @path src/app/public/web-pages/jobs/jobs-list/jobs-list.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Presentational component for the careers page, listing available job openings based on dynamic content data.
 * @dependencies
 * - PublicDataService: Fetches global settings and storage paths.
 * - LocalizationService: Supplies localized job metadata.
 */

import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import * as Web from '../../../../shared/imports/web-providers';
import { JobItem } from './';
import { PublicDataService } from '../../../../shared/services/public-data.service';

/**
 * @description Component displaying a list of current career opportunities.
 * @usage Renders a list of jobs based on translated keys and metadata.
 * @note Implements automated translation parsing to build the job list dynamically.
 */
@Component({
  selector: 'app-jobs-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './jobs-list.component.html',
  styleUrls: ['./jobs-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobsListComponent implements OnInit, OnDestroy {
  t: any = null;
  availableJobs: JobItem[] = [];
  settings: any = null;
  socialLinks: any[] = [];

  private destroy$ = new Web.Subject<void>();

  constructor(
    private localizationService: Web.LocalizationService,
    private publicDataService: PublicDataService,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * @description Initializes subscriptions for localization and site settings.
   */
  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.jobs) {
          this.t = translations.jobs;
          this.loadJobs();
          this.cdr.markForCheck();
        }
      });

    this.publicDataService.get<{settings: any, social_links: any[]}>('public/legal/config')
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(res => {
        this.settings = res.settings;
        this.socialLinks = res.social_links;
        this.cdr.markForCheck();
      });
  }

  /**
   * @description Resolves storage asset URLs.
   * @param path The relative path to the asset.
   */
  getIconUrl(path: string): string {
    return this.publicDataService.getStorageUrl(path);
  }

  /**
   * @description Iterates through translation keys to build the current list of job openings.
   */
  private loadJobs(): void {
    const jobs: JobItem[] = [];
    for (let i = 1; i <= 10; i++) {
      const id    = this.t[`job_${i}_id`];
      const title = this.t[`job_${i}_title`];
      const desc  = this.t[`job_${i}_short_desc`];
      if (id && title && desc) {
        jobs.push({ id, title, shortDescription: desc });
      }
    }
    this.availableJobs = jobs;
  }

  /**
   * @description Cleans up RxJS subscriptions on destruction.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}