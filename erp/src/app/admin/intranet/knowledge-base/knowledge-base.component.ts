import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { KbFooterComponent } from './substitutions/kb-footer/kb-footer.component';
@Component({
  selector: 'app-knowledge-base',
  standalone: true,
  imports: [RouterModule, KbFooterComponent],
  templateUrl: './knowledge-base.component.html',
  styleUrl: './knowledge-base.component.css'
})
export class KnowledgeBaseComponent {
  isMenuOpen = false;

  constructor(private router: Router) {}

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  isRootPath(): boolean {
    return this.router.url === '/company-pages/knowledge-base';
  }
}