/**
 * @file tos.component.ts
 * @path src/app/public/web-pages/tos/tos.component.ts
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BasePublicComponent } from '../../base-public.component';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-tos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tos.component.html',
  styleUrl: './tos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TosComponent extends BasePublicComponent {

  protected readonly translationKey = 'tos';
  data: any = null;

  protected override onInit(): void {
    // Sledování změny jazyka pro automatické přenačtení TOS
    this.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe((lang) => this.loadTos(lang));
  }

  private loadTos(lang: string): void {
    this.publicDataService.get('public/legal/tos', { lang })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.data = res;
          this.cdr.markForCheck();
        },
        error: (err) => console.error('Error loading TOS:', err)
      });
  }
}