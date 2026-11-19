<?php
/**
 * @file 2026_11_20_000000_create_web_knowledge_base.php
 * @path api/app/Apps/Web/Database/Migrations/2026_11_20_000000_create_web_knowledge_base.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description The public knowledge base of the website (/knowledge-base) moves from the
 *   translation files (storage/app/public/translations/web/{lang}.json, key `knowledge-base`) to
 *   the database, so the admin edits it as content (web/edit-website, tab Knowledge base), every
 *   text per language:
 *   - web_kb_sections - the introduction of the page (one row, `is_intro`: main heading + first
 *     text) and the blocks (heading, text, an optional image at the end, shown / hidden, order);
 *   - web_kb_items - the optional sub-blocks of a block (smaller heading + text).
 *   The former chapters (`sections.*`: header, lead, item_1…item_4) become blocks with their
 *   sub-blocks, the hero becomes the introduction; the glossary is dropped. The moved keys and the
 *   glossary are removed from the files (the footer link and the call to action stay there).
 *   Czech without that content (a new installation, the repository copy of cz.json) gets the
 *   former Czech texts.
 * @note During the unit tests the translation files are never read or changed (the defaults are
 *   used).
 * @note down() drops the tables; the content is NOT written back to the translation files.
 * @dependencies none
 */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @description Former chapters in the order of the page. */
    private const CHAPTERS = ['security', 'legal', 'admin', 'ui_ux', 'database', 'api', 'hosting', 'deployment', 'performance', 'support'];

    /** @description Keys of `knowledge-base` moved to the database or dropped (glossary). */
    private const MOVED_KEYS = ['hero', 'sections', 'glossary'];

    /** @description Content of the translation files before this change (Czech), used without any. */
    private const DEFAULTS = [
        'cz' => [
            'hero' => [
                'heading' => 'Co všechno váš systém obsahuje',
                'lead' => 'Tato stránka srozumitelně vysvětluje, co je součástí každého systému, který u nás objednáte - od zabezpečení přes administraci až po hosting a technickou podporu. Bez zbytečného žargonu.',
            ],
            'sections' => [
                'security' => [
                    'header' => 'Zabezpečení a ochrana dat',
                    'lead' => 'Bezpečnost není doplněk, který se řeší až na konci - je součástí návrhu systému od prvního dne. Níže najdete přehled hlavních opatření, která u každého projektu standardně používáme.',
                    'item_1' => ['title' => 'Zabezpečené přihlašování', 'text' => 'Hesla se nikdy neukládají v čitelné podobě - jsou zpracována jednosměrným šifrováním (hashováním), takže je nikdo, ani my, nevidí. U administrace navíc nabízíme dvoufaktorové ověření (2FA), které přidává druhý ověřovací krok navíc k heslu.'],
                    'item_2' => ['title' => 'Šifrovaná komunikace (HTTPS/SSL)', 'text' => 'Veškerá komunikace mezi prohlížečem uživatele a serverem je šifrovaná pomocí certifikátu SSL/TLS. Data přenášená mezi vaším počítačem a serverem tak nelze cestou odposlechnout ani upravit.'],
                    'item_3' => ['title' => 'Vícevrstvá kontrola požadavků', 'text' => 'Každý požadavek na server prochází sérií bezpečnostních kontrol (middleware), než se vůbec dostane k datům. Neoprávněné nebo podezřelé požadavky se tak zastaví hned na začátku, dřív, než mohou způsobit škodu.'],
                    'item_4' => ['title' => 'Ochrana proti běžným typům útoků', 'text' => 'Systém je navržen odolný proti běžně známým typům útoků na webové aplikace a proti automatizovanému zkoušení hesel. Používáme stejné bezpečnostní principy, jaké najdete u bank a velkých online služeb.'],
                ],
                'legal' => [
                    'header' => 'GDPR a soulad s právem EU',
                    'lead' => 'Systém je od návrhu stavěný tak, aby respektoval evropskou legislativu na ochranu osobních údajů (GDPR) a další relevantní právní požadavky platné v EU.',
                    'item_1' => ['title' => 'Zpracování osobních údajů', 'text' => 'Formuláře, registrace a další místa, kde se sbírají osobní údaje, obsahují jasný souhlas se zpracováním a odkaz na zásady ochrany osobních údajů, přesně podle požadavků GDPR.'],
                    'item_2' => ['title' => 'Cookies a souhlas návštěvníka', 'text' => 'Web obsahuje cookie lištu, která rozlišuje nezbytné, funkční, analytické a marketingové cookies - a analytické či marketingové skripty se spouští až po udělení souhlasu, ne dřív.'],
                    'item_3' => ['title' => 'Právo na výmaz a přístup k datům', 'text' => 'Systém je navržen tak, aby umožňoval vyřídit žádosti uživatelů týkající se jejich osobních údajů - například jejich export nebo smazání, v souladu s právy, která GDPR uživatelům garantuje.'],
                    'item_4' => ['title' => 'Uložení dat v rámci EU', 'text' => 'Data jsou standardně ukládána na serverech v rámci Evropské unie, takže se na ně vztahuje evropská jurisdikce a evropské standardy ochrany dat.'],
                ],
                'admin' => [
                    'header' => 'Vlastní administrační rozhraní',
                    'lead' => 'Ke každému systému dostanete přehlednou administraci, přes kterou spravujete obsah, objednávky i uživatele - bez nutnosti znát programování.',
                    'item_1' => ['title' => 'Oddělená sekce Web a Shop', 'text' => 'Administrace je logicky rozdělena na dvě části - správu veřejné prezentace (texty, stránky, obsah) a správu e-shopu (produkty, objednávky, sklad, platby). Každá část má vlastní přehledné menu.'],
                    'item_2' => ['title' => 'Uživatelské role a oprávnění', 'text' => 'Můžete nastavit, kdo v administraci co vidí a co smí upravovat - například administrátor vidí a upravuje vše, zatímco běžný zaměstnanec má přístup jen k vybrané části systému.'],
                    'item_3' => ['title' => 'Správa obsahu bez zásahu programátora', 'text' => 'Texty, obrázky, produkty i další obsah upravujete přímo v administraci. Pro běžné změny obsahu tak nepotřebujete volat vývojáře.'],
                    'item_4' => ['title' => 'Přehledy a reporting', 'text' => 'Administrace zobrazuje základní přehledy a statistiky (např. objednávky, poptávky, návštěvnost formulářů), takže máte o dění na webu jasný přehled na jednom místě.'],
                ],
                'ui_ux' => [
                    'header' => 'UI/UX - vzhled a použitelnost',
                    'lead' => 'Systém není jen funkční, ale je i příjemný na používání - jak pro návštěvníky webu, tak pro vás v administraci.',
                    'item_1' => ['title' => 'Responzivní design', 'text' => 'Web se automaticky přizpůsobí jakémukoliv zařízení - mobilnímu telefonu, tabletu i velkému monitoru. Vzhled i funkčnost zůstávají zachované na všech rozlišeních.'],
                    'item_2' => ['title' => 'Intuitivní navigace', 'text' => 'Struktura webu i administrace je navržena tak, aby se v ní uživatel zorientoval bez nutnosti návodu - logické menu, jasné popisky a konzistentní rozmístění prvků.'],
                    'item_3' => ['title' => 'Rychlé načítání', 'text' => 'Grafické prvky, obrázky i skripty jsou optimalizované tak, aby se stránky načítaly rychle - to zlepšuje uživatelský zážitek i pozici webu ve vyhledávačích.'],
                    'item_4' => ['title' => 'Přístupnost (accessibility)', 'text' => 'Dbáme na dostatečný kontrast textu, popisky pro čtečky obrazovky a ovládání pomocí klávesnice, aby byl web použitelný pro co nejširší okruh návštěvníků.'],
                ],
                'database' => [
                    'header' => 'Databáze',
                    'lead' => 'Veškerý obsah, objednávky a uživatelské účty jsou uloženy v relační databázi - osvědčeném a stabilním způsobu ukládání dat, který používá naprostá většina moderních webových systémů.',
                    'item_1' => ['title' => 'Relační databáze', 'text' => 'Data jsou strukturovaná do přehledných, provázaných tabulek (např. produkty, objednávky, zákazníci). Díky tomu je systém přesný, konzistentní a snadno rozšiřitelný o nové funkce.'],
                    'item_2' => ['title' => 'Integrita a konzistence dat', 'text' => 'Databáze hlídá vazby mezi jednotlivými daty - například nejde smazat produkt, který je součástí existující objednávky, aniž by systém na tuto souvislost upozornil.'],
                    'item_3' => ['title' => 'Pravidelné zálohování', 'text' => 'Data jsou pravidelně zálohována, takže v případě neočekávané situace lze systém obnovit do funkčního stavu s minimální ztrátou dat.'],
                    'item_4' => ['title' => 'Oddělení dat od aplikace', 'text' => 'Databáze běží odděleně od zbytku aplikace, což zvyšuje bezpečnost i možnost systém do budoucna škálovat podle rostoucích nároků.'],
                ],
                'api' => [
                    'header' => 'API - propojení webu a serveru',
                    'lead' => 'Frontend (to, co vidí návštěvník) a backend (server, který zpracovává data) spolu komunikují přes zabezpečené rozhraní API postavené na frameworku Laravel.',
                    'item_1' => ['title' => 'Oddělený frontend a backend', 'text' => 'Veřejný web, e-shop i administrace komunikují se serverem přes definované API. Toto oddělení zvyšuje přehlednost, bezpečnost i možnost budoucího rozšíření (např. o mobilní aplikaci).'],
                    'item_2' => ['title' => 'Ověřování každého požadavku', 'text' => 'Každý požadavek na citlivá data (např. v administraci) je ověřen, že přichází od přihlášeného a oprávněného uživatele - nezalogovaný návštěvník se k datům nedostane.'],
                    'item_3' => ['title' => 'Validace vstupních dat', 'text' => 'Veškerá data odeslaná přes formuláře nebo administraci procházejí kontrolou správnosti a formátu ještě předtím, než se uloží do databáze - chybná nebo škodlivá data se tak k systému vůbec nedostanou.'],
                    'item_4' => ['title' => 'Napojení na externí systémy', 'text' => 'Stejný princip API využíváme i pro napojení na externí služby - platební brány, účetní systémy, e-mailing nebo jiné nástroje, které ve firmě už používáte.'],
                ],
                'hosting' => [
                    'header' => 'Hosting',
                    'lead' => 'Systém provozujeme na serverech od hostingového poskytovatele Forpsi, který patří mezi zavedené a spolehlivé poskytovatele hostingu v České republice.',
                    'item_1' => ['title' => 'Server v rámci EU', 'text' => 'Data jsou fyzicky uložena na serverech v rámci Evropské unie, což zjednodušuje soulad s GDPR a zaručuje předvídatelnou právní jurisdikci nad vašimi daty.'],
                    'item_2' => ['title' => 'Dostupnost a spolehlivost', 'text' => 'Hosting je navržen tak, aby zajišťoval vysokou dostupnost webu - tedy aby byl váš web přístupný pro zákazníky prakticky nepřetržitě.'],
                    'item_3' => ['title' => 'SSL certifikát v ceně provozu', 'text' => 'Součástí hostingu je platný SSL certifikát zajišťující šifrované připojení (HTTPS) mezi návštěvníkem a webem.'],
                    'item_4' => ['title' => 'Sledování provozu', 'text' => 'Provoz serveru je monitorován, takže případné výpadky nebo neobvyklé chování systému lze rychle odhalit a řešit.'],
                ],
                'deployment' => [
                    'header' => 'Jak se aktualizace dostávají na server',
                    'lead' => 'Nové verze webu, opravy nebo nové funkce se na server nasazují kontrolovaným způsobem, aby nedošlo k výpadku ani ztrátě dat.',
                    'item_1' => ['title' => 'Zabezpečený vzdálený přístup (SSH)', 'text' => 'Přístup na server pro nasazení nových verzí probíhá přes šifrovaný protokol SSH, který zajišťuje, že komunikace mezi naším týmem a serverem je chráněná před odposlechem.'],
                    'item_2' => ['title' => 'Přenos souborů (FTP/SFTP)', 'text' => 'Pro nahrávání souborů (např. obrázků nebo aktualizací) používáme zabezpečené protokoly pro přenos dat, které šifrují obsah přenášených souborů.'],
                    'item_3' => ['title' => 'Testování před nasazením', 'text' => 'Nové změny se nejprve otestují mimo ostrý provoz, aby se předešlo neočekávaným chybám na živém webu, který používají vaši zákazníci.'],
                    'item_4' => ['title' => 'Verzování kódu', 'text' => 'Veškerý zdrojový kód je verzovaný, tedy má vedenou historii všech změn. V případě potřeby se tak lze kdykoliv vrátit k předchozí funkční verzi systému.'],
                ],
                'performance' => [
                    'header' => 'Výkon a škálovatelnost',
                    'lead' => 'Systém stavíme tak, aby zvládl nejen dnešní provoz, ale i budoucí růst návštěvnosti a rozšiřování funkcí.',
                    'item_1' => ['title' => 'Optimalizace načítání', 'text' => 'Obrázky, skripty i styly jsou optimalizovány tak, aby se stránka načítala co nejrychleji, i na pomalejším připojení.'],
                    'item_2' => ['title' => 'Efektivní práce s daty', 'text' => 'Databázové dotazy jsou navrženy s ohledem na výkon, takže systém zůstává rychlý i s rostoucím množstvím dat a uživatelů.'],
                    'item_3' => ['title' => 'Cachování (ukládání do mezipaměti)', 'text' => 'Často používaná data se dočasně ukládají do rychlé mezipaměti, díky čemuž systém nemusí opakovaně provádět stejné náročné výpočty.'],
                    'item_4' => ['title' => 'Připraveno na růst', 'text' => 'Architektura systému je navržena modulárně - lze ji v budoucnu rozšířit o nové funkce nebo přesunout na výkonnější infrastrukturu bez nutnosti stavět systém znovu od základu.'],
                ],
                'support' => [
                    'header' => 'Podpora, aktualizace a údržba',
                    'lead' => 'Spuštěním projektu naše práce nekončí. Ke každému systému nabízíme dlouhodobou podporu, aby zůstal bezpečný, aktuální a funkční.',
                    'item_1' => ['title' => 'Pravidelné aktualizace', 'text' => 'Použité technologie a knihovny pravidelně aktualizujeme, abychom udrželi systém bezpečný a kompatibilní s aktuálními standardy webu.'],
                    'item_2' => ['title' => 'Zálohování dat', 'text' => 'Data jsou pravidelně zálohována, takže v případě problému lze systém rychle obnovit s minimální ztrátou informací.'],
                    'item_3' => ['title' => 'Technická podpora', 'text' => 'V případě problému nebo dotazu jsme vám k dispozici - kritické problémy řešíme přednostně, standardní požadavky v rámci dohodnuté doby odezvy.'],
                    'item_4' => ['title' => 'Prostor pro další rozvoj', 'text' => 'Systém je postaven tak, aby se dal průběžně rozšiřovat o nové funkce podle toho, jak roste vaše podnikání.'],
                ],
            ],
        ],
    ];

    /**
     * @description Creates the tables and moves the content over.
     * @return void
     */
    public function up(): void
    {
        Schema::create('web_kb_sections', function (Blueprint $table) {
            $table->id();
            $table->boolean('is_intro')->default(false)->comment('The introduction of the page (one row, no image)');
            $table->json('heading_i18n')->nullable();
            $table->json('text_i18n')->nullable()->comment('Plain text');
            $table->string('image_path')->nullable()->comment('WebP on the public disk (knowledge-base/...)');
            $table->boolean('is_active')->default(true)->comment('Shown on the public website');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('web_kb_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('section_id')->constrained('web_kb_sections')->cascadeOnDelete();
            $table->json('title_i18n')->nullable();
            $table->json('text_i18n')->nullable()->comment('Plain text');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        $files = app()->runningUnitTests() ? [] : $this->translationFiles();
        $legacy = [];
        foreach ($files as $lang => $data) {
            $content = $data['knowledge-base'] ?? null;
            if (is_array($content) && (isset($content['hero']) || isset($content['sections']))) {
                $legacy[$lang] = $content;
            }
        }

        // The built-in Czech always exists: its former texts when its file has none any more.
        $this->import(['cz' => $legacy['cz'] ?? self::DEFAULTS['cz']] + $legacy);

        foreach ($files as $lang => $data) {
            $content = $data['knowledge-base'] ?? null;
            if (is_array($content) && array_intersect(self::MOVED_KEYS, array_keys($content))) {
                $this->writeWithoutMoved($lang, $data);
            }
        }
    }

    /**
     * @description Drops the tables (the content is not written back to the translation files).
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('web_kb_items');
        Schema::dropIfExists('web_kb_sections');
    }

    /** @description Directory of the translation files of the public website. */
    private function directory(): string
    {
        return storage_path('app/public/translations/web');
    }

    /**
     * @description Readable translation files of the public website.
     * @return array<string, array> Language code => decoded file.
     */
    private function translationFiles(): array
    {
        $files = [];
        foreach (glob($this->directory() . '/*.json') ?: [] as $path) {
            $lang = basename($path, '.json');
            $data = json_decode((string) file_get_contents($path), true);
            if (preg_match('/^[a-z]{2,5}(?:[-_][a-z0-9]{2,8})?$/i', $lang) && is_array($data)) {
                $files[strtolower($lang)] = $data;
            }
        }

        return $files;
    }

    /**
     * @description Writes the translation file without the moved keys (same format as the admin
     *   writes it, TranslationController).
     * @param string $lang Language code.
     * @param array $data Decoded file.
     * @return void
     */
    private function writeWithoutMoved(string $lang, array $data): void
    {
        foreach (self::MOVED_KEYS as $key) {
            unset($data['knowledge-base'][$key]);
        }

        file_put_contents($this->directory() . "/{$lang}.json", json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    /**
     * @description Stores the introduction and the chapters of all languages (merged by the
     *   chapter key, the sub-blocks by their number).
     * @param array<string, array> $legacy Language code => `knowledge-base` of its file.
     * @return void
     */
    private function import(array $legacy): void
    {
        $intro = ['heading' => [], 'text' => []];
        $chapters = [];
        foreach ($legacy as $lang => $content) {
            $intro['heading'][$lang] = $this->text($content['hero']['heading'] ?? '');
            $intro['text'][$lang] = $this->text($content['hero']['lead'] ?? '', true);
            foreach (self::CHAPTERS as $key) {
                $chapter = $content['sections'][$key] ?? null;
                if (!is_array($chapter)) {
                    continue;
                }
                $chapters[$key]['heading'][$lang] = $this->text($chapter['header'] ?? '');
                $chapters[$key]['text'][$lang] = $this->text($chapter['lead'] ?? '', true);
                foreach ($chapter as $itemKey => $item) {
                    if (preg_match('/^item_(\d+)$/', (string) $itemKey, $m) && is_array($item)) {
                        $chapters[$key]['items'][(int) $m[1]]['title'][$lang] = $this->text($item['title'] ?? '');
                        $chapters[$key]['items'][(int) $m[1]]['text'][$lang] = $this->text($item['text'] ?? '', true);
                    }
                }
            }
        }

        $now = now();
        DB::table('web_kb_sections')->insert([
            'is_intro' => true,
            'heading_i18n' => $this->json($intro['heading']),
            'text_i18n' => $this->json($intro['text']),
            'is_active' => true,
            'sort_order' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $order = 1;
        foreach (self::CHAPTERS as $key) {
            if (!isset($chapters[$key])) {
                continue;
            }
            $sectionId = DB::table('web_kb_sections')->insertGetId([
                'is_intro' => false,
                'heading_i18n' => $this->json($chapters[$key]['heading']),
                'text_i18n' => $this->json($chapters[$key]['text']),
                'is_active' => true,
                'sort_order' => $order++,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $items = $chapters[$key]['items'] ?? [];
            ksort($items);
            foreach (array_values($items) as $index => $item) {
                DB::table('web_kb_items')->insert([
                    'section_id' => $sectionId,
                    'title_i18n' => $this->json($item['title'] ?? []),
                    'text_i18n' => $this->json($item['text'] ?? []),
                    'sort_order' => $index,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    /**
     * @description Plain text of a former value (tags dropped, entities decoded).
     * @param mixed $value Former value.
     * @param bool $multiline Keep line breaks (`<br>` = a line break).
     * @return string
     */
    private function text(mixed $value, bool $multiline = false): string
    {
        $text = is_string($value) || is_int($value) ? (string) $value : '';
        $text = preg_replace('/<br\s*\/?>/i', "\n", $text);
        $text = html_entity_decode(strip_tags((string) $text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = $multiline ? preg_replace('/[^\S\n]+/u', ' ', $text) : preg_replace('/\s+/u', ' ', $text);
        $text = $multiline ? preg_replace('/ *\n */u', "\n", (string) $text) : $text;

        return trim((string) $text);
    }

    /**
     * @description JSON of a text per language without the empty languages.
     * @param array<string, string> $texts Language code => text.
     * @return string
     */
    private function json(array $texts): string
    {
        return json_encode((object) array_filter($texts, fn ($text) => $text !== ''), JSON_UNESCAPED_UNICODE);
    }
};
