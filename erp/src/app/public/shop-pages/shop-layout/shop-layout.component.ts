// public/shop-pages/shop-layout/shop-layout.component.ts
import { Component } from '@angular/core';

import { RouterOutlet } from '@angular/router';
// Pozor: Cesty si uprav podle své reality
import { ShopFooterComponent } from '../components/shop-footer/shop-footer.component';
import { ShopHeaderComponent } from '../components/shop-header/shop-header.component';
@Component({
  selector: 'app-shop-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    ShopHeaderComponent,
    ShopFooterComponent
],
  templateUrl: './shop-layout.component.html',
  styleUrls: ['./shop-layout.component.css']
})
export class ShopLayoutComponent {}