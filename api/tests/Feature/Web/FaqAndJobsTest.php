<?php

/**
 * @file FaqAndJobsTest.php
 * @path api/tests/Feature/Web/FaqAndJobsTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the FAQ and the open positions of the public website: the former
 *   Czech content filled in by the migration, the admin API (web/faq, web/jobs - permissions
 *   web-edit-website-view / -update, the whole content saved at once: create / update / delete /
 *   reorder, clean-up of the texts per language, stale ids refused) and the public API
 *   (public/web/faq, public/web/jobs - active positions only, empty languages left out).
 * @dependencies
 * - Tests\TestCase (RefreshDatabase + InteractsWithAccounts).
 */

namespace Tests\Feature\Web;

use App\Models\Web\WebFaqCategory;
use App\Models\Web\WebFaqItem;
use App\Models\Web\WebJob;
use App\Models\Web\WebJobSection;
use Tests\TestCase;

/**
 * @description GET / PUT /api/web/faq, /api/web/jobs; GET /api/public/web/faq, /api/public/web/jobs.
 */
class FaqAndJobsTest extends TestCase
{
    /**
     * @description Fills in the content the migration creates on a new installation: the test
     *   schema has the tables already, so they are dropped and the migration runs again (during
     *   the tests it never reads or changes the translation files).
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        $migration = require database_path('migrations/2026_11_11_000000_create_web_faq_and_jobs.php');
        $migration->down();
        $migration->up();
    }

    /**
     * @description A position as the admin sends it.
     * @param string $slug URL of the position.
     * @param array<string, mixed> $overrides Other fields.
     * @return array<string, mixed>
     */
    private function job(string $slug, array $overrides = []): array
    {
        return array_merge([
            'slug' => $slug, 'is_active' => true,
            'title_i18n' => ['cz' => "Pozice {$slug}"], 'summary_i18n' => ['cz' => 'Krátce'],
            'type_i18n' => [], 'location_i18n' => [], 'sections' => [],
        ], $overrides);
    }

    /**
     * @description The migration filled in the former Czech FAQ (5 categories, 27 questions) and
     *   both positions with the blocks of their detail; the public API returns them.
     * @input Fresh database; GET public/web/faq, public/web/jobs.
     * @output Categories Obecné … Podpora; first answer text; jobs ui-designer, sales-rep with
     *   4 blocks each, the second one headed 'Klíčové odpovědnosti:' with bullet lines.
     */
    public function test_former_content_is_filled_in(): void
    {
        $this->assertSame(27, WebFaqItem::count());

        $faq = $this->getJson('/api/public/web/faq')->assertOk()->json('data');
        $this->assertSame(['Obecné', 'Vývoj', 'Ceny', 'Spolupráce', 'Podpora'], array_column(array_column($faq, 'name'), 'cz'));
        $this->assertSame('Čím se vaše společnost zabývá?', $faq[0]['items'][0]['question']['cz']);

        $jobs = $this->getJson('/api/public/web/jobs')->assertOk()->json('data');
        $this->assertSame(['ui-designer', 'sales-rep'], array_column($jobs, 'slug'));
        $this->assertCount(4, $jobs[0]['sections']);
        $this->assertSame([], $jobs[0]['sections'][0]['heading']);
        $this->assertSame('Klíčové odpovědnosti:', $jobs[0]['sections'][1]['heading']['cz']);
        $this->assertStringStartsWith("• Kompletní vizuální návrh", $jobs[0]['sections'][1]['body']['cz']);
        $this->assertStringContainsString("\n• ", $jobs[0]['sections'][1]['body']['cz']);
        $this->assertSame('Plný úvazek', $jobs[0]['type']['cz']);
    }

    /**
     * @description The admin API needs web-edit-website-view to read and -update to save.
     * @input Account without permissions; account with view only.
     * @output 403 / 403; view: GET 200, PUT 403.
     */
    public function test_admin_api_needs_the_edit_website_permissions(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/web/faq')->assertForbidden();
        $this->getJson('/api/web/jobs')->assertForbidden();

        $this->signIn($this->userWith(['web-edit-website-view']));
        $this->getJson('/api/web/faq')->assertOk();
        $this->getJson('/api/web/jobs')->assertOk();
        $this->putJson('/api/web/faq', ['categories' => []])->assertForbidden();
        $this->putJson('/api/web/jobs', ['jobs' => []])->assertForbidden();
    }

    /**
     * @description Saving the FAQ: the sent order wins, existing rows are updated, new ones
     *   created, missing ones deleted; a question may move to another category; texts are cleaned
     *   (tags removed, invalid language codes and empty texts dropped, line breaks of the answer
     *   kept, single-line texts collapsed).
     * @input Keep category 2 (renamed) with the first question of category 1 moved into it and a
     *   new one; a new category first; everything else left out.
     * @output Order [new, kept]; kept id unchanged; moved question in the kept category; 2
     *   categories / 3 questions left; cleaned texts; log entry.
     */
    public function test_saves_the_whole_faq(): void
    {
        $this->signIn($this->userWith(['web-edit-website-view', 'web-edit-website-update']));
        [$first, $second] = WebFaqCategory::orderBy('sort_order')->take(2)->get()->all();
        $moved = $first->items()->first();

        $data = $this->putJson('/api/web/faq', ['categories' => [
            ['name_i18n' => ['cz' => '  Nová   <b>kategorie</b> ', 'en' => '', 'BAD CODE' => 'x'], 'items' => [
                ['question_i18n' => ['cz' => 'Otázka?'], 'answer_i18n' => ['cz' => "Řádek 1\r\n• bod\n\n\n\nkonec", 'en' => 'Line']],
            ]],
            ['id' => $second->id, 'name_i18n' => ['cz' => 'Vývoj 2'], 'items' => [
                ['id' => $moved->id, 'question_i18n' => ['cz' => 'Přesunutá'], 'answer_i18n' => ['cz' => 'A']],
                ['question_i18n' => [], 'answer_i18n' => []],
            ]],
        ]])->assertOk()->json('data');

        $this->assertSame(['Nová kategorie', 'Vývoj 2'], array_column(array_column($data, 'name_i18n'), 'cz'));
        $this->assertSame(['cz' => 'Nová kategorie'], $data[0]['name_i18n']);
        $this->assertSame(['cz' => "Řádek 1\n• bod\n\nkonec", 'en' => 'Line'], $data[0]['items'][0]['answer_i18n']);
        $this->assertSame($second->id, $data[1]['id']);
        $this->assertSame([$moved->id], [$data[1]['items'][0]['id']]);
        $this->assertSame([], $data[1]['items'][1]['question_i18n']);
        $this->assertSame([2, 3], [WebFaqCategory::count(), WebFaqItem::count()]);
        $this->assertCoreLogLike('Updated the FAQ: 2 categories, 3 questions');
    }

    /**
     * @description Stale data is refused: an id that does not exist, or one question sent twice.
     * @input Unknown category id; the same question id in two categories.
     * @output 422 both; nothing changed.
     */
    public function test_faq_refuses_stale_ids(): void
    {
        $this->signIn($this->userWith(['web-edit-website-update']));
        $item = WebFaqItem::first();

        $this->putJson('/api/web/faq', ['categories' => [['id' => 99999, 'name_i18n' => [], 'items' => []]]])->assertStatus(422);
        $this->putJson('/api/web/faq', ['categories' => [
            ['name_i18n' => [], 'items' => [['id' => $item->id, 'question_i18n' => [], 'answer_i18n' => []]]],
            ['name_i18n' => [], 'items' => [['id' => $item->id, 'question_i18n' => [], 'answer_i18n' => []]]],
        ]])->assertStatus(422);
        $this->assertSame(27, WebFaqItem::count());
    }

    /**
     * @description Saving the positions: create / update / delete positions and blocks, two
     *   positions may swap their URLs, an inactive position is not public; the URL must be valid
     *   and unique; a block of another position is refused.
     * @input Swap the URLs of both positions, drop the blocks of the first but one, deactivate the
     *   second, add a third; then an invalid URL, a duplicate URL, a block id of the other position.
     * @output Slugs swapped (same ids); 1 block left on the first + 1 new; public list without the
     *   inactive one; 422 for the invalid / duplicate URL and the foreign block.
     */
    public function test_saves_the_positions(): void
    {
        $this->signIn($this->userWith(['web-edit-website-update']));
        [$a, $b] = WebJob::orderBy('sort_order')->get()->all();
        $keptSection = $a->sections()->first();

        $data = $this->putJson('/api/web/jobs', ['jobs' => [
            $this->job('sales-rep', ['id' => $a->id, 'sections' => [
                ['id' => $keptSection->id, 'heading_i18n' => ['cz' => 'Úvod'], 'body_i18n' => ['cz' => "a\nb"]],
                ['heading_i18n' => [], 'body_i18n' => ['cz' => 'Nový blok', 'en' => 'New block']],
            ]]),
            $this->job('ui-designer', ['id' => $b->id, 'is_active' => false]),
            $this->job('junior-developer', ['type_i18n' => ['cz' => 'Brigáda'], 'location_i18n' => ['en' => 'Remote']]),
        ]])->assertOk()->json('data');

        $this->assertSame([[$a->id, 'sales-rep'], [$b->id, 'ui-designer']], [[$data[0]['id'], $data[0]['slug']], [$data[1]['id'], $data[1]['slug']]]);
        $this->assertSame([$keptSection->id], [$data[0]['sections'][0]['id']]);
        $this->assertSame(['cz' => "a\nb"], $data[0]['sections'][0]['body_i18n']);
        $this->assertSame(2, WebJobSection::count());
        $this->assertSame(['sales-rep', 'junior-developer'], array_column($this->getJson('/api/public/web/jobs')->json('data'), 'slug'));

        $current = array_map(fn ($job) => array_intersect_key($job, array_flip(['id', 'slug', 'is_active', 'title_i18n', 'summary_i18n', 'type_i18n', 'location_i18n', 'sections'])), $data);
        $this->putJson('/api/web/jobs', ['jobs' => [array_merge($current[0], ['slug' => 'Bad URL'])]])->assertStatus(422)->assertJsonValidationErrors('jobs.0.slug');
        $this->putJson('/api/web/jobs', ['jobs' => [$current[0], array_merge($current[1], ['slug' => 'sales-rep'])]])->assertStatus(422);
        $foreign = $current[1];
        $foreign['sections'] = [['id' => $keptSection->id, 'heading_i18n' => [], 'body_i18n' => []]];
        $this->putJson('/api/web/jobs', ['jobs' => [array_merge($current[0], ['sections' => []]), $foreign]])->assertStatus(422);
        $this->assertSame(3, WebJob::count());
    }

    /**
     * @description The public API leaves out empty languages and the admin ids of the positions.
     * @input Position with cz title only and an empty location.
     * @output title {cz}, location {} (JSON object), no `id` / `is_active`.
     */
    public function test_public_positions_have_no_admin_fields(): void
    {
        WebJob::query()->delete();
        WebJob::create(['slug' => 'tester', 'title_i18n' => ['cz' => 'Tester'], 'location_i18n' => [], 'is_active' => true]);

        $response = $this->getJson('/api/public/web/jobs')->assertOk();
        $this->assertSame([['slug' => 'tester', 'title' => ['cz' => 'Tester'], 'summary' => [], 'type' => [], 'location' => [], 'sections' => []]], $response->json('data'));
        $this->assertStringContainsString('"location":{}', $response->getContent());
    }

    /**
     * @description Whether a web log entry with the description exists.
     * @param string $description Expected description.
     * @return void
     */
    private function assertCoreLogLike(string $description): void
    {
        $this->assertTrue(\App\Models\Web\WebLog::where('description', $description)->exists(), "Web log '{$description}' not found.");
    }
}
