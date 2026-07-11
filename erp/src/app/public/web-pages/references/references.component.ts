/**
 * @file references.component.ts
 * @path src/app/public/web-pages/references/references.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '../../../shared/imports/web-providers';
import { BasePublicComponent } from '../../base-public.component';

@Component({
  selector: 'app-references',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './references.component.html',
  styleUrl: './references.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReferencesComponent extends BasePublicComponent {

  protected readonly translationKey = 'projects';
  
  projects: any[] = [];

  // Hook volaný automaticky po načtení překladů z bázové třídy
  protected override onTranslationsLoaded(): void {
    this.projects = Object.keys(this.t)
      .filter(key => key.startsWith('project_'))
      .sort((a, b) => a.localeCompare(b))
      .map(key => ({
        ...this.t[key],
        id: key,
        isActive: false
      }));
  }

  toggleProject(project: any): void {
    project.isActive = !project.isActive;
    this.cdr.markForCheck();
  }
}