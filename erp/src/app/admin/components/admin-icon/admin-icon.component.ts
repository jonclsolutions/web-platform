/**
 * @file admin-icon.component.ts
 * @path src/app/admin/components/admin-icon/admin-icon.component.ts
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Line icons of the admin navigation (sidebar items, module / application tabs,
 *   application cards) by name - the menus are built from data (admin-navigation.config.ts and
 *   the manifests of the applications), so an icon is a name there, not markup.
 * @usage `<app-admin-icon name="folder" [size]="16" />`
 * @note Decorative only (aria-hidden) - the link / button always has its own text.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Names of the available icons. */
export type AdminIconName = 'bar-chart' | 'box' | 'briefcase' | 'calendar' | 'cart' | 'check-square' | 'chevron-down' | 'code' | 'credit-card' | 'dollar' | 'external-link' | 'file-lines' | 'file-text' | 'folder' | 'globe' | 'globe-settings' | 'help-circle' | 'home' | 'languages' | 'layers' | 'layout' | 'lock' | 'shield' | 'shield-check' | 'shopping-bag' | 'star' | 'truck' | 'user' | 'user-check' | 'users' | 'window';

@Component({
  selector: 'app-admin-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         [attr.stroke-width]="strokeWidth" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (name) {
      @case ('bar-chart') { <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/> <line x1="6" y1="20" x2="6" y2="14"/> }
      @case ('box') { <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/> }
      @case ('briefcase') { <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/> <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/> }
      @case ('calendar') { <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/> }
      @case ('cart') { <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/> <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/> }
      @case ('check-square') { <polyline points="9 11 12 14 22 4"/> <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/> }
      @case ('chevron-down') { <polyline points="6 9 12 15 18 9"/> }
      @case ('code') { <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/> }
      @case ('credit-card') { <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/> <line x1="1" y1="10" x2="23" y2="10"/> }
      @case ('dollar') { <line x1="12" y1="1" x2="12" y2="23"/> <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/> }
      @case ('external-link') { <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/> <polyline points="15 3 21 3 21 9"/> <line x1="10" y1="14" x2="21" y2="3"/> }
      @case ('file-lines') { <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/> <polyline points="14 2 14 8 20 8"/> <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/> }
      @case ('file-text') { <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/> <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/> <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/> }
      @case ('folder') { <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/> }
      @case ('globe') { <circle cx="12" cy="12" r="10"/> <line x1="2" y1="12" x2="22" y2="12"/> <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/> }
      @case ('globe-settings') { <circle cx="12" cy="12" r="3"/> <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/> <path d="M12 2a10 10 0 0 1 0 20A10 10 0 0 1 12 2z"/> }
      @case ('help-circle') { <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/> }
      @case ('home') { <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/> <polyline points="9 22 9 12 15 12 15 22"/> }
      @case ('languages') { <path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/> }
      @case ('layers') { <polygon points="12 2 2 7 12 12 22 7 12 2"/> <polyline points="2 17 12 22 22 17"/> <polyline points="2 12 12 17 22 12"/> }
      @case ('layout') { <rect x="3" y="3" width="18" height="18" rx="2"/> <path d="M9 3v18"/> <path d="M3 9h6"/> }
      @case ('lock') { <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/> <path d="M7 11V7a5 5 0 0 1 10 0v4"/> }
      @case ('shield') { <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/> }
      @case ('shield-check') { <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/> <path d="M9 12l2 2 4-4"/> }
      @case ('shopping-bag') { <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/> <line x1="3" y1="6" x2="21" y2="6"/> <path d="M16 10a4 4 0 0 1-8 0"/> }
      @case ('star') { <path d="M12 15l-3.5 2 1-4-3-2.7 4-.3L12 6l1.5 4 4 .3-3 2.7 1 4z"/><circle cx="12" cy="12" r="10"/> }
      @case ('truck') { <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/> <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/> }
      @case ('user') { <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/> <circle cx="12" cy="7" r="4"/> }
      @case ('user-check') { <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/> <polyline points="16 3 18 5 22 1"/> }
      @case ('users') { <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/> <circle cx="9" cy="7" r="4"/> <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/> }
      @case ('window') { <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/> }
      }
    </svg>
  `,
  styles: [':host { display: inline-flex; line-height: 0; }'],
})
export class AdminIconComponent {
  /** Icon name. */
  @Input({ required: true }) name!: AdminIconName;
  /** Width and height in px. */
  @Input() size = 16;
  /** Line width. */
  @Input() strokeWidth = 2;
}
