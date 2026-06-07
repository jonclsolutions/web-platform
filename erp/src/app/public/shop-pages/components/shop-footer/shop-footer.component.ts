import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

import { LocalizationService } from '../../../../shared/services/localization.service';
import { PublicDataService } from '../../../../shared/services/public-data.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface FooterNavLink {
  route: string;
  text: string;
  external: boolean;
}

interface PaymentMethod {
  name: string;
  icon: string;
}

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

  tt_link: string = 'assets/images/icons/tik-tok.png';
  ig_link: string = 'assets/images/icons/ig.png';

  private destroy$ = new Subject<void>();

  constructor(
    private localizationService: LocalizationService,
    private publicDataService: PublicDataService, // 👈 Vstříknutí nové servisy
    private cdr: ChangeDetectorRef
  ) {
    this.currentYear = new Date().getFullYear();
  }

  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations) {
          this.t = translations.footer;
          
          if (this.t?.copyright_text) {
            this.t.copyright_text = this.t.copyright_text.replace('{year}', this.currentYear.toString());
          }

          this.loadFooterNavLinks();
          this.loadFooterLegalLinks();
          this.loadPaymentMethods(); // Načte data přes API

          this.cdr.markForCheck();
        }
      });
  }

  private loadFooterNavLinks(): void {
    const navLinkKeys = [
      { route: '/home', key: 'navigation.home', ext: false },
      { route: '/faq', key: 'navigation.faq_full', ext: false }
    ];

    this.footerNavLinks = navLinkKeys.map(link => ({
      route: link.route,
      text: this.localizationService.getText(link.key),
      external: link.ext
    }));
  }

  private loadFooterLegalLinks(): void {
    const legalLinkKeys = [
      { route: '/tos', key: 'legal.terms_of_service' },
      { route: '/privacy-policy', key: 'legal.privacy_policy' },
      { route: '/claims', key: 'legal.claims_policy' }
    ];

    this.footerLegalLinks = legalLinkKeys.map(link => ({
      route: link.route,
      text: this.localizationService.getText(link.key) || this.getFallbackLegalText(link.route),
      external: false
    }));
  }

  private loadPaymentMethods(): void {
    // Načtení reálných aktivních metod z databáze přes API
    this.publicDataService.getPaymentMethods()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (methods) => {
          this.paymentMethods = methods.map(m => ({
            name: m.name,
            icon: m.image_url // Laravel API vrátí plnou URL k assetu
          }));
          this.cdr.markForCheck(); // Nutné kvůli ChangeDetectionStrategy.OnPush
        },
        error: (err) => console.error('Chyba při načítání platebních metod do footeru:', err)
      });
  }

  private getFallbackLegalText(route: string): string {
    if (route === '/tos') return 'Obchodní podmínky';
    if (route === '/privacy-policy') return 'Dodržení GDPR';
    if (route === '/claims') return 'Podmínky reklamace';
    return '';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}