<!--
  @file DESIGN.md
  @path erp/src/app/apps/web/public/shared-styles/DESIGN.md
  @project JS web-platform
  @author JS
  @created 2026
  @description Design pravidla veřejného webu odvozená z redesignu homepage (2026-11). Rozměry,
  rozložení, barvy, typografie, komponenty, pohyb, přístupnost a výkon. Každá další veřejná
  stránka (služby, reference, kariéra, FAQ, kontakt …) se staví podle tohoto dokumentu, aby web
  vypadal jednotně.
  @dependencies apps/web/public/shared-styles/theme.css (tokeny), CSS guide
  (erp/src/app/shared/styles/README.md), apps/web/public/motion/ (Motion 12, motion.dev, MIT)
-->

# Design veřejného webu – pravidla podle homepage (2026-11)

**Zdroj pravdy:** homepage (`apps/web/public/home`) a tokeny v `shared-styles/theme.css`.
Hodnoty níže jsou přečtené z vykreslené stránky (vypočtené styly v Chrome), ne odhadnuté.

**Zásady v jedné větě:** tmavé fialové pozadí s jemnou mřížkou, jedna akcentní barva,
obsah ve sloupci 1200 px, nadpisy Poppins / text Source Sans Pro, málo záře, málo hoverů,
pohyb jen přes `transform` a `opacity` a vždy s variantou pro omezený pohyb.

---

## 1. Rozměry a rozložení

### 1.1 Cílová obrazovka
- Návrh je dělaný pro **desktop 1920 × 1080**, funguje od 1280 px. Telefony a tablety
  (≤ 905 px) mají připnutý hero s vlastní geometrií: náhled aplikace (šířka 100vw − 32 px, max.
  600 px) startuje u spodního okraje hned pod statistikami (aspoň na 74 % výšky, vždy vykoukne
  ≥ 56 px), vyjede do horní části pod header (35 % volné výšky nad ním) a narovná se (28° → 0);
  panel s obsahem pak začíná 28 px pod ním (okraj panelu se dopočítá). Scéna má výšku `100dvh`
  (adresní řádek), rozměry se měří z layoutu při startu, po načtení písem a při změně velikosti.
  Bez ikony myši (`max-width: 905px` nebo `hover: none`). Jeden sloupec dlaždic a stávající
  breakpointy komponent. Statický hero jen s omezeným pohybem.
- Nižší desktopové obrazovky (výška ≤ 860 px – notebooky, zvětšení písma ve Windows): text hera
  začíná 140 px od vrchu a náhled startuje na 68 % výšky, **nebo níž**, pokud text sahá dál –
  vždy 36 px pod statistikami a aspoň 90 px náhledu vidět. Horizont planety leží 300 px nad
  spodním okrajem, nebo těsně nad náhledem; přes statistiky nikdy nejde. Bez ikony myši.

### 1.2 Šířky obsahu
| Použití | Šířka | Token / pravidlo |
|---|---|---|
| Hlavní sloupec (sekce, mřížky, footer) | **1200 px** + 2 × 24 px okraj | `--max-w: 1200px`, `--gutter: 24px` |
| Úzký sloupec – texty, FAQ | **720 px** | `max-width: calc(720px + var(--gutter) * 2)` |
| Řádek CTA | 860 px | `.home-cta-row` |
| Hero obsah | 1100 px, text centrovaný | `.hero-content` |
| Úvodní odstavec pod nadpisem (lead) | 480–620 px | podle délky textu, vždy centrovaný |
| Velká ukázka (video, náhled) | 720 px, poměr 16 : 9 | `.sys-demo-video` |

Nic neroztahujte na celou šířku 1920 px kromě: pozadí, pásu technologií (marquee) a dekorací.

### 1.3 Vertikální rytmus
| Mezera | Hodnota | Token |
|---|---|---|
| Sekce nahoře / dole | **48 px** (polovina `--section-y`) | `calc(var(--section-y) / 2)` |
| Poslední sekce před footerem dole | 96 px | `var(--section-y)` |
| Hlavička sekce → obsah | **48 px** | `--head-gap` |
| Nadpis → lead | **16 px** | `--title-gap` |
| Mezi dvěma řádky typu „text + obrázek“ | 72 px | `.about-story-row + .about-story-row` |
| Mezi položkami seznamu karet (FAQ) | 8 px | `gap: 8px` |
| Mezi řádky pásu technologií | 24 px | `--tech-card-space` |

Mezi hlavními sekcemi je **oddělovač** (`.gradient-seep-wrp > .gradient-line-separator`):
1 px čára, gradient do průhledna na obou koncích, `rgba(166,125,255,0.35)` uprostřed,
s okrajem 24 px nahoře a dole. Při scrollu se vykreslí od středu.

### 1.4 Skladba stránky
```
[ fixní header – pill nahoře uprostřed, logo vlevo, Projekty/FAQ vpravo ]
[ hero / úvod stránky ]
[ obsahový panel (sheet) – sekce oddělené čarou ]
    hlavička sekce: nadpis (H2) + lead, centrované
    obsah sekce
[ CTA řádek (dva bloky + svislý dělič) ]
[ footer – dole lišta: přepínač jazyka · copyright | právní odkazy · přihlášení ]
```
- Header a footer se **nemění** (1:1 komponenty `public-header`, `public-footer`), s jednou
  výjimkou (2026-11): **přepínač jazyka je ve footeru**, ne v headeru – používá se zřídka (jako na
  GitHubu). Sdílená komponenta `app-footer-language-switcher` (web i e-shop): pill s vlajkou a
  jménem jazyka, menu se otevírá **nahoru** ve stylu bývalého dropdownu z headeru (tmavý panel,
  radius 12 px, kulaté vlajky, zaškrtnutí aktivního jazyka); jazyky svým jménem („Čeština“,
  „English“) s atributem `lang`; chybějící / nenačtená vlajka → glóbus. Ovládání klávesnicí
  (šipky, Home / End, Enter, Escape), zavření klikem mimo. S jediným jazykem se nezobrazí. Barvy
  přes `--fls-*` z footeru (e-shop: světlé, hranaté).
- Jazyk první návštěvy: první jazyk prohlížeče, který web má, jinak **angličtina**, jinak první
  aktivní jazyk. Uloží se jen ruční volba ve footeru (funkční nastavení, bez souhlasu).
- Fixní header zabírá nahoře ~92 px (top 20 + výška 52 + rezerva). První obsah stránky
  musí začínat níž – na homepage má hero `padding-top: 196px`, obsahové stránky
  mají rezervu aspoň 140 px.
- Hlavička sekce je vždy **centrovaná**: nadpis, pod ním lead. Obsah pod ní může být
  zarovnaný vlevo (odstavce, mřížky).
- Řádek „text + obrázek“: text `flex: 1.1`, obrázek `flex: 0.6`, mezera 48 px; strany se
  střídají (text vlevo → text vpravo).

---

## 2. Pozadí

| Vrstva | Hodnota |
|---|---|
| Barva stránky | `#0d0d1b` (`--bg`) |
| Mřížka | čtverce **60 px**, čáry 1 px `rgba(166,125,255,0.03)`, **stojí na místě** (obsah jede přes ni) – stejná jako `.main-content::before` v repozitáři |
| Tečkovaný vzor (volitelně pod nadpisem sekce) | tečky 1 px, rozestup 26 px, `rgba(166,125,255,0.14)`, vybledlé do elipsy 700 × 400 px |
| Footer | `#0a0a18` + vlastní mřížka 0.025 (beze změny) |

- Mřížka se nesmí „hýbat“ ani blednout k okrajům (bez masky, bez animace).
- Na homepage je obsah v panelu se zaoblením **56 px nahoře** a horním okrajem
  `1px rgba(166,125,255,0.22)`, který najede přes hero. Na ostatních stránkách panel ani
  připnutý hero nepoužívejte (viz kap. 7.4).

---

## 3. Barvy

Všechny barvy jsou v `apps/web/public/shared-styles/theme.css`. **Nový hex kód do komponenty
nepatří** – použijte token, nebo token přidejte do theme (pravidla v CSS guide §5).

### 3.1 Tokeny
| Token | Hodnota | Použití |
|---|---|---|
| `--bg` | `#0d0d1b` | pozadí stránky, pozadí dlaždic v mřížce |
| `--surface` | `#111128` | karty (FAQ), panely |
| `--surface-2` | `#18183a` | zvýrazněný povrch (hover FAQ ≈ `#161631`) |
| `--accent` | `#a67dff` | aktivní položka menu, čísla a šipky ve FAQ, odkazy, nadpisy sloupců ve footeru, focus |
| `--accent-dark` | `#6b2e91` | pozadí hlavního tlačítka (hover `#7d35ae`) |
| `--accent-dim` | `rgba(166,125,255,0.07)` | jemné podbarvení (hover tlačítka, otevřená otázka) |
| `--border` | `rgba(166,125,255,0.10)` | okraje karet a panelů |
| `--border-mid` | `rgba(166,125,255,0.22)` | okraje tlačítek, výraznější linky |
| vnitřní dělicí linky | `rgba(166,125,255,0.07)` | mezi dlaždicemi v mřížce |

### 3.2 Barvy textu (hierarchie)
| Úroveň | Barva | Kontrast na `#0d0d1b` |
|---|---|---|
| Nadpisy | `#eeeef7` | 16,7 : 1 |
| Hlavní text | `#e0e0f0` | 14,8 : 1 |
| Delší odstavce | `#b4b4c8` | 9,5 : 1 |
| Lead v heru | `#a0a0b5` | 7,5 : 1 |
| Vedlejší text, lead sekce | `#888899` | 5,5 : 1 |
| Lead pod nadpisem sekce | `#7a7a8c` | 4,6 : 1 (na `#111128` jen 4,4 – **nepoužívat na kartách**) |
| Popisky dlaždic, malý text | `#888899` (`--text-lead`) | 5,5 : 1 |

> **Pro nové stránky:** malý text (pod 18 px) nejméně `#888899` (token `--text-lead`). Popisky
> dlaždic na homepage už ho používají.

### 3.3 Akcent a záře – střídmě
- Akcent `#a67dff` je **jediná výrazná barva**. Žádné další barevné odstíny (modrá, zelená …)
  mimo stavové barvy formulářů.
- **Záře (glow) nejvýše jedna na stránku** a jen v hero/úvodu. Na homepage je to horizont
  planety. Karty, tlačítka, oddělovače, videa a CTA **bez záře a bez barevných stínů**.
- Gradientový text jen v hlavním nadpisu hera (bílá → `#e6dcff` → `#b89aff`), jinde ne.

---

## 4. Typografie

Písma jsou **self-hosted** (@fontsource, `src/fonts.css`), nic z Google Fonts (GDPR).

| Písmo | Řezy | Kde |
|---|---|---|
| **Poppins** | 600, 700 | všechny nadpisy `h1–h6` |
| **Source Sans Pro** | 400, 600, 700 | text, `p`, `li`, `span`, tlačítka `.home-cta-btn` |
| **Inter** | 500, 600 | `button`, `.nav-link`, drobné UI prvky |

### 4.1 Velikosti (rem při základu 16 px)
| Role | Velikost | Řez | Řádkování | Barva |
|---|---|---|---|---|
| H1 – hero homepage | **4.4rem** (70 px), `letter-spacing: -0.02em` | 600 | 1.08 | gradient |
| H2 – velký nadpis sekce | 2.8rem (45 px) | 600 | normal | `#eeeef7` |
| **H2 – nadpis sekce (výchozí)** | **2rem** (32 px) | 600 | normal | `#eeeef7` |
| H3 – podnadpis v řádku text + obrázek | 1.7rem (27 px) | 600 | normal | `#eeeef7` |
| Lead v heru | 1.22rem (19,5 px) | 400 | 1.65 | `#a0a0b5` |
| Odstavec (delší text) | 1.05rem (16,8 px) | 400 | 1.65 | `#b4b4c8` |
| Lead sekce | 1rem | 400 | 1.6 | `#7a7a8c` |
| Text karty / FAQ otázka | 0.95rem | 600 | 1.4 | `#e0e0f0` |
| Odpověď FAQ | 0.91rem | 400 | 1.75 | `#888899` |
| Popisek dlaždice | 0.92rem | 700 | 1.3 | `#d0d0e0` |
| Tlačítko | 0.92rem | 600 | – | `#e0e0f0` / bílá |
| Malý text, meta | 0.8rem | 400 | 1.5 | ≥ `#888899` |
| Štítek / číslo (FAQ 01) | 0.7rem, `letter-spacing: 0.08em` | 700 | – | `#a67dff` |

> Výjimka z historie: nadpis FAQ na homepage má 1.9rem / 700 / `#e0e0e0` se stínem.
> Na nových stránkách používejte výchozí H2 (2rem / 600 / `#eeeef7`).

Odstavce delší než dva řádky: `text-align: justify` jen v řádcích text + obrázek, jinak vlevo.
Dlouhé řádky max. ~75 znaků (proto úzký sloupec 720 px pro čistý text).

---

## 5. Komponenty

### 5.1 Zaoblení
| Prvek | Radius |
|---|---|
| Tlačítka, štítky, menu, přepínač jazyka ve footeru | `999px` (pill; v e-shopu `0`) |
| Karty FAQ, malé karty | `12px` |
| Panely, mřížka dlaždic | `16px` |
| Obrázky v sekcích, karty technologií | `18px` |
| Rámeček náhledu aplikace (hero) | `22px` vnější / `12px` obrazovka |
| Obsahový panel přes hero | `56px` nahoře |

### 5.2 Tlačítka (`.home-cta-btn`)
- Pill, `padding: 12px 24px`, okraj `1px var(--border-mid)`, text 0.92rem / 600.
- **Hlavní** (`--accent`): pozadí `#6b2e91`, okraj `#a67dff`, bílý text; hover `#7d35ae`.
- **Vedlejší**: průhledné; hover pozadí `--accent-dim`, okraj `#a67dff`, posun −2 px.
- V jednom bloku nejvýš **jedno hlavní** tlačítko. Dvojice = hlavní vlevo, vedlejší vpravo,
  mezera 16 px.

### 5.3 Karty a panely
- Pozadí `--surface` (`#111128`) nebo `--bg`, okraj `1px var(--border)`, bez stínu.
- Mřížka dlaždic: 2 sloupce, vnitřní linky `rgba(166,125,255,0.07)`, vnější rámeček
  `--border`, radius 16 px, padding dlaždice `22px 24px`.
- Ilustrační obrázek v sekci: poměr 3 : 4, max. 260 px, lehký náklon (`rotateY ∓12°`,
  `rotateX 5°`, `rotate ∓2°`) podle strany, neutrální stín.

### 5.4 Opakované bloky
- **Hlavička sekce** – nadpis H2 + lead, centrované, mezera 16 px, pod ní 48 px.
- **FAQ** – akordeon jen v CSS (checkbox), sloupec 720 px, číslo 01–04 akcentem, šipka se
  otočí o 180°; otevření 0,45 s `easeInOut`.
- **CTA řádek** – dva bloky se svislým dělicím pruhem (1 × 120 px), text 0.95rem max. 240 px,
  pod ním tlačítko.
- **Pás technologií** – dvě řady proti sobě, karty 260 × 150 px, loga šedá s 70 % krytím,
  **bez hoveru**, bez tlačítka pro pozastavení (rozhodnutí vlastníka, viz kap. 8).

### 5.5 Hover – jen tam, kde se dá kliknout
Povolené hover efekty (a žádné jiné):
- tlačítka `.home-cta-btn` (viz 5.2),
- otázka FAQ (pozadí `#161631`),
- odkaz „Zobrazit všechny otázky“ (mezera šipky 8 → 12 px),
- tlačítko přehrání videa (zvětšení 1.05),
- odkazy v headeru a footeru (beze změny).

Dekorace, karty bez odkazu, loga a obrázky **na myš nereagují**. Přechody 0,15–0,25 s `ease`.

---

## 6. Ikony a obrázky
- Ikony v řádku textu 15–16 px, `stroke-width: 1.8–2`, barva `currentColor` nebo akcent.
- Snímky aplikace (screenshoty) vždy v **rámečku** (náhled prohlížeče nebo karta), nikdy
  volně na pozadí. WebP, max. ~1600 px šířky, `decoding="async"`, rozměry v atributech.
- Dekorativní obrázky `alt=""` + `aria-hidden="true"`.

---

## 7. Pohyb (motion)

Knihovna **Motion 12** (`motion` z npm, MIT) ve složce `apps/web/public/motion/`. Pravidla
vycházejí z `claude-motion` (motion-design), `iart-ai/web-animation-skills` (60fps-animation,
accessible-animation, gsap-web), `xiaopu-ai/web-design` (výkonnostní červené čáry, homepage jako
jediné „wow“) a `ConardLi/garden-skills` web-design-engineer (redesign v režimu *Preserve* –
rozložení, routy, formuláře a texty ostatních stránek zůstávají).

| Soubor | Co dělá |
|---|---|
| `motion-presets.ts` | křivky, pružiny, `band()`, `lerp()`, `clamp01()` |
| `web-motion.service.ts` | omezený pohyb (živě), jeden sdílený IntersectionObserver, `linkScroll()` (scroll přes pružinu), `promote()` (will-change jen při pohybu); vše mimo Angular zónu |
| `reveal.directive.ts` | `appReveal` (blok) a `appReveal="group"` (děti postupně), `[revealDelay]` |
| `reveal-text.directive.ts` | `[appRevealText]="text"` – maska slov (`mask`, `load`), rozsvícení slov (`words`), `[revealTextBreaks]` pro `<br>` |
| `scroll-effect.directive.ts` | `appScrollEffect`: `draw-x`, `draw-y`, `zoom`, `tilt`, `slide`, `cascade` |

### 7.1 Předvolby
| Název | Hodnota | Kdy |
|---|---|---|
| `EASE_OUT` | `cubic-bezier(0.16, 1, 0.3, 1)` | vše, co přichází (vstupy, odkrytí) |
| `EASE_IN_OUT` | `cubic-bezier(0.65, 0, 0.35, 1)` | přechod mezi dvěma stavy (hero, akordeon) |
| `tileEase` | `cubic-bezier(0.33, 1, 0.68, 1)` | příjezd dlaždic při scrollu (pomalejší začátek) |
| `SPRING_UI` | damping 14 / stiffness 140 / mass 0.8 | prvky UI, karty, bloky |
| `SPRING_HEAVY` | damping 18 / stiffness 180 / mass 0.8 | velké panely (náhled v heru) |
| `SCROLL_SMOOTH` | stiffness 500 / damping 24 / mass 0.25 | vyhlazení scrollu (~30 ms, bez setrvačnosti) |
| `linear` | – | jen nepřetržitý pohyb (marquee) |

### 7.2 Vzory (a kde je použít)
| Vzor | Parametry | Použití |
|---|---|---|
| **Maska slov** u nadpisu (`[appRevealText]`) | slovo vyjede zpod ořezu `y 118 % → 0`, `rotate 5° → 0`, 0,8 s, odstup slov 0,09 s, spustí se při 60 % viditelnosti, jednou | nadpis stránky (`load`), každý H2 / H3 sekce |
| **Vynoření** (`appReveal`) | `opacity 0 → 1`, `y 28 → 0`, `SPRING_UI`, zpoždění 0,15 s, při 40 % viditelnosti | lead, samostatné bloky |
| **Skupina postupně** (`appReveal="group"`) | `y 36 → 0`, odstup 0,07 s | FAQ, seznamy, karty |
| **Rozsvícení slov** (`revealTextMode="words"`) | krytí slov 0,36 → 1 podle scrollu, rozsah `start 0.95` → `end 0.7` (celý rozsvícený, když spodní okraj odstavce dojede na 70 % výšky obrazovky); **na telefonu a tabletu (≤ 905 px) vypnuté** – odstavec je celý vidět hned | delší odstavec v řádku text + obrázek |
| **Natočený obrázek** (`appScrollEffect="tilt"`) | obal obrázku: navíc `rotateY ±38° → 0`, posun ±120 px → 0, `scale 0.82 → 1`; obrázek si drží svůj klidový náklon | obrázek v řádku text + obrázek |
| **Dlaždice po řádcích** (`appScrollEffect="cascade"`) | levé zleva, pravé zprava, posun 300 px, náklon ∓2,2°, řádek o 0,16 později, okno 0,42; **jeden sloupec (telefon):** každá dlaždice podle své pozice (`start 1` → `start 0.78`), strany se střídají, posun 120 px, rámeček hned | mřížka 2 sloupce (kap. 5.3) |
| **Přiblížení** (`appScrollEffect="zoom"`) | `scale 0.78 → 1` | jedna velká ukázka (video) |
| **Řady proti sobě** (`appScrollEffect="slide"`) | ±320 px → 0 | pás technologií / log |
| **Kresba čáry** (`appScrollEffect="draw-x" / "draw-y"`) | `scaleX 0 → 1` od středu | oddělovače sekcí, svislý dělič CTA |

### 7.3 Pevná pravidla
1. **Animovat jen `transform` a `opacity`.** Ne `width/height/top/left/margin`, ne
   `box-shadow`, ne `filter: blur`. Stín nebo záře se mění přes `opacity` samostatné vrstvy.
2. **Pohyb vázaný na scroll vždy přes pružinu** (`springValue`, `SCROLL_SMOOTH`), nikdy
   přímo – jinak skáče s kolečkem myši.
3. **`will-change` jen během pohybu** (`WebMotionService.promote()`), v klidu `auto`. Trvale jen
   na náhledu v heru a na marquee.
4. Nepsat každý snímek CSS proměnné na rodiče sekcí (přepočítává to styly celého podstromu).
   Styly se zapisují přímo na animovaný prvek.
5. Odkrytí se spouští **jednou** (žádné opakování při scrollu zpět), kromě scrubovaných scén.
6. Všechna odkrytí sdílí **jeden observer** (`WebMotionService.whenVisible()`), ne jeden na prvek.
7. Výstup (zmizení) je kratší než vstup.
8. Skrytí před odkrytím nastavují direktivy až v prohlížeči s IntersectionObserverem; bez něj je
   obsah vidět hned. Text rozdělený na slova zůstává celý v DOM (čtečky, vyhledávače).
9. Vše běží mimo Angular zónu (`WebMotionService.outside()`) – snímek scrollu ani animace
   nespouští detekci změn.
10. Dekorativní vrstvy (`aria-hidden`), které leží nad obsahem nebo jsou absolutně přes sekci
   (náhled aplikace v heru, záře, nápověda scrollu), mají `pointer-events: none`. Průhledný box
   jinak zachytí kliknutí a tlačítka pod ním nereagují.

### 7.4 Kolik pohybu na stránku
- **Jeden hlavní moment na stránku.** Na homepage je to připnutý hero, kde se náhled
  aplikace narovná. **Připnutou scénu (pin) má jen homepage.**
- Obsahové stránky (O nás, služby, reference, kariéra, FAQ, znalostní báze, kontakt): maska slov
  u nadpisu stránky (`load`) a nadpisů sekcí, vynoření, skupiny postupně, kresba oddělovačů.
  Volitelně jeden scrollovaný efekt na stránku (dlaždice po řádcích, natočený obrázek, přiblížení).
- **Bez pohybu:** právní stránky (GDPR, obchodní podmínky, cookies), 404, přihlášení (login,
  aktivace účtu, reset hesla) a veřejný formulář objednávky – jen barvy a písma webu.

---

## 8. Přístupnost

- **Omezený pohyb po stupních** (`prefers-reduced-motion: reduce`; pro test emulace v DevTools →
  Rendering → *Emulate CSS media feature prefers-reduced-motion*):
  - *odstranit:* připnutý hero, posuny, náklony, zoomy, masky slov, marquee;
  - *zjemnit:* vše, co by najíždělo, se jen objeví (opacity, 150 ms);
  - *ponechat:* barevné přechody, focus, rozbalení FAQ.
  - Změna nastavení v systému se projeví bez obnovení stránky (`WebMotionService`, posluchač
    `change`): běžící scény hned skočí do konečné pózy, čekající odkrytí se jen rozsvítí.
- **WCAG 2.2.2:** cokoli se samo pohybuje déle než 5 s (marquee, karusel) by mělo mít tlačítko
  pozastavit / spustit. Pás technologií ho na přání vlastníka nemá – zastaví ho jen omezený pohyb.
- Focus: `outline: 2px solid #a67dff`, `outline-offset: 2px` (u karet `-2px`).
- Kontrast textu min. 4,5 : 1 (kap. 3.2). Dekorace `aria-hidden="true"`.
- Text v DOM zůstává celý i po rozdělení na slova (čtečky ho čtou normálně).

---

## 9. Výkon
- Ověření: v DevTools → Performance při scrollu nesmí být každý snímek fialové „Layout“
  ani zelené „Paint“ (jen „Composite Layers“).
- Velké rozmazání (`filter: blur`) jen na statických vrstvách, nikdy animované.
- `backdrop-filter` jen v headeru (pill, logo, odkazy vpravo) – jinde ne.
- Obrázky WebP, lazy pod zlomem, rozměry v atributech (bez skoku layoutu).

---

## 10. Právní minimum (EU / ČR)
- Žádné načítání z cizích serverů bez souhlasu: písma self-hosted, knihovny přes npm build.
- Budoucí Google recenze stahovat **na serveru** (Laravel, Places API), ne widgetem Googlu
  v prohlížeči; u recenzí uvést, jak se ověřuje jejich původ (pravidla ochrany spotřebitele).
- Footer: firma, sídlo, IČO, **zápis v obchodním rejstříku (oddíl, vložka, soud)** –
  § 435 občanského zákoníku. Spisová značka v nastavení firmy zatím chybí.

---

## 11. Kontrolní seznam pro novou stránku
- [ ] Obsah v `--max-w` 1200 px (text 720 px), okraje `--gutter`.
- [ ] Sekce: 48 px nahoře / dole, hlavička centrovaná, 48 px pod hlavičkou, oddělovač mezi sekcemi.
- [ ] Pozadí `#0d0d1b` + fixní mřížka 60 px / 0.03.
- [ ] Jen tokeny z `theme.css`, žádný nový hex v komponentě.
- [ ] Nadpisy Poppins (H2 2rem / 600), text Source Sans Pro, velikosti podle tabulky 4.1.
- [ ] Malý text ≥ `#888899`.
- [ ] Žádná záře mimo úvod stránky, žádné barevné stíny.
- [ ] Hover jen na klikatelných prvcích ze seznamu 5.5.
- [ ] Dekorace nad obsahem mají `pointer-events: none` – všechna tlačítka a odkazy jdou kliknout.
- [ ] Pohyb podle 7.2 / 7.4, jen `transform` + `opacity`, bez pinu.
- [ ] Funguje s emulací `prefers-reduced-motion: reduce`.
- [ ] Nic se nenačítá z cizích domén.
- [ ] Texty z překladů (`t.*`), komentáře podle šablon v `docs/code_documentation`.
- [ ] Nadpis přes `[appRevealText]`, ne `{{ }}` – host direktivy nesmí mít jiný obsah.

---

## 12. Kde co je
| Co | Kde |
|---|---|
| Tokeny barev, `--max-w`, `--gutter`, `--section-y`, `--head-gap`, `--title-gap`, `--heading`, `--text-soft`, `--text-lead`, `--ease-out`, `--ease-in-out` | `apps/web/public/shared-styles/theme.css` |
| Rámec obsahové stránky (hero, mřížka pozadí) | `shared-styles/content-page.css` + `::before` mřížka v každé stránce |
| Pohyb | `apps/web/public/motion/` (kap. 7) |
| Homepage (připnutý hero – desktop i telefon, panel přes hero, kaskáda dlaždic) | `apps/web/public/home/` |
| Formulář objednávky portálu (tmavý vzhled webu, vlastní kopie hodnot) | `apps/project-portal/public/order-form/` |
| Přihlášení (tokeny vzhledu webu) | `shared/styles/auth-form.css` |
| Právní stránky, 404 (tmavá varianta webu) | `public/legal/legal-page/`, `public/not-found/` |
