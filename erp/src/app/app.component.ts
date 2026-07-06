/**
 * @file app.component.ts
 * @path src/app/app.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2025
 * @description Root component of the application, serving as the main entry point for the component tree.
 * @dependencies
 * - AuthService: Used to verify the authentication state upon application initialization.
 */

import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';

/**
 * @description The root entry point of the application. It acts as the container for all routed views.
 * @usage Bootstrap entry point for the Angular application.
 * @note This component is responsible for triggering initial authentication checks to restore user sessions.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  /**
   * @param authService Injecting the authentication service to manage user session state.
   */
  constructor(private authService: AuthService) {}

  /**
   * @description Initializes the authentication check.
   * @note This ensures that if a user reloads the page, their session is validated before the application renders the requested route.
   */
  ngOnInit(): void {
    this.authService.checkAuth().subscribe();
  }
}