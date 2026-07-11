/**
 * @file services.component.ts
 * @path src/app/public/web-pages/services/services.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { BasePublicComponent } from '../../base-public.component';
import { Item, Technology } from './';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-main-content',
  standalone: true,
  imports: [CommonModule, RouterModule, KeyValuePipe],
  templateUrl: './services.component.html',
  styleUrls: ['./services.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesComponent extends BasePublicComponent {

  protected readonly translationKey = 'services';
  
  private route = inject(ActivatedRoute);

  currentTech = 'web-dev';
  technologies: Technology[] = [];

  readonly workflowNumbers = ['01', '02', '03', '04'];
  readonly techAssets = {
    'web-dev':     [{ name: 'C#', path: 'assets/images/services-img/csharp.png' }, { name: 'TypeScript', path: 'assets/images/services-img/ts.png' }, { name: 'PHP', path: 'assets/images/services-img/php.png' }],
    'desktop-dev': [{ name: 'C#', path: 'assets/images/services-img/csharp.png' }, { name: 'C++', path: 'assets/images/services-img/cpp.png' }, { name: 'Python', path: 'assets/images/services-img/py.png' }],
    'mobile-dev':  [{ name: 'C#', path: 'assets/images/services-img/csharp.png' }, { name: 'TypeScript', path: 'assets/images/services-img/ts.png' }, { name: 'Kotlin', path: 'assets/images/services-img/kotlin.png' }],
    'ai-dev':      [{ name: 'Python', path: 'assets/images/services-img/py.png' }, { name: 'C++', path: 'assets/images/services-img/cpp.png' }]
  };

  protected override onInit(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const techId = params['tech'];
        if (techId && this.technologies.some(t => t.id === techId)) {
          this.currentTech = techId;
          this.cdr.markForCheck();
        }
      });
  }

  protected override onTranslationsLoaded(): void {
    this.technologies = [
      { id: 'web-dev',     name: this.t.web_dev_header },
      { id: 'desktop-dev', name: this.t.desktop_dev_header },
      { id: 'mobile-dev',  name: this.t.mobile_dev_header },
      { id: 'ai-dev',      name: this.t.ai_dev_header },
    ];
  }

  get currentTechImages() {
    return (this.techAssets as any)[this.currentTech] || [];
  }

  get currentInfoHeader(): string {
    const map: any = { 'web-dev': this.t?.info_header_web, 'desktop-dev': this.t?.info_header_desktop, 'mobile-dev': this.t?.info_header_mobile, 'ai-dev': this.t?.info_header_ai };
    return map[this.currentTech] || '';
  }

  get currentMainText(): string {
    const map: any = { 'web-dev': this.t?.service_main_text_1, 'desktop-dev': this.t?.service_main_text_2, 'mobile-dev': this.t?.service_main_text_3, 'ai-dev': this.t?.service_main_text_4 };
    return map[this.currentTech] || '';
  }

  get currentServices() {
    const map: any = { 'web-dev': this.t?.webServices, 'desktop-dev': this.t?.desktopServices, 'mobile-dev': this.t?.mobileServices, 'ai-dev': this.t?.aiServices };
    return map[this.currentTech] || [];
  }

  get priceItems() {
    return [this.t?.services?.item_1, this.t?.services?.item_2, this.t?.services?.item_3, this.t?.services?.item_4, this.t?.services?.item_5, this.t?.services?.item_6];
  }

  get workflowSteps() {
    return [this.t?.colab?.item_1, this.t?.colab?.item_2, this.t?.colab?.item_3, this.t?.colab?.item_4];
  }

  toggleFaq(item: Item): void {
    item.isActive = !item.isActive;
    this.cdr.markForCheck();
  }

  selectTech(techId: string): void {
    this.currentTech = techId;
    this.cdr.markForCheck();
  }
}