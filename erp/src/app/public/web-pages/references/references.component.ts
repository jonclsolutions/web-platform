/**
 * @file references.component.ts
 * @path src/app/pages/references/references.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description Displays a portfolio of completed projects, dynamically parsed from localized project data.
 * @dependencies
 * - LocalizationService: Manages the project data source and internationalization.
 */

import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '../../../shared/imports/web-providers';
import * as Web from '../../../shared/imports/web-providers';

/**
 * @description Component for showcasing project references.
 * @usage Renders project cards that users can expand to see details.
 * @note Transforms raw dictionary-based translation data into an array for iterative DOM rendering.
 */
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

  /**
   * @description Subscribes to translation updates and maps project keys to structured objects.
   */
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

  /**
   * @description Toggles the expanded visibility state of a project entry.
   * @param project The project object containing state.
   */
  toggleProject(project: any): void {
    project.isActive = !project.isActive;
    this.cdr.markForCheck();
  }

  /**
   * @description Cleans up RxJS subscriptions on component destruction.
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}