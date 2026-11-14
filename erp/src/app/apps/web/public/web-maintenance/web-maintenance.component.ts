/**
 * @file web-maintenance.component.ts
 * @path src/app/apps/web/public/web-maintenance/web-maintenance.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Maintenance page of the public web - the shared page of BaseMaintenanceComponent
 * (same look and language dropdown as the e-shop one); returns to /home once the web is active.
 * @dependencies
 * - BaseMaintenanceComponent: template, languages, status check.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, map } from 'rxjs';
import { BaseMaintenanceComponent } from '../../../../public/shared/maintenance/base-maintenance.component';

@Component({
  selector: 'app-web-maintenance',
  standalone: true,
  imports: [RouterLink, UpperCasePipe],
  templateUrl: '../../../../public/shared/maintenance/maintenance-page.component.html',
  styleUrls: ['../../../../public/shared-styles/maintenance.css', './web-maintenance.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WebMaintenanceComponent extends BaseMaintenanceComponent {
  protected readonly translationKey = 'web_maintenance';
  /** Outside the web layout - the texts of the web. */
  protected override readonly translationModule = 'web';
  protected readonly activeUrl = '/home';

  /** @description Web status of the API. */
  protected isSectionActive(): Observable<boolean> {
    return this.publicDataService.getFresh<{ is_web_active: boolean }>('web/public/status').pipe(map(res => !!res?.is_web_active));
  }
}
