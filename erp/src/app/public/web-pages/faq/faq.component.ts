import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '../../../shared/imports/web-providers';
import * as Web from '../../../shared/imports/web-providers';
import { FaqItem } from '../components/interfaces/faq-item';
import { PublicDataService } from '../../../shared/services/public-data.service';

export interface FaqCategory {
  id: string;
  label: string;
}

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './faq.component.html',
  styleUrls: ['./faq.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FaqComponent implements Web.OnInit, Web.OnDestroy {
  t: any = null;
  settings: any = null;
  socialLinks: any[] = [];

  private destroy$ = new Web.Subject<void>();

  readonly categories: FaqCategory[] = [
    { id: 'obecne',      label: 'Obecné'      },
    { id: 'vyvoj',       label: 'Vývoj'       },
    { id: 'ceny',        label: 'Ceny'        },
    { id: 'spoluprace',  label: 'Spolupráce'  },
    { id: 'podpora',     label: 'Podpora'     },
  ];

  activeCategory: string = 'obecne';

  private readonly categoryItems: Record<string, FaqItem[]> = {
    obecne: [
      { question: 'Čím se vaše studio zabývá?', answer: 'Jsme digitální studio specializující se na vývoj webových, desktopových, mobilních aplikací a AI řešení.', isActive: false },
      { question: 'Jak dlouho jste na trhu?', answer: 'Na trhu působíme více než 8 let.', isActive: false },
      { question: 'V jakých jazycích komunikujete?', answer: 'Primárně komunikujeme v češtině a angličtině.', isActive: false },
      { question: 'Pracujete i s menšími projekty?', answer: 'Ano, rádi se ujmeme jak malých, tak rozsáhlých projektů.', isActive: false },
      { question: 'Nabízíte bezplatnou konzultaci?', answer: 'Ano, první konzultaci poskytujeme bezplatně.', isActive: false },
    ],
    vyvoj: [
      { question: 'Jaké technologie používáte pro webový vývoj?', answer: 'Pro frontend pracujeme primárně s Angular a TypeScriptem, pro backend s C#, PHP nebo Node.js.', isActive: false },
      { question: 'Vyvíjíte i mobilní aplikace?', answer: 'Ano, vyvíjíme nativní i cross-platform mobilní aplikace.', isActive: false },
      { question: 'Jak probíhá vývoj desktopových aplikací?', answer: 'Desktopové aplikace vyvíjíme převážně v C# (WPF, WinForms, MAUI), C++ nebo Pythonu.', isActive: false },
      { question: 'Nabízíte integraci AI do existujících systémů?', answer: 'Ano, implementujeme AI řešení jak do nových, tak stávajících systémů.', isActive: false },
      { question: 'Jak zajišťujete kvalitu kódu?', answer: 'Dodržujeme standardy čistého kódu, code review a automatizované testy.', isActive: false },
      { question: 'Jak dlouho trvá vývoj typického projektu?', answer: 'Délka závisí na rozsahu, obvykle 4–8 týdnů pro jednodušší projekty.', isActive: false },
    ],
    ceny: [
      { question: 'Jak jsou stanovovány ceny vašich služeb?', answer: 'Ceny stanovujeme individuálně podle rozsahu a složitosti.', isActive: false },
      { question: 'Jaké jsou přibližné ceny webových projektů?', answer: 'Ceny se pohybují od nižších desítek tisíc až po stovky tisíc korun.', isActive: false },
      { question: 'Nabízíte fixní nebo hodinové sazby?', answer: 'Nabízíme oba modely podle typu spolupráce.', isActive: false },
      { question: 'Existují skryté poplatky?', answer: 'Ne, veškeré náklady transparentně uvádíme v nabídce.', isActive: false },
      { question: 'Jaké jsou platební podmínky?', answer: 'Fakturujeme zálohu při zahájení a zbytek po dokončení projektu.', isActive: false },
    ],
    spoluprace: [
      { question: 'Jak probíhá zahájení spolupráce?', answer: 'Začínáme úvodní konzultací, analýzou a podpisem smlouvy.', isActive: false },
      { question: 'Jak komunikujete v průběhu projektu?', answer: 'Přes e-mail, videohovory nebo projektový nástroj.', isActive: false },
      { question: 'Mohu sledovat průběh vývoje?', answer: 'Ano, máte přístup ke sdílenému projektovému prostoru.', isActive: false },
      { question: 'Pracujete agilně?', answer: 'Ano, pracujeme agilní metodikou rozdělenou do sprintů.', isActive: false },
      { question: 'Podepíšete NDA?', answer: 'Samozřejmě, dohodu o mlčenlivosti podepisujeme před zahájením.', isActive: false },
    ],
    podpora: [
      { question: 'Nabízíte podporu po dokončení projektu?', answer: 'Ano, od záruční doby až po dlouhodobé servisní smlouvy.', isActive: false },
      { question: 'Jak rychle reagujete na nahlášené problémy?', answer: 'Kritické problémy do 4h, standardní do 48h.', isActive: false },
      { question: 'Zajišťujete aktualizace a údržbu?', answer: 'Ano, v rámci servisních balíčků.', isActive: false },
      { question: 'Co se stane, pokud chci projekt rozšířit?', answer: 'Provedeme analýzu a připravíme nabídku na rozšíření.', isActive: false },
      { question: 'Poskytujete školení?', answer: 'Ano, ke každému projektu zajistíme dokumentaci a školení.', isActive: false },
      { question: 'Jak nahlásím chybu?', answer: 'E-mailem, přes helpdesk nebo telefonicky.', isActive: false },
    ],
  };

  filteredItems: FaqItem[] = [];

  constructor(
    private localizationService: Web.LocalizationService,
    private publicDataService: PublicDataService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.localizationService.currentTranslations$
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(translations => {
        if (translations?.faq) {
          this.t = translations.faq;
          this.cdr.markForCheck();
        }
      });

    this.publicDataService.getSiteSettings()
      .pipe(Web.takeUntil(this.destroy$))
      .subscribe(res => {
        this.settings = res.settings;
        this.socialLinks = res.social_links;
        this.cdr.markForCheck();
      });

    this.setCategory(this.activeCategory);
  }

  getIconUrl(path: string): string {
    return this.publicDataService.getStorageUrl(path);
  }

  setCategory(id: string): void {
    this.activeCategory = id;
    this.filteredItems = (this.categoryItems[id] ?? []).map(item => ({ ...item, isActive: false }));
    this.cdr.markForCheck();
  }

  toggleFaq(item: FaqItem): void {
    item.isActive = !item.isActive;
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}