/**
 * @file knowledge-base.component.ts
 * @path src/app/admin/pages/knowledge-base/knowledge-base.component.ts
 * @project RegioPartner Web
 * @author RPSW
 * @created 2026
 * @description The main shell component for the Knowledge Base module, managing layout, navigation state, and sub-module routing.
 * @dependencies
 * - RouterModule: Facilitates nested routing for KB content.
 * - KbFooterComponent: Reusable footer for the knowledge base interface.
 */

import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { KbFooterComponent } from './substitutions/kb-footer/kb-footer.component';

/**
 * @description Acts as a layout wrapper for the Knowledge Base section, providing responsive menu controls.
 * @usage Used as the entry point for the Knowledge Base module in the admin navigation hierarchy.
 * @note Implements path detection logic to conditionally display UI elements based on the current navigation state.
 */
@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [RouterModule, KbFooterComponent],
  templateUrl: './knowledge-base.component.html',
  styleUrl: './knowledge-base.component.css'
})
export class KnowledgeBaseComponent {
  /** * @description Tracks the expansion state of the side/mobile navigation menu. */
  isMenuOpen = false;

  constructor(private router: Router) {}

  /**
   * @description Toggles the visibility of the mobile menu.
   */
  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  /**
   * @description Collapses the navigation menu.
   */
  closeMenu() {
    this.isMenuOpen = false;
  }

  /**
   * @description Checks if the user is currently at the root of the Knowledge Base.
   * @returns {boolean} True if the current URL matches the KB base path.
   */
  isRootPath(): boolean {
    return this.router.url === '/company-pages/knowledge-base';
  }
}