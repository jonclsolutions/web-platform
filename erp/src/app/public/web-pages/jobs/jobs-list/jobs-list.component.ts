import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BasePublicComponent } from '../../../base-public.component';
import { JobItem } from './';

@Component({
  selector: 'app-jobs-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './jobs-list.component.html',
  styleUrls: ['./jobs-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobsListComponent extends BasePublicComponent {
  
  protected readonly translationKey = 'jobs';
  protected override readonly loadSiteSettings = true;

  availableJobs: JobItem[] = [];

  // Hook volaný automaticky po načtení překladů
  protected override onTranslationsLoaded(): void {
    this.loadJobs();
  }

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
}