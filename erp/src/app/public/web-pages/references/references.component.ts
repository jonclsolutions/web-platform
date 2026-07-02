import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '../../../shared/imports/web-providers';
import * as Web from '../../../shared/imports/web-providers';

@Component({
  selector: 'app-references',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './references.component.html',
  styleUrl: './references.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReferencesComponent implements OnInit, OnDestroy {
  r: any = null;
  projects: any[] = [];

  private destroy$ = new Web.Subject<void>();

  constructor(
    private localizationService: Web.LocalizationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.projects) {
          this.r = translations.projects;
          this.projects = Object.keys(this.r)
            .filter(key => key.startsWith('project_'))
            .sort((a, b) => a.localeCompare(b))
            .map(key => ({
              ...this.r[key],
              id: key,
              isActive: false
            }));
          this.cdr.markForCheck();
        }
      });
  }

  toggleProject(project: any): void {
    project.isActive = !project.isActive;
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}