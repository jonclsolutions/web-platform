<?php
/**
 * @file 2026_11_12_000000_create_web_references.php
 * @path api/app/Apps/Web/Database/Migrations/2026_11_12_000000_create_web_references.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description References (delivered projects) of the public website move from the translation
 *   files (storage/app/public/translations/web/{lang}.json, keys `projects.project_N`) to the
 *   database, so the admin manages them as content (web/edit-website, tab References), every text
 *   per language:
 *   - web_references - the project: name, category, year, client, scope, role, description,
 *     result, an optional image, shown / hidden and the order;
 *   - web_reference_features - its key features;
 *   - web_reference_stack - its technology stack (label + value).
 *   The projects of every language are merged by their number N and removed from the files (the
 *   other texts of the page - headings, labels - stay there); a description written as HTML
 *   becomes plain text. Czech without that content (a new installation, a repository copy of
 *   cz.json) gets the former Czech projects.
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
    /** @description Categories of a project (labels: translations `projects.legend_{category}`). */
    private const CATEGORIES = ['web', 'desktop', 'mobile', 'ai'];

    /** @description Content of the translation files before this change (Czech), used without any. */
    private const DEFAULTS = [
        'cz' => [
            'project_1' => [
                'name' => 'E-shop se zdravými produkty',
                'duration' => '2025',
                'client' => 'First Prague Company, s. r. o.',
                'category' => 'web',
                'size' => 'E-shop na míru včetně administrace',
                'role' => 'Analýza, UX/UI design, vývoj, nasazení a podpora',
                'description' => 'Navrhli jsme a vyvinuli kompletní, moderní e-shop na míru, který se zaměřuje na zdravé produkty. Důraz jsme kladli na rychlé načítání, přehledný nákupní proces a jednoduchou správu pro majitele – bez omezení krabicových řešení.',
                'features' => [
                    'Katalog produktů s filtrováním a vyhledáváním',
                    'Košík a objednávkový proces optimalizovaný pro mobil',
                    'Napojení na platební bránu (platby kartou)',
                    'Sledování skladových zásob v reálném čase',
                    'Administrace objednávek, produktů a zákazníků',
                    'Uživatelské role a oprávnění v administraci',
                    'Transakční e-maily (potvrzení, změna stavu objednávky)',
                    'Souhlasy s cookies a zpracováním osobních údajů dle GDPR',
                ],
                'stack' => [
                    [
                        'label' => 'Frontend',
                        'value' => 'Angular, TypeScript',
                    ],
                    [
                        'label' => 'Backend',
                        'value' => 'Laravel (PHP), REST API',
                    ],
                    [
                        'label' => 'Databáze',
                        'value' => 'MariaDB',
                    ],
                    [
                        'label' => 'Zabezpečení',
                        'value' => 'HTTPS/TLS, tokenová autentizace, šifrovaná hesla',
                    ],
                    [
                        'label' => 'Provoz',
                        'value' => 'Linux server, pravidelné zálohy',
                    ],
                ],
                'result' => 'Zákazníci nakupují rychle a bez komplikací na jakémkoli zařízení a majitel spravuje celý obchod z jedné administrace bez nutnosti zásahu vývojáře.',
            ],
            'project_2' => [
                'name' => 'Školní webové stránky',
                'duration' => '2025',
                'client' => 'NAUCSETO, s. r. o.',
                'category' => 'web',
                'size' => 'Webový portál s redakčním systémem',
                'role' => 'Návrh struktury, design, vývoj, školení správců',
                'description' => 'Vytvořili jsme přehledné a moderní webové stránky pro vzdělávací instituci, které slouží jako hlavní komunikační portál pro studenty, rodiče a učitele. Všechny klíčové informace jsou na jednom místě a obsah spravuje škola sama.',
                'features' => [
                    'Interaktivní rozvrhy hodin',
                    'Kalendář školních akcí',
                    'Blog s novinkami a aktualitami',
                    'Zabezpečená sekce pro studijní materiály',
                    'Přihlášení s rolemi (správce, učitel, student)',
                    'Redakční systém pro správu obsahu bez technických znalostí',
                    'Responzivní zobrazení a přístupnost dle WCAG',
                ],
                'stack' => [
                    [
                        'label' => 'Frontend',
                        'value' => 'Angular, TypeScript',
                    ],
                    [
                        'label' => 'Backend',
                        'value' => 'Laravel (PHP), REST API',
                    ],
                    [
                        'label' => 'Databáze',
                        'value' => 'MariaDB',
                    ],
                    [
                        'label' => 'Zabezpečení',
                        'value' => 'HTTPS/TLS, řízení přístupu podle rolí',
                    ],
                    [
                        'label' => 'Provoz',
                        'value' => 'Linux server, pravidelné zálohy',
                    ],
                ],
                'result' => 'Komunikace školy s rodiči a studenty se zjednodušila – rozvrhy, akce i materiály jsou dostupné online na jednom místě.',
            ],
        ],
    ];

    /**
     * @description Creates the tables and moves the content over.
     * @return void
     */
    public function up(): void
    {
        Schema::create('web_references', function (Blueprint $table) {
            $table->id();
            $table->string('category', 20)->default('web')->comment('web | desktop | mobile | ai');
            $table->string('duration', 50)->nullable()->comment('Year / period of the project (same in every language)');
            $table->string('client', 150)->nullable()->comment('Client (same in every language)');
            $table->json('name_i18n')->nullable();
            $table->json('size_i18n')->nullable()->comment('Scope of the project');
            $table->json('role_i18n')->nullable()->comment('Our role');
            $table->json('description_i18n')->nullable()->comment('Plain text');
            $table->json('result_i18n')->nullable()->comment('Plain text');
            $table->string('image_path')->nullable()->comment('WebP on the public disk (references/...)');
            $table->boolean('is_active')->default(true)->comment('Shown on the public website');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('web_reference_features', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reference_id')->constrained('web_references')->cascadeOnDelete();
            $table->json('text_i18n')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('web_reference_stack', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reference_id')->constrained('web_references')->cascadeOnDelete();
            $table->json('label_i18n')->nullable()->comment('e.g. Frontend');
            $table->json('value_i18n')->nullable()->comment('e.g. Angular, TypeScript');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        $files = app()->runningUnitTests() ? [] : $this->translationFiles();
        $legacy = [];
        foreach ($files as $lang => $data) {
            $projects = $this->legacyProjects($data);
            if ($projects) {
                $legacy[$lang] = $projects;
            }
        }

        // The built-in Czech always exists: its former projects when its file has none any more.
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
        Schema::dropIfExists('web_reference_stack');
        Schema::dropIfExists('web_reference_features');
        Schema::dropIfExists('web_references');
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
        // The built-in language first - its neutral fields (year, client, category) win.
        uksort($files, fn ($a, $b) => ($b === 'cz') <=> ($a === 'cz') ?: strcmp($a, $b));

        return $files;
    }

    /**
     * @description Projects of one translation file by their number.
     * @param array $data Decoded file.
     * @return array<string, array> 'project_N' => project, ordered by N.
     */
    private function legacyProjects(array $data): array
    {
        $projects = array_filter(
            (array) ($data['projects'] ?? []),
            fn ($value, $key) => preg_match('/^project_\d+$/', (string) $key) && is_array($value),
            ARRAY_FILTER_USE_BOTH
        );
        uksort($projects, fn ($a, $b) => (int) substr($a, 8) <=> (int) substr($b, 8));

        return $projects;
    }

    /**
     * @description Writes the translation file without the moved projects (same format as the
     *   admin writes it, TranslationController).
     * @param string $lang Language code.
     * @param array $data Decoded file.
     * @return void
     */
    private function writeWithoutLegacy(string $lang, array $data): void
    {
        foreach (array_keys($this->legacyProjects($data)) as $key) {
            unset($data['projects'][$key]);
        }

        file_put_contents($this->directory() . "/{$lang}.json", json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    /**
     * @description Stores the projects of all languages, merged by their key (project_N);
     *   features and stack rows by their position.
     * @param array<string, array> $legacy Language code => legacyProjects().
     * @return void
     */
    private function import(array $legacy): void
    {
        $projects = [];
        foreach ($legacy as $lang => $items) {
            foreach ($items as $key => $item) {
                $project = &$projects[$key];
                foreach (['category', 'duration', 'client'] as $field) {
                    if (!isset($project[$field]) || $project[$field] === '') {
                        $project[$field] = $this->text($item[$field] ?? '');
                    }
                }
                $project['name'][$lang] = $this->text($item['name'] ?? '');
                $project['size'][$lang] = $this->text($item['size'] ?? '');
                $project['role'][$lang] = $this->text($item['role'] ?? '');
                $project['description'][$lang] = $this->text($item['description'] ?? '', true);
                $project['result'][$lang] = $this->text($item['result'] ?? '', true);
                foreach (array_values((array) ($item['features'] ?? [])) as $index => $feature) {
                    $project['features'][$index][$lang] = $this->text($feature);
                }
                foreach (array_values((array) ($item['stack'] ?? [])) as $index => $layer) {
                    $project['stack'][$index]['label'][$lang] = $this->text(is_array($layer) ? ($layer['label'] ?? '') : '');
                    $project['stack'][$index]['value'][$lang] = $this->text(is_array($layer) ? ($layer['value'] ?? '') : '');
                }
                unset($project);
            }
        }

        $now = now();
        $order = 0;
        foreach ($projects as $project) {
            $referenceId = DB::table('web_references')->insertGetId([
                'category' => in_array($project['category'], self::CATEGORIES, true) ? $project['category'] : 'web',
                'duration' => mb_substr($project['duration'], 0, 50) ?: null,
                'client' => mb_substr($project['client'], 0, 150) ?: null,
                'name_i18n' => $this->json($project['name'] ?? []),
                'size_i18n' => $this->json($project['size'] ?? []),
                'role_i18n' => $this->json($project['role'] ?? []),
                'description_i18n' => $this->json($project['description'] ?? []),
                'result_i18n' => $this->json($project['result'] ?? []),
                'is_active' => true,
                'sort_order' => $order++,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            foreach (array_values($project['features'] ?? []) as $index => $feature) {
                DB::table('web_reference_features')->insert([
                    'reference_id' => $referenceId,
                    'text_i18n' => $this->json($feature),
                    'sort_order' => $index,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
            foreach (array_values($project['stack'] ?? []) as $index => $layer) {
                DB::table('web_reference_stack')->insert([
                    'reference_id' => $referenceId,
                    'label_i18n' => $this->json($layer['label'] ?? []),
                    'value_i18n' => $this->json($layer['value'] ?? []),
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
