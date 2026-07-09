/**
 * @file app.component.ts
 * @path src/app/app.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Root component of the application, serving as the main entry point for the component tree.
 * @dependencies
 * - AuthService: Used to verify the authentication state upon application initialization.
 * - PublicDataService: Used to fetch global settings and resolve dynamic assets.
 */

import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { PublicDataService } from './shared/services/public-data.service';

/**
 * @description The root entry point of the application. It acts as the container for all routed views.
 * @usage Bootstrap entry point for the Angular application.
 * @note This component triggers authentication checks and handles global UI configurations like dynamic favicon updates.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  
  constructor(
    private authService: AuthService,
    private publicDataService: PublicDataService
  ) {}

  /**
   * @description Initializes authentication and global site configurations.
   */
  ngOnInit(): void {
    this.authService.checkAuth().subscribe();
    this.publicDataService.get<{settings: any}>('public/legal/config')
      .subscribe(data => {
        if (data.settings?.logo_path) {
          const url = this.publicDataService.getStorageUrl(data.settings.logo_path);
          this.updateFavicon(url);
        }
      });
  }

  /**
   * @description Dynamically updates the favicon in the document head.
   * @param url The fully qualified URL to the new logo asset.
   */
  private updateFavicon(url: string): void {
    const link: HTMLLinkElement = document.querySelector('#dynamic-favicon') || 
                                  document.createElement('link');
    link.id = 'dynamic-favicon';
    link.rel = 'icon';
    link.href = url;
    document.head.appendChild(link);
  }
}