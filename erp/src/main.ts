/**
 * @file main.ts
 * @path src/main.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Application entry point responsible for bootstrapping the Angular framework with provided configurations.
 * @dependencies
 * - AppComponent: The root component to be rendered.
 * - appConfig: The application configuration containing global providers, interceptors, and routing.
 */

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

/**
 * @description Bootstraps the root application component and injects the global configuration.
 * @note Error handling is implemented to log any critical failures during the application initialization process to the console.
 */
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));