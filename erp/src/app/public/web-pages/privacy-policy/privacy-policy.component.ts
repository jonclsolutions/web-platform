import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as Web from '../../../shared/imports/web-providers';
import { PublicDataService } from '../../../shared/imports/web-providers';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './privacy-policy.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivacyPolicyComponent implements OnInit {
  @Input() docSlug: 'gdpr' | 'tos' = 'gdpr'; // Možnost přepínat mezi stránkami
  
  data: any = null; 
  private destroy$ = new Web.Subject<void>();

  constructor(
    private publicDataService: PublicDataService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.publicDataService.getLegalDocument(this.docSlug)
      .pipe(Web.takeUntil(this.destroy$))
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