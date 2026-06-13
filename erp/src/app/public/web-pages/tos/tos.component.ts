import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import * as Web from '../../../shared/imports/web-providers';
import { PublicDataService } from '../../../shared/imports/web-providers';

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
  private destroy$ = new Web.Subject<void>();

  constructor(
    private publicDataService: PublicDataService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Načtení Obchodních podmínek (slug 'tos')
    this.publicDataService.getLegalDocument('tos')
      .pipe(Web.takeUntil(this.destroy$))
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