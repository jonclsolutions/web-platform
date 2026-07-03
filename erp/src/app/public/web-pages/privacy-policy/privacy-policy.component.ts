import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { switchMap, takeUntil } from 'rxjs/operators';
import * as Web from '../../../shared/imports/web-providers';
import { PublicDataService } from '../../../shared/imports/web-providers';
import { LocalizationService } from '../../../shared/services/localization.service';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivacyPolicyComponent implements OnInit, OnDestroy {
  @Input() docSlug: 'gdpr' | 'tos' = 'gdpr';
  
  data: any = null;
  t: any = null; // Překlady
  private destroy$ = new Web.Subject<void>();

  constructor(
    private publicDataService: PublicDataService,
    private localizationService: LocalizationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // 1. Načtení překladů
    this.localizationService.currentTranslations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.t = translations?.privacy_policy; // Předpokládám klíč v JSONu
        this.cdr.markForCheck();
      });

    // 2. Reaktivní načtení dat dle jazyka
    this.localizationService.currentLanguage$
      .pipe(
        takeUntil(this.destroy$),
        switchMap((lang) => this.publicDataService.getLegalDocument(this.docSlug, lang))
      )
      .subscribe({
        next: (res) => {
          this.data = res;
          this.cdr.markForCheck();
        },
        error: (err) => console.error(`Chyba při načítání ${this.docSlug}:`, err)
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}