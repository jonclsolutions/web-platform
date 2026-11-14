/**
 * @file dashboard-view.component.ts
 * @path src/app/admin/components/base-dashboard/dashboard-view.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Layout of every module dashboard (core, web …): header with the manual refresh,
 *   hero metric with its dropdown, comparison and distribution bars, quick navigation and the
 *   recent activity of the module log with its breakdown. The dashboard
 *   (BaseDashboardComponent) keeps the data and logic and passes itself in; its own extra
 *   sections are projected before the footer.
 * @usage `<app-dashboard-view [d]="this"> …extra sections… </app-dashboard-view>`
 * @dependencies BaseDashboardComponent, HasPermissionDirective, PageHelpComponent, RouterLink.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { BaseDashboardComponent } from './base-dashboard.component';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { PageHelpComponent } from '../page-help/page-help.component';

@Component({
  selector: 'app-dashboard-view',
  standalone: true,
  imports: [DatePipe, RouterLink, HasPermissionDirective, PageHelpComponent],
  templateUrl: './dashboard-view.component.html',
  styleUrls: ['../../shared-styles/dashboard.css', '../../shared-styles/dashboard-cards.css', './dashboard-view.component.css'],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class DashboardViewComponent {
  /** The dashboard shown (its data, texts and actions). */
  @Input({ required: true }) d!: BaseDashboardComponent;
}
