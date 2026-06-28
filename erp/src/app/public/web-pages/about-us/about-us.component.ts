import { Component, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '../../../shared/imports/web-providers';
import * as Web from '../../../shared/imports/web-providers';
// Přidán import služby pro data
import { PublicDataService } from '../../../shared/services/public-data.service';

@Component({
  selector: 'app-about-us',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './about-us.component.html',
  styleUrl: './about-us.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AboutUsComponent implements Web.OnInit, Web.OnDestroy {
  t: any = null;
  socialLinks: any[] = []; // Nová proměnná pro data

  private destroy$ = new Web.Subject<void>();

  constructor(
    private localizationService: Web.LocalizationService,
    private publicDataService: PublicDataService, // Injektována služba
    private cdr: ChangeDetectorRef 
  ) { }

  ngOnInit(): void {
    // 1. Překlady
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.about_us) {
          this.t = translations.about_us;
          this.cdr.markForCheck();
        }
      });

    // 2. Dynamické načtení sociálních sítí
    this.publicDataService.getSiteSettings()
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(res => {
        this.socialLinks = res.social_links;
        this.cdr.markForCheck();
      });
  }

  // Metoda pro získání URL ikony
  getIconUrl(path: string): string {
    return this.publicDataService.getStorageUrl(path);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}