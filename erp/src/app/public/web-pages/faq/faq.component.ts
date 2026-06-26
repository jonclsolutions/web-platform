import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '../../../shared/imports/web-providers';
import * as Web from '../../../shared/imports/web-providers';
import { FaqItem } from '../components/interfaces/faq-item';

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
  ig_icon: string = 'assets/images/icons/ig.png';
  email_icon: string = 'assets/images/icons/email.png';

  private destroy$ = new Web.Subject<void>();

  // ── Kategorie ────────────────────────────────────────────────
  readonly categories: FaqCategory[] = [
    { id: 'obecne',      label: 'Obecné'      },
    { id: 'vyvoj',       label: 'Vývoj'       },
    { id: 'ceny',        label: 'Ceny'        },
    { id: 'spoluprace',  label: 'Spolupráce'  },
    { id: 'podpora',     label: 'Podpora'     },
  ];

  activeCategory: string = 'obecne';

  // ── Statické otázky po kategoriích ──────────────────────────
  private readonly categoryItems: Record<string, FaqItem[]> = {
    obecne: [
      {
        question: 'Čím se vaše studio zabývá?',
        answer: 'Jsme digitální studio specializující se na vývoj webových, desktopových, mobilních aplikací a AI řešení. Pomáháme firmám i jednotlivcům proměnit jejich nápady v funkční digitální produkty.',
        isActive: false
      },
      {
        question: 'Jak dlouho jste na trhu?',
        answer: 'Na trhu působíme více než 8 let. Za tu dobu jsme realizovali přes 120 projektů pro klienty z různých odvětví.',
        isActive: false
      },
      {
        question: 'V jakých jazycích komunikujete?',
        answer: 'Primárně komunikujeme v češtině a angličtině. V případě potřeby se domluvíme i v dalších jazycích.',
        isActive: false
      },
      {
        question: 'Pracujete i s menšími projekty?',
        answer: 'Ano, rádi se ujmeme jak malých projektů pro začínající podnikatele, tak rozsáhlých enterprise řešení. Každý projekt posuzujeme individuálně.',
        isActive: false
      },
      {
        question: 'Nabízíte bezplatnou konzultaci?',
        answer: 'Ano, první konzultaci poskytujeme bezplatně. Rádi si vyslechneme váš nápad a navrhneme nejvhodnější řešení.',
        isActive: false
      },
    ],
    vyvoj: [
      {
        question: 'Jaké technologie používáte pro webový vývoj?',
        answer: 'Pro frontend pracujeme primárně s Angular a TypeScriptem, pro backend s C#, PHP nebo Node.js. Volbu technologií vždy přizpůsobujeme konkrétním požadavkům projektu.',
        isActive: false
      },
      {
        question: 'Vyvíjíte i mobilní aplikace?',
        answer: 'Ano, vyvíjíme nativní i cross-platform mobilní aplikace. Pracujeme s .NET MAUI (C#) pro multiplatformní řešení a Kotlinem pro nativní Android.',
        isActive: false
      },
      {
        question: 'Jak probíhá vývoj desktopových aplikací?',
        answer: 'Desktopové aplikace vyvíjíme převážně v C# (WPF, WinForms, MAUI), C++ nebo Pythonu. Technologii volíme podle výkonnostních a platformních požadavků.',
        isActive: false
      },
      {
        question: 'Nabízíte integraci AI do existujících systémů?',
        answer: 'Ano, implementujeme AI řešení jak do nových projektů, tak do stávajících systémů. Pracujeme s velkými jazykovými modely, počítačovým viděním i vlastními ML modely.',
        isActive: false
      },
      {
        question: 'Jak zajišťujete kvalitu kódu?',
        answer: 'Dodržujeme standardy čistého kódu, provádíme code review a píšeme automatizované testy. Každý projekt prochází testovacím prostředím před nasazením do produkce.',
        isActive: false
      },
      {
        question: 'Jak dlouho trvá vývoj typického projektu?',
        answer: 'Délka vývoje závisí na rozsahu projektu. Jednodušší webová aplikace může být hotová za 4–8 týdnů, komplexní systémy mohou trvat několik měsíců. Přesný harmonogram určíme po analýze požadavků.',
        isActive: false
      },
    ],
    ceny: [
      {
        question: 'Jak jsou stanovovány ceny vašich služeb?',
        answer: 'Ceny stanovujeme individuálně podle rozsahu a složitosti projektu. Po úvodní konzultaci připravíme detailní cenovou nabídku.',
        isActive: false
      },
      {
        question: 'Jaké jsou přibližné ceny webových projektů?',
        answer: 'Ceny webových projektů se pohybují od nižších desítek tisíc korun za jednoduché prezentační weby až po stovky tisíc pro komplexní aplikace. Přesnou kalkulaci připravíme na základě vašich požadavků.',
        isActive: false
      },
      {
        question: 'Nabízíte fixní nebo hodinové sazby?',
        answer: 'Nabízíme oba modely. Fixní cena je vhodná pro jasně definované projekty, hodinová sazba pak pro průběžnou spolupráci a agilní projekty s měnícími se požadavky.',
        isActive: false
      },
      {
        question: 'Existují skryté poplatky?',
        answer: 'Ne, veškeré náklady transparentně uvádíme v cenové nabídce před zahájením spolupráce. Nedochází k žádným překvapivým poplatkům.',
        isActive: false
      },
      {
        question: 'Jaké jsou platební podmínky?',
        answer: 'Standardně fakturujeme zálohu při zahájení projektu a zbytek po dokončení. U dlouhodobých projektů nastavujeme platební milníky.',
        isActive: false
      },
    ],
    spoluprace: [
      {
        question: 'Jak probíhá zahájení spolupráce?',
        answer: 'Spolupráci zahajujeme úvodní konzultací, kde si vyslechneme vaše požadavky. Následuje analýza, příprava nabídky a po odsouhlasení podpis smlouvy.',
        isActive: false
      },
      {
        question: 'Jak komunikujete v průběhu projektu?',
        answer: 'Komunikujeme přes e-mail, videohovory nebo projektový nástroj dle vaší preference. Pravidelně reportujeme stav projektu a jsme k dispozici pro dotazy.',
        isActive: false
      },
      {
        question: 'Mohu sledovat průběh vývoje?',
        answer: 'Ano, klienti mají přístup ke sdílenému projektovému prostoru, kde mohou sledovat aktuální stav, úkoly a hotové funkcionality.',
        isActive: false
      },
      {
        question: 'Pracujete agilně?',
        answer: 'Ano, pracujeme agilní metodikou. Projekt rozdělujeme do sprintů, přičemž po každém sprintu prezentujeme výsledky a sbíráme zpětnou vazbu.',
        isActive: false
      },
      {
        question: 'Podepíšete NDA?',
        answer: 'Samozřejmě. Dohodu o mlčenlivosti podepíšeme před zahájením spolupráce, pokud si to přejete.',
        isActive: false
      },
    ],
    podpora: [
      {
        question: 'Nabízíte podporu po dokončení projektu?',
        answer: 'Ano, po dokončení projektu nabízíme různé úrovně technické podpory — od základní záruční doby až po dlouhodobé servisní smlouvy.',
        isActive: false
      },
      {
        question: 'Jak rychle reagujete na nahlášené problémy?',
        answer: 'Na kritické problémy reagujeme do 4 hodin, standardní požadavky řešíme do 48 hodin. Přesné SLA dohodujeme individuálně.',
        isActive: false
      },
      {
        question: 'Zajišťujete aktualizace a údržbu?',
        answer: 'Ano, nabízíme pravidelnou údržbu, bezpečnostní aktualizace a správu serverů. Vše je součástí servisních balíčků.',
        isActive: false
      },
      {
        question: 'Co se stane, pokud chci projekt rozšířit?',
        answer: 'Rádi projekt rozšíříme o nové funkcionality. Provedeme analýzu požadavků a připravíme nabídku na rozšíření.',
        isActive: false
      },
      {
        question: 'Poskytujete školení k vytvořeným aplikacím?',
        answer: 'Ano, ke každému projektu připravujeme dokumentaci a v případě potřeby zajistíme školení uživatelů i administrátorů.',
        isActive: false
      },
      {
        question: 'Jak nahlásím chybu nebo problém?',
        answer: 'Chyby lze hlásit e-mailem, přes helpdesk systém nebo telefonicky. Každý požadavek evidujeme a průběžně informujeme o stavu řešení.',
        isActive: false
      },
    ],
  };

  // Aktuálně zobrazené položky (podle aktivní kategorie)
  filteredItems: FaqItem[] = [];

  constructor(
    private localizationService: Web.LocalizationService,
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

    // Výchozí kategorie
    this.setCategory(this.activeCategory);
  }

  setCategory(id: string): void {
    this.activeCategory = id;
    // Hluboká kopie, aby se stavy nezachovávaly mezi přepnutími
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