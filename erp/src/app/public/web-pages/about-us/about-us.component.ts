import { Component, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';


// Tvůj hromadný import pro služby, RxJS a typy
import * as Web from '../../../shared/imports/web-providers';

@Component({
  selector: 'app-about-us',
  standalone: true,
  imports: [],
  templateUrl: './about-us.component.html',
  styleUrl: './about-us.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutUsComponent implements Web.OnInit, Web.OnDestroy {
  // Jeden objekt pro všechny texty v komponentě
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
        if (translations?.about_us) {
          this.t = translations.about_us;
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}