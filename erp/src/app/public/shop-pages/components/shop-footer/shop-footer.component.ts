import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LocalizationService } from '../../../../shared/services/localization.service';
import { PublicDataService } from '../../../../shared/services/public-data.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface FooterNavLink { route: string; text: string; external: boolean; }
interface PaymentMethod { name: string; icon: string; }
interface SocialLink { name: string; url: string; icon_path: string; }

@Component({
  selector: 'app-shop-footer',
  standalone: true,
  templateUrl: './shop-footer.component.html',
  styleUrls: ['./shop-footer.component.css'],
  imports: [RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopFooterComponent implements OnInit, OnDestroy {
  t: any = null;
  currentYear: number;
  footerNavLinks: FooterNavLink[] = [];
  footerLegalLinks: FooterNavLink[] = [];
  paymentMethods: PaymentMethod[] = [];
  
  siteSettings: any = null;
  socialLinks: SocialLink[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private localizationService: LocalizationService,
    private publicDataService: PublicDataService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentYear = new Date().getFullYear();
  }

  ngOnInit(): void {
    this.loadSiteData();
    this.localizationService.currentTranslations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations) {
          this.t = translations.footer;
          this.loadFooterNavLinks();
          this.loadFooterLegalLinks();
          this.loadPaymentMethods();
          this.cdr.markForCheck();
        }
      });
  }

  private loadSiteData(): void {
    this.publicDataService.getSiteSettings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.siteSettings = data.settings;
          this.socialLinks = data.social_links;
          
          // Pokud footer_text z DB obsahuje placeholder, nahradíme jej rokem
          if (this.siteSettings?.footer_text) {
            this.siteSettings.footer_text = this.siteSettings.footer_text.replace('{year}', this.currentYear.toString());
          }
          
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Chyba při načítání footer dat:', err)
      });
  }

  private loadPaymentMethods(): void {
    this.publicDataService.getPaymentMethods()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (methods) => {
          this.paymentMethods = methods.map(m => ({
            name: m.name,
            icon: this.publicDataService.getStorageUrl(m.image_url || m.icon)
          }));
          this.cdr.markForCheck();
        }
      });
  }

  getStorageUrl(path: string): string {
    return this.publicDataService.getStorageUrl(path);
  }

  private loadFooterNavLinks(): void {
    const navLinkKeys = [{ route: '/home', key: 'navigation.home', ext: false }, { route: '/faq', key: 'navigation.faq_full', ext: false }];
    this.footerNavLinks = navLinkKeys.map(link => ({ route: link.route, text: this.localizationService.getText(link.key), external: link.ext }));
  }

  private loadFooterLegalLinks(): void {
    const legalLinkKeys = [{ route: '/tos', key: 'legal.terms_of_service' }, { route: '/privacy-policy', key: 'legal.privacy_policy' }];
    this.footerLegalLinks = legalLinkKeys.map(link => ({ route: link.route, text: this.localizationService.getText(link.key) || '', external: false }));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}