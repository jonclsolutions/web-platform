import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LocalizationService } from '../../../../shared/services/localization.service';
import { PublicDataService } from '../../../../shared/services/public-data.service';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';

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
export class PublicFooterComponent implements OnInit, OnDestroy {
  t: any = null;
  settings: any = null;
  socialLinks: any[] = [];
  currentYear: number;
  footerNavLinks: FooterNavLink[] = [];
  footerLegalLinks: FooterNavLink[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private localizationService: LocalizationService,
    private publicDataService: PublicDataService,
    private cdr: ChangeDetectorRef
  ) {
    this.localizationService.setModule('web');
    this.currentYear = new Date().getFullYear();
  }

  ngOnInit(): void {
    // 1. Překlady (reaguje na změnu jazyka díky BehaviorSubject ve službě)
    this.localizationService.currentTranslations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations) {
          this.t = translations.footer;
          this.loadFooterNavLinks();
          this.loadFooterLegalLinks();
          this.cdr.markForCheck();
        }
      });

    // 2. Data ze serveru (reaguje na změnu jazyka)
    this.localizationService.currentLanguage$
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.publicDataService.getSiteSettings())
      )
      .subscribe(res => {
        this.settings = res.settings;
        this.socialLinks = res.social_links;
        this.cdr.markForCheck();
      });
  }

  getIconUrl(path: string): string {
    return this.publicDataService.getStorageUrl(path);
  }

  // Getter využívá getCurrentLanguage() ze služby
  get copyrightText(): string {
    const lang = this.localizationService.getCurrentLanguage();
    const i18n = this.settings?.copyright_text_i18n;
    
    const text = (i18n && i18n[lang]) 
      ? i18n[lang] 
      : (this.settings?.copyright_text || this.t?.copyright_text || '© {year} RegioPartner. All rights reserved.');
    
    return text.replace('{year}', this.currentYear.toString());
  }

  // Getter využívá getCurrentLanguage() ze služby
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
      { route: '/academy', key: 'navigation.contact', ext: false },
      { route: '/shop', key: 'navigation.shop', ext: true }, 
      { route: '/references', key: 'navigation.references_full', ext: false },
      { route: '/faq', key: 'navigation.faq_full', ext: false },
      { route: '/about-us', key: 'navigation.about-us', ext: false },
      { route: '/jobs', key: 'navigation.jobs', ext: false },
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
      { route: '/tos', key: 'legal.terms_of_service' }
    ];

    this.footerLegalLinks = legalLinkKeys.map(link => ({
      route: link.route,
      text: this.localizationService.getText(link.key),
      external: false
    }));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}