import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import * as Web from '../../../shared/imports/web-providers'; // Upravte cestu dle vašeho projektu

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.css',
})
export class NotFoundComponent implements OnInit, OnDestroy {
  t: any = null; // Přidáno pro lokalizaci
  private destroy$ = new Web.Subject<void>();
  attemptedUrl: string = '';

  constructor(
    private router: Router,
    private localizationService: Web.LocalizationService // Vstřiknutí služby
  ) {}

  ngOnInit(): void {
    // Načtení lokalizace
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.not_found) {
          this.t = translations.not_found;
        }
      });

    const navigation = this.router.getCurrentNavigation();
    if (navigation && navigation.previousNavigation) {
      this.attemptedUrl = navigation.previousNavigation.finalUrl?.toString() || '';
    } else {
      this.attemptedUrl = this.router.url;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}