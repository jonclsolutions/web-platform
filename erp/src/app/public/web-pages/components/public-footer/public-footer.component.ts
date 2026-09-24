import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BasePublicComponent } from '../../../base-public.component';
interface FooterNavLink {
  route: string;
  text: string;
  external: boolean;
}

@Component({
  selector: 'app-public-footer',
  standalone: true,
  templateUrl: './public-footer.component.html',
  styleUrls: ['./public-footer.component.css'],
  imports: [RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicFooterComponent extends BasePublicComponent {
  
  protected readonly translationKey = 'footer';
  protected override readonly loadSiteSettings = true;

  logo_big: string = "assets/images/logos/logo_big.svg";

  currentYear: number = new Date().getFullYear();
  footerNavLinks: FooterNavLink[] = [];
  footerLegalLinks: FooterNavLink[] = [];

  constructor() {
    super();
    // Nastavení modulu pro lokalizaci, pokud je vyžadováno
    this.localizationService.setModule('web');
  }

  /**
   * Hook z BasePublicComponent volaný po každé změně překladů.
   */
  protected override onTranslationsLoaded(): void {
    this.loadFooterNavLinks();
    this.loadFooterLegalLinks();
  }

  get copyrightText(): string {
    const lang = this.localizationService.getCurrentLanguage();
    const i18n = this.settings?.copyright_text_i18n;
    
    const text = (i18n && i18n[lang]) 
      ? i18n[lang] 
      : (this.settings?.copyright_text || this.t?.copyright_text || '© {year} RegioPartner. All rights reserved.');
    
    return text.replace('{year}', this.currentYear.toString());
  }

  get brandTagline(): string {
    const lang = this.localizationService.getCurrentLanguage();
    const i18n = this.settings?.brand_tagline_i18n;
    
    return (i18n && i18n[lang]) 
      ? i18n[lang] 
      : (this.settings?.brand_tagline || this.t?.brand_tagline || 'We build digital products you\'ll be proud of.');
  }

  private loadFooterNavLinks(): void {
    const navLinkKeys = [
      { route: '/home', key: 'navigation.home', ext: false },
      { route: '/services', key: 'navigation.services', ext: false },
      { route: '/contact', key: 'navigation.contact', ext: false },
      { route: '/shop', key: 'navigation.shop', ext: true }, 
      { route: '/references', key: 'navigation.references_full', ext: false },
      { route: '/faq', key: 'navigation.faq_full', ext: false },
      { route: '/about-us', key: 'navigation.about-us', ext: false },
      { route: '/jobs', key: 'navigation.jobs', ext: false },
      { route: '/knowledge-base', key: 'knowledge-base.knowledge-base_footer', ext: false },
      { route: '/auth/login', key: 'navigation.login_btn', ext: false },
    ];

    this.footerNavLinks = navLinkKeys.map(link => ({
      route: link.route,
      text: this.localizationService.getText(link.key),
      external: link.ext
    }));
  }

  private loadFooterLegalLinks(): void {
    const legalLinkKeys = [
      { route: '/privacy-policy', key: 'legal.privacy_policy' },
      { route: '/tos', key: 'legal.terms_of_service' },
      { route: '/cookies-policy', key: 'legal.cookies_policy' }
    ];

    this.footerLegalLinks = legalLinkKeys.map(link => ({
      route: link.route,
      text: this.localizationService.getText(link.key),
      external: false
    }));
  }
}