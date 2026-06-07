// public/web-pages/web-layout/web-layout.component.ts
import { Component } from '@angular/core';

import { RouterOutlet } from '@angular/router';
import { PublicHeaderComponent } from '../components/public-header/public-header.component';
import { PublicFooterComponent } from '../components/public-footer/public-footer.component';

@Component({
  selector: 'app-web-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    PublicHeaderComponent,
    PublicFooterComponent
],
  templateUrl: './web-layout.component.html',
  styleUrls: ['./web-layout.component.css']
})
export class WebLayoutComponent {
  toggleRootScroll(isMenuOpen: boolean): void {
    const htmlElement = document.documentElement;
    if (isMenuOpen) {
      htmlElement.classList.add('no-scroll');
    } else {
      htmlElement.classList.remove('no-scroll');
    }
  }
}