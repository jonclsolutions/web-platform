/**
 * @file not-found.component.ts
 * @path src/app/public/web-pages/not-found/not-found.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { BasePublicComponent } from '../../base-public.component';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotFoundComponent extends BasePublicComponent {
  
  protected readonly translationKey = 'not_found';
  
  icon_path: string = "/erp/src/assets/images/svg/not-found.svg";

  private router = inject(Router);
  attemptedUrl: string = '';

  protected override onInit(): void {
    const navigation = this.router.getCurrentNavigation();
    
    if (navigation && navigation.previousNavigation) {
      this.attemptedUrl = navigation.previousNavigation.finalUrl?.toString() || '';
    } else {
      this.attemptedUrl = this.router.url;
    }
  }
}