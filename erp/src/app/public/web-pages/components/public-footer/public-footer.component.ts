import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LocalizationService } from '../../../../shared/services/localization.service';
import { PublicDataService } from '../../../../shared/services/public-data.service'; // PŘIDÁNO
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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
  settings: any = null; // PŘIDÁNO
  socialLinks: any[] = []; // PŘIDÁNO
  currentYear: number;
  footerNavLinks: FooterNavLink[] = [];
  footerLegalLinks: FooterNavLink[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private localizationService: LocalizationService,
    private publicDataService: PublicDataService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentYear = new Date().getFullYear();
  }

  ngOnInit(): void {
    // 1. Překlady
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

    // 2. Data ze serveru
    this.publicDataService.getSiteSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        this.settings = res.settings;
        this.socialLinks = res.social_links;
        this.cdr.markForCheck();
      });
  }

  getIconUrl(path: string): string {
    return this.publicDataService.getStorageUrl(path); // Předpokládám existenci této metody
  }

  private loadFooterNavLinks(): void {
    const navLinkKeys = [
      { route: '/home', key: 'navigation.home', ext: false },
      { route: '/services', key: 'navigation.services', ext: false },
      { route: '/academy', key: 'navigation.academy', ext: false },
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