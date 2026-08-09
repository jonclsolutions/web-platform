/**
 * @file dashboard.component.ts
 * @path src/app/admin/core-pages/dashboard/dashboard.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Placeholder landing page for the new "Core" admin module (system-wide
 *   settings shared across Web and Shop: legal docs, accounts, roles, company info,
 *   external links). Currently static welcome text - will be replaced with real
 *   summary widgets once the Core module's own metrics are defined.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * @description Landing page shown at /admin/core (default redirect target). Purely
 *   presentational placeholder for now.
 * @usage Routed as the default child of the 'core' route group in admin-routing.module.ts.
 */
@Component({
  selector: 'app-core-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoreDashboardComponent {}
