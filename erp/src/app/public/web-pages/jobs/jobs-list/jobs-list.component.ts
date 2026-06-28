import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common'; // Přidáno pro @if / @for
import { RouterModule } from '@angular/router';
import * as Web from '../../../../shared/imports/web-providers';
import { JobItem } from '../../components/interfaces/job-item';
import { PublicDataService } from '../../../../shared/services/public-data.service'; // PŘIDÁNO

@Component({
  selector: 'app-jobs-list',
  standalone: true,
  imports: [CommonModule, RouterModule], // Přidán CommonModule
  templateUrl: './jobs-list.component.html',
  styleUrls: ['./jobs-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobsListComponent implements OnInit, OnDestroy {
  t: any = null;
  availableJobs: JobItem[] = [];
  
  settings: any = null; // PŘIDÁNO
  socialLinks: any[] = []; // PŘIDÁNO

  private destroy$ = new Web.Subject<void>();

  constructor(
    private localizationService: Web.LocalizationService,
    private publicDataService: PublicDataService, // PŘIDÁNO
    private cdr: ChangeDetectorRef 
  ) {}

  ngOnInit(): void {
    // 1. Překlady
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.careers) {
          this.t = translations;
          this.loadJobs();
          this.cdr.markForCheck();
        }
      });

    // 2. Data ze serveru
    this.publicDataService.getSiteSettings()
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(res => {
        this.settings = res.settings;
        this.socialLinks = res.social_links;
        this.cdr.markForCheck();
      });
  }

  getIconUrl(path: string): string {
    return this.publicDataService.getStorageUrl(path);
  }

  private loadJobs(): void {
    const jobs: JobItem[] = [];
    for (let i = 1; i <= 10; i++) {
      const id = this.t.careers[`job_${i}_id`];
      const title = this.t.careers[`job_${i}_title`];
      const desc = this.t.careers[`job_${i}_short_desc`];
      if (id && title && desc) {
        jobs.push({ id, title, shortDescription: desc });
      }
    }
    this.availableJobs = jobs;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}