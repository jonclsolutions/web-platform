import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BasePublicComponent } from '../../base-public.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent extends BasePublicComponent {

  protected readonly translationKey = 'home';

  // Zachovaná struktura assetů pro kompatibilitu s HTML
  private heroBackgroundImageUrl: string = 'assets/images/backgrounds/home_background.jpg';
  private serviceBackgrounds: { [key: string]: string } = {
    webapp: 'assets/images/backgrounds/service-web.jpg',
    desktopapp: 'assets/images/backgrounds/service-desktop.jpg',
    mobileapp: 'assets/images/backgrounds/service-mobile.jpg',
    aiapp: 'assets/images/backgrounds/service-ai.jpg',
  };
  
  eshop_default: string = 'assets/images/product_images/admin_panel.png';
  survey_engine: string = 'assets/images/product_images/survey_engine.png';
  survey_solver: string = 'assets/images/product_images/survey_solver.png';
  check_mark: string = 'assets/images/icons/check.png';

  c_sharp: string = 'assets/images/services-img/csharp.png';
  ts: string = 'assets/images/services-img/ts.png';
  php: string = 'assets/images/services-img/php.png';
  python: string = 'assets/images/services-img/py.png';
  cpp: string = 'assets/images/services-img/cpp.png';
  kotlin: string = 'assets/images/services-img/kotlin.png';

  hoverState: { [key: string]: boolean } = {
    webapp: false,
    website: false,
    desktopapp: false,
    graphicdesign: false,
  };

  // Metody zůstávají beze změn pro zachování vazby v HTML
  getTechIcon(name: string): string {
    const icons: Record<string, string> = {
      'C#': this.c_sharp,
      'TypeScript': this.ts,
      'PHP': this.php,
      'Python': this.python,
      'C++': this.cpp,
      'Kotlin': this.kotlin
    };
    return icons[name] || '';
  }

  getHeroBackground(): string {
    return `url('${this.heroBackgroundImageUrl}')`;
  }

  getServiceBackground(serviceName: string): string {
    return `url('${this.serviceBackgrounds[serviceName]}')`;
  }

  getServiceOverlayStyles(serviceName: string) {
    const isHovered = this.hoverState[serviceName];
    return {
      filter: isHovered ? 'grayscale(0%) brightness(1)' : 'grayscale(100%) brightness(0.7)',
      transform: isHovered ? 'scale(1.05)' : 'scale(1)',
    };
  }

  getTextStyles(serviceName: string) {
    const isHovered = this.hoverState[serviceName];
    return {
      color: isHovered ? '#00bcd4' : '#e0e0e0',
      textShadow: isHovered ? '0 0 15px rgba(0, 188, 212, 0.7)' : 'none',
      transition: 'color 0.4s ease, text-shadow 0.4s ease'
    };
  }

  getArrowStyles(serviceName: string) {
    const isHovered = this.hoverState[serviceName];
    return {
      color: isHovered ? '#00bcd4' : '#e0e0e0',
      opacity: '1',
      transform: isHovered ? 'translateX(20px)' : 'translateX(0px)',
      transition: 'color 0.4s ease, transform 0.4s ease'
    };
  }

  setHoverState(serviceName: string, isHovering: boolean) {
    this.hoverState[serviceName] = isHovering;
    this.cdr.markForCheck(); // Zajištění detekce změny pro OnPush
  }
}