import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { switchMap, takeUntil } from 'rxjs/operators';
import * as Web from '../../../shared/imports/web-providers';
import { PublicDataService } from '../../../shared/imports/web-providers';
import { LocalizationService } from '../../../shared/services/localization.service';

@Component({
  selector: 'app-tos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tos.component.html',
  styleUrl: './tos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TosComponent implements OnInit, OnDestroy {
  data: any = null;
  t: any = null; // Překlady
  private destroy$ = new Web.Subject<void>();

  constructor(
    private publicDataService: PublicDataService,
    private localizationService: LocalizationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // 1. Načtení překladů
    this.localizationService.currentTranslations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(translations => {
        this.t = translations?.tos; // Předpokládám klíč v JSONu
        this.cdr.markForCheck();
      });

    // 2. Reaktivní načtení dat dle jazyka
    this.localizationService.currentLanguage$
      .pipe(
        takeUntil(this.destroy$),
        switchMap((lang) => this.publicDataService.getLegalDocument('tos', lang))
      )
      .subscribe({
        next: (res) => {
          this.data = res;
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Chyba při načítání TOS:', err)
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}