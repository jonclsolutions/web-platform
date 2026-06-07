import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';

import { RouterModule } from '@angular/router'; // Důležité pro funkční linky uvnitř HTML

import * as Web from '../../../shared/imports/web-providers';

@Component({
  selector: 'app-tos',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './tos.component.html',
  styleUrl: './tos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TosComponent implements OnInit, OnDestroy {
  t: any = null;
  private destroy$ = new Web.Subject<void>();

  constructor(
    private localizationService: Web.LocalizationService,
    private cdr: ChangeDetectorRef 
  ) { }

  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.tos) {
          this.t = translations.tos;
          this.cdr.markForCheck(); // Bezpečnější než detectChanges v OnPush
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}