<?php
/**
 * @file 2026_11_11_000000_create_web_faq_and_jobs.php
 * @path api/app/Apps/Web/Database/Migrations/2026_11_11_000000_create_web_faq_and_jobs.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description FAQ and open positions (Careers) of the public website move from the translation
 *   files (storage/app/public/translations/web/{lang}.json) to the database, so the admin manages
 *   them as content (web/edit-website, tabs FAQ and Jobs), every text per language:
 *   - web_faq_categories, web_faq_items - categories (tabs) and their questions with answers;
 *   - web_jobs, web_job_sections - positions (preview of the list, type, location) and the blocks
 *     of their detail (optional heading + text).
 *   The content of the translation files of every language is moved over (keys `faq.categories`,
 *   `faq.items`, `jobs.job_N_*`, `jobs.{slug}`, `jobs.item_meta_*`) and removed from the files;
 *   the HTML of the job detail becomes blocks (a `<strong>` at the start of a paragraph = the
 *   heading, `<br>` = a line break, other tags dropped). Czech without that content (a new
 *   installation, a repository copy of cz.json) gets the former Czech texts.
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
    /** @description Content of the translation files before this change (Czech), used without any. */
    private const DEFAULTS = [
        'cz' => [
            'faq' => [
                'categories' => [
                    'obecne' => 'Obecné',
                    'vyvoj' => 'Vývoj',
                    'ceny' => 'Ceny',
                    'spoluprace' => 'Spolupráce',
                    'podpora' => 'Podpora',
                ],
                'items' => [
                    'obecne' => [
                        [
                            'question' => 'Čím se vaše společnost zabývá?',
                            'answer' => 'Jsme softwarová společnost specializující se na vývoj webových, desktopových, mobilních aplikací a AI řešení.',
                        ],
                        [
                            'question' => 'Jak dlouho jste na trhu?',
                            'answer' => 'Na trhu působíme 4 roky.',
                        ],
                        [
                            'question' => 'V jakých jazycích komunikujete?',
                            'answer' => 'Primárně komunikujeme v češtině a angličtině.',
                        ],
                        [
                            'question' => 'Pracujete i s menšími projekty?',
                            'answer' => 'Ano, rádi se ujmeme jak malých, tak rozsáhlých projektů.',
                        ],
                        [
                            'question' => 'Nabízíte bezplatnou konzultaci?',
                            'answer' => 'Ano, první konzultaci poskytujeme bezplatně.',
                        ],
                    ],
                    'vyvoj' => [
                        [
                            'question' => 'Jaké technologie používáte pro webový vývoj?',
                            'answer' => 'Pro frontend pracujeme primárně s Angular a TypeScriptem, pro backend s C#, PHP nebo Node.js.',
                        ],
                        [
                            'question' => 'Vyvíjíte i mobilní aplikace?',
                            'answer' => 'Ano, vyvíjíme nativní i cross-platform mobilní aplikace.',
                        ],
                        [
                            'question' => 'Jak probíhá vývoj desktopových aplikací?',
                            'answer' => 'Desktopové aplikace vyvíjíme převážně v C# (WPF, WinForms, MAUI), C++ nebo Pythonu.',
                        ],
                        [
                            'question' => 'Nabízíte integraci AI do existujících systémů?',
                            'answer' => 'Ano, implementujeme AI řešení jak do nových, tak stávajících systémů.',
                        ],
                        [
                            'question' => 'Jak zajišťujete kvalitu kódu?',
                            'answer' => 'Dodržujeme standardy čistého kódu, code review a automatizované testy.',
                        ],
                        [
                            'question' => 'Jak dlouho trvá vývoj typického projektu?',
                            'answer' => 'Délka závisí na rozsahu, obvykle 2-6 týdnů pro jednodušší projekty.',
                        ],
                    ],
                    'ceny' => [
                        [
                            'question' => 'Jak jsou stanovovány ceny vašich služeb?',
                            'answer' => 'Ceny stanovujeme individuálně podle rozsahu a složitosti.',
                        ],
                        [
                            'question' => 'Jaké jsou přibližné ceny webových projektů?',
                            'answer' => 'Ceny se pohybují od nižších tisíc až po desítky tisíc korun.',
                        ],
                        [
                            'question' => 'Nabízíte fixní nebo hodinové sazby?',
                            'answer' => 'Nabízíme oba modely podle typu spolupráce.',
                        ],
                        [
                            'question' => 'Existují skryté poplatky?',
                            'answer' => 'Ne, veškeré náklady transparentně uvádíme v nabídce.',
                        ],
                        [
                            'question' => 'Jaké jsou platební podmínky?',
                            'answer' => 'Fakturujeme zálohu při zahájení a zbytek po dokončení projektu.',
                        ],
                    ],
                    'spoluprace' => [
                        [
                            'question' => 'Jak probíhá zahájení spolupráce?',
                            'answer' => 'Začínáme úvodní konzultací, analýzou a podpisem smlouvy.',
                        ],
                        [
                            'question' => 'Jak komunikujete v průběhu projektu?',
                            'answer' => 'Přes e-mail, videohovory nebo jakákoliv služba, která vám vyhovuje.',
                        ],
                        [
                            'question' => 'Mohu sledovat průběh vývoje?',
                            'answer' => 'Ano, máte přístup ke sdílenému projektovému prostoru.',
                        ],
                        [
                            'question' => 'Pracujete agilně?',
                            'answer' => 'Ano, pracujeme agilní metodikou rozdělenou do sprintů.',
                        ],
                        [
                            'question' => 'Podepíšete NDA?',
                            'answer' => 'Samozřejmě, dohodu o mlčenlivosti podepisujeme před zahájením.',
                        ],
                    ],
                    'podpora' => [
                        [
                            'question' => 'Nabízíte podporu po dokončení projektu?',
                            'answer' => 'Ano, od záruční doby až po dlouhodobé servisní smlouvy.',
                        ],
                        [
                            'question' => 'Jak rychle reagujete na nahlášené problémy?',
                            'answer' => 'Kritické problémy do 24h, standardní do 48h.',
                        ],
                        [
                            'question' => 'Zajišťujete aktualizace a údržbu?',
                            'answer' => 'Ano, v rámci servisních balíčků.',
                        ],
                        [
                            'question' => 'Co se stane, pokud chci projekt rozšířit?',
                            'answer' => 'Provedeme analýzu a připravíme nabídku na rozšíření.',
                        ],
                        [
                            'question' => 'Poskytujete školení?',
                            'answer' => 'Ano, ke každému projektu zajistíme dokumentaci a školení.',
                        ],
                        [
                            'question' => 'Jak nahlásím chybu?',
                            'answer' => 'E-mailem, přes helpdesk nebo telefonicky.',
                        ],
                    ],
                ],
            ],
            'jobs' => [
                'item_meta_type' => 'Plný úvazek',
                'item_meta_location' => 'Praha / Remote',
                'job_1_id' => 'ui-designer',
                'job_1_title' => 'UI/UX Designer',
                'job_1_short_desc' => 'Tvorba UI designu z domova s prostorem pro kreativitu. Hledáme spolehlivé parťáky se znalostí webové filozofie.',
                'job_2_id' => 'sales-rep',
                'job_2_title' => 'Obchodní zástupce',
                'job_2_short_desc' => 'Sjednávání nabídek s vysokou mírou samostatnosti. Ideální pro komunikativní lidi se znalostí sociálních sítí.',
                'ui-designer' => [
                    'title' => 'UI/UX Designer',
                    'content' => 'Aktuálně otevíráme prostor pro kreativního grafika se zaměřením na UI, který má vášeň pro čistou estetiku a moderní vizuální styl. Tato role je ideální pro studenty (VŠ i SŠ technického směru), kteří hledají maximální flexibilitu a chtějí realizovat své grafické nápady plně v režimu home-office.<br><br><strong>Klíčové odpovědnosti:</strong><br>• Kompletní vizuální návrh uživatelských rozhraní v nástrojích jako Figma, Adobe XD nebo Photoshop.<br>• Převádění projektové dokumentace a skic do čistých, moderních a přehledných grafických výstupů.<br>• Práce s barvami, typografií a kompozicí tak, aby byl web nejen krásný, ale i funkční.<br>• Příprava grafických podkladů pro následný vývoj.<br><br><strong>Co od vás vyžadujeme:</strong><br>• Věk 18+ a studium nebo absolvování technické SŠ/VŠ (se zájmem o IT a design).<br>• Pokročilou znalost práce ve Figmě nebo Photoshopu a cit pro detail.<br>• Základní povědomí o webové filozofii (jak se prvky na webu chovají).<br>• Spolehlivost a schopnost samostatně tvořit v domluvených termínech.<br><br><strong>Na co se můžete těšit:</strong><br>• Flexibilní spolupráce na DPP s možností plné práce z domova (home-office).<br>• Volný pracovní rozvrh, který si plně přizpůsobíte svým časovým možnostem.',
                ],
                'sales-rep' => [
                    'title' => 'Obchodní zástupce',
                    'content' => 'Hledáme energického a samostatného kolegu pro Business Development, který nám pomůže identifikovat nové obchodní příležitosti a rozšiřovat naše klientské portfolio. Pokud máte vynikající komunikační dovednosti a baví vás propojovat technická řešení s potřebami klientů, hledáme právě vás.<br><br><strong>Vaše hlavní úkoly:</strong><br>• Aktivní vyhledávání nových klientských segmentů a navazování prvotních obchodních kontaktů.<br>• Profesionální sjednávání nabídek a prezentace našich služeb jako moderního technologického partnera.<br>• Budování vztahů s klíčovými klienty a partnery.<br><br><strong>Očekávaný profil kandidáta:</strong><br>• Věk 18+ a reprezentativní vystupování v online i osobní komunikaci.<br>• Vysoká míra vnitřní disciplíny, samostatnosti a schopnost efektivního self-managementu.<br>• Znalost prostředí sociálních sítí jako nástroje pro moderní obchod je velkou výhodou.<br>• Schopnost jasně a srozumitelně interpretovat i složitější technická řešení.<br><br><strong>Na co se můžete těšit:</strong><br>• Flexibilní spolupráce na DPP s možností plné práce z domova (home-office).<br>• Volný pracovní rozvrh, který si plně přizpůsobíte svým časovým možnostem.',
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
        Schema::create('web_faq_categories', function (Blueprint $table) {
            $table->id();
            $table->json('name_i18n')->nullable()->comment('Name per language code');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('web_faq_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('web_faq_categories')->cascadeOnDelete();
            $table->json('question_i18n')->nullable()->comment('Question per language code');
            $table->json('answer_i18n')->nullable()->comment('Answer per language code (plain text)');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('web_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 80)->unique()->comment('URL of the detail: /jobs/{slug}');
            $table->json('title_i18n')->nullable();
            $table->json('summary_i18n')->nullable()->comment('Short description of the list');
            $table->json('type_i18n')->nullable()->comment('e.g. Full-time');
            $table->json('location_i18n')->nullable();
            $table->boolean('is_active')->default(true)->comment('Shown on the public website');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('web_job_sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_id')->constrained('web_jobs')->cascadeOnDelete();
            $table->json('heading_i18n')->nullable()->comment('Optional heading per language code');
            $table->json('body_i18n')->nullable()->comment('Text per language code (plain text)');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        $files = app()->runningUnitTests() ? [] : $this->translationFiles();
        $legacy = [];
        foreach ($files as $lang => $data) {
            $content = $this->legacyContent($data);
            if ($content !== null) {
                $legacy[$lang] = $content;
            }
        }

        // The built-in Czech always exists: its former texts when its file has none any more (a
        // repository copy of cz.json without them), merged with the other languages by position.
        $this->import(['cz' => $legacy['cz'] ?? self::DEFAULTS['cz']] + $legacy);

        foreach ($files as $lang => $data) {
            if (isset($legacy[$lang])) {
                $this->writeWithoutLegacy($lang, $data);
            }
        }
    }

    /**
     * @description Drops the tables (the content is not written back to the translation files).
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('web_job_sections');
        Schema::dropIfExists('web_jobs');
        Schema::dropIfExists('web_faq_items');
        Schema::dropIfExists('web_faq_categories');
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
        // The built-in language first - its order of categories / positions wins.
        uksort($files, fn ($a, $b) => ($b === 'cz') <=> ($a === 'cz') ?: strcmp($a, $b));

        return $files;
    }

    /**
     * @description FAQ / jobs content of one translation file.
     * @param array $data Decoded file.
     * @return array|null ['faq' => [categories, items], 'jobs' => [...]]; null = none.
     */
    private function legacyContent(array $data): ?array
    {
        $faq = array_intersect_key((array) ($data['faq'] ?? []), ['categories' => 1, 'items' => 1]);
        $jobs = array_filter((array) ($data['jobs'] ?? []), fn ($key) => in_array($key, $this->legacyJobKeys($data), true), ARRAY_FILTER_USE_KEY);

        return $faq || $jobs ? ['faq' => $faq, 'jobs' => $jobs] : null;
    }

    /**
     * @description Keys of the `jobs` section that are content of the positions.
     * @param array $data Decoded file.
     * @return string[]
     */
    private function legacyJobKeys(array $data): array
    {
        $jobs = (array) ($data['jobs'] ?? []);
        $keys = [];
        foreach ($jobs as $key => $value) {
            if (preg_match('/^job_\d+_(id|title|short_desc)$/', (string) $key) || in_array($key, ['item_meta_type', 'item_meta_location'], true)) {
                $keys[] = $key;
            }
            if (preg_match('/^job_\d+_id$/', (string) $key) && is_string($value) && is_array($jobs[$value] ?? null)) {
                $keys[] = $value;
            }
        }

        return $keys;
    }

    /**
     * @description Writes the translation file without the moved content (same format as the
     *   admin writes it, TranslationController).
     * @param string $lang Language code.
     * @param array $data Decoded file.
     * @return void
     */
    private function writeWithoutLegacy(string $lang, array $data): void
    {
        foreach ($this->legacyJobKeys($data) as $key) {
            unset($data['jobs'][$key]);
        }
        unset($data['faq']['categories'], $data['faq']['items']);

        file_put_contents($this->directory() . "/{$lang}.json", json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    /**
     * @description Stores the content of all languages: categories by their key, questions,
     *   positions and blocks by their position.
     * @param array<string, array> $legacy Language code => legacyContent().
     * @return void
     */
    private function import(array $legacy): void
    {
        $now = now();
        $categories = [];
        $jobs = [];

        foreach ($legacy as $lang => $content) {
            foreach ((array) ($content['faq']['categories'] ?? []) as $key => $name) {
                $categories[$key]['name'][$lang] = $this->text($name);
            }
            foreach ((array) ($content['faq']['items'] ?? []) as $key => $items) {
                foreach (array_values((array) $items) as $index => $item) {
                    $categories[$key]['items'][$index]['question'][$lang] = $this->text($item['question'] ?? '');
                    $categories[$key]['items'][$index]['answer'][$lang] = $this->text($item['answer'] ?? '', true);
                }
            }

            $source = (array) ($content['jobs'] ?? []);
            $numbers = [];
            foreach (array_keys($source) as $key) {
                if (preg_match('/^job_(\d+)_id$/', (string) $key, $m)) {
                    $numbers[] = (int) $m[1];
                }
            }
            sort($numbers);
            foreach ($numbers as $number) {
                $slug = is_string($source["job_{$number}_id"] ?? null) ? $source["job_{$number}_id"] : '';
                if (!preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) || strlen($slug) > 80) {
                    continue;
                }
                $detail = (array) ($source[$slug] ?? []);
                $jobs[$slug]['title'][$lang] = $this->text($source["job_{$number}_title"] ?? ($detail['title'] ?? ''));
                $jobs[$slug]['summary'][$lang] = $this->text($source["job_{$number}_short_desc"] ?? '');
                $jobs[$slug]['type'][$lang] = $this->text($source['item_meta_type'] ?? '');
                $jobs[$slug]['location'][$lang] = $this->text($source['item_meta_location'] ?? '');
                foreach ($this->sections((string) ($detail['content'] ?? '')) as $index => $section) {
                    $jobs[$slug]['sections'][$index]['heading'][$lang] = $section['heading'];
                    $jobs[$slug]['sections'][$index]['body'][$lang] = $section['body'];
                }
            }
        }

        $categoryOrder = 0;
        foreach ($categories as $category) {
            $categoryId = DB::table('web_faq_categories')->insertGetId([
                'name_i18n' => $this->json($category['name'] ?? []),
                'sort_order' => $categoryOrder++,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            foreach (array_values($category['items'] ?? []) as $index => $item) {
                DB::table('web_faq_items')->insert([
                    'category_id' => $categoryId,
                    'question_i18n' => $this->json($item['question'] ?? []),
                    'answer_i18n' => $this->json($item['answer'] ?? []),
                    'sort_order' => $index,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        $jobOrder = 0;
        foreach ($jobs as $slug => $job) {
            $jobId = DB::table('web_jobs')->insertGetId([
                'slug' => $slug,
                'title_i18n' => $this->json($job['title'] ?? []),
                'summary_i18n' => $this->json($job['summary'] ?? []),
                'type_i18n' => $this->json($job['type'] ?? []),
                'location_i18n' => $this->json($job['location'] ?? []),
                'is_active' => true,
                'sort_order' => $jobOrder++,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            foreach (array_values($job['sections'] ?? []) as $index => $section) {
                DB::table('web_job_sections')->insert([
                    'job_id' => $jobId,
                    'heading_i18n' => $this->json($section['heading'] ?? []),
                    'body_i18n' => $this->json($section['body'] ?? []),
                    'sort_order' => $index,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    /**
     * @description Blocks of the HTML of a job detail: paragraphs split by an empty line, a
     *   `<strong>` at the start = the heading.
     * @param string $html Former content.
     * @return array<int, array{heading: string, body: string}>
     */
    private function sections(string $html): array
    {
        $text = preg_replace('/<br\s*\/?>/i', "\n", $html);
        $sections = [];
        foreach (preg_split('/\n\s*\n/', (string) $text) ?: [] as $block) {
            $heading = '';
            if (preg_match('/^\s*<strong>(.*?)<\/strong>\s*/is', $block, $m)) {
                $heading = $this->text($m[1]);
                $block = substr($block, strlen($m[0]));
            }
            $body = $this->text($block, true);
            if ($heading !== '' || $body !== '') {
                $sections[] = ['heading' => $heading, 'body' => $body];
            }
        }

        return $sections;
    }

    /**
     * @description Plain text of a former value (tags dropped, entities decoded).
     * @param mixed $value Former value.
     * @param bool $multiline Keep line breaks (`<br>` = a line break).
     * @return string
     */
    private function text(mixed $value, bool $multiline = false): string
    {
        $text = is_string($value) ? $value : '';
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
