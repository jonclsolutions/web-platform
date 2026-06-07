import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';

import { RouterModule } from '@angular/router';

// Tvůj hromadný import pro služby a RxJS nástroje
import * as Web from '../../../../shared/imports/web-providers';
import { JobItem } from '../../components/interfaces/job-item';


@Component({
  selector: 'app-jobs-list',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './jobs-list.component.html',
  styleUrls: ['./jobs-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobsListComponent implements OnInit, OnDestroy {
  t: any = null;
  availableJobs: JobItem[] = [];

  ig_icon: string = 'assets/images/icons/ig.png';
  email_icon: string = 'assets/images/icons/email.png';

  private destroy$ = new Web.Subject<void>();

  constructor(
    private localizationService: Web.LocalizationService,
    private cdr: ChangeDetectorRef 
  ) {}

  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.careers) {
          this.t = translations;
          this.loadJobs();
          this.cdr.markForCheck();
        }
      });
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