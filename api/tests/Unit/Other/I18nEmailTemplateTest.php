<?php

/**
 * @file I18nEmailTemplateTest.php
 * @path api/tests/Unit/Other/I18nEmailTemplateTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the shared confirmation e-mail template logic (I18nEmailTemplate):
 *   the texts missing per language, the Czech completion of a stored template, and the three
 *   migrations of 2026-11 that fill the empty Czech texts of the inquiry, portal order and
 *   e-shop order e-mails (Czech = the default language).
 * @dependencies
 * - Tests\TestCase (test schema); WebSiteSetting, ProjectPortalSetting, ShopSiteSetting and their
 *   template classes.
 */

namespace Tests\Unit\Other;

use App\Apps\ProjectPortal\Models\ProjectPortalSetting;
use App\Apps\ProjectPortal\Support\SalesOrderEmailTemplate;
use App\Apps\Shop\Models\ShopSiteSetting;
use App\Apps\Shop\Support\ShopOrderEmailTemplate;
use App\Apps\Web\Models\WebSiteSetting;
use App\Apps\Web\Support\RawRequestEmailTemplate;
use Tests\TestCase;

/**
 * @description App\Support\Mail\I18nEmailTemplate and the Czech completion migrations.
 */
class I18nEmailTemplateTest extends TestCase
{
    /**
     * @description Missing texts: an empty / blank / non-string text counts as missing, flat texts
     *   and labels alike; per language only the languages with something missing (Czech always
     *   checked); no settings row = everything missing.
     * @input Template: cz all but outro (intro blank) and label_ico a number; en only subject.
     * @output missingDefaults [intro, outro, label_ico]; by language cz the same, en all but
     *   subject, de (not stored) every key; null settings: cz every key.
     */
    public function test_missing_texts(): void
    {
        $labels = array_diff_key(SalesOrderEmailTemplate::DEFAULTS, array_flip(SalesOrderEmailTemplate::FLAT));
        $settings = (object) [
            'sales_order_email_subject_i18n' => ['cz' => 'Předmět', 'en' => 'Subject'],
            'sales_order_email_title_i18n'   => ['cz' => 'Nadpis'],
            'sales_order_email_intro_i18n'   => ['cz' => '   '],
            'sales_order_email_outro_i18n'   => null,
            'sales_order_email_labels_i18n'  => ['cz' => ['label_ico' => 123] + $labels],
        ];
        $all = array_keys(SalesOrderEmailTemplate::DEFAULTS);

        $this->assertSame(['intro', 'outro', 'label_ico'], SalesOrderEmailTemplate::missingDefaults($settings));
        $this->assertSame([
            'cz' => ['intro', 'outro', 'label_ico'],
            'en' => array_values(array_diff($all, ['subject'])),
            'de' => $all,
        ], SalesOrderEmailTemplate::missingByLanguage($settings, ['EN', 'de', 'cz']));
        $this->assertSame(['cz' => $all], SalesOrderEmailTemplate::missingByLanguage(null, []));
    }

    /**
     * @description completeDefaults fills only the empty Czech texts with the built-in Czech ones;
     *   filled texts and other languages stay; a complete template is left untouched.
     * @input Template: cz subject 'Můj předmět', labels cz {greeting 'Ahoj'} + en {greeting 'Hi'}.
     * @output true; cz subject kept, title = DEFAULTS; labels cz greeting kept, the rest DEFAULTS;
     *   en kept; nothing missing; a second call false.
     */
    public function test_complete_defaults(): void
    {
        $settings = (object) [
            'raw_request_email_subject_i18n' => ['cz' => 'Můj předmět', 'en' => 'Mine'],
            'raw_request_email_labels_i18n'  => ['cz' => ['greeting' => 'Ahoj'], 'en' => ['greeting' => 'Hi']],
        ];

        $this->assertTrue(RawRequestEmailTemplate::completeDefaults($settings));
        $this->assertSame(['cz' => 'Můj předmět', 'en' => 'Mine'], $settings->raw_request_email_subject_i18n);
        $this->assertSame(['cz' => RawRequestEmailTemplate::DEFAULTS['title']], $settings->raw_request_email_title_i18n);
        $this->assertSame('Ahoj', $settings->raw_request_email_labels_i18n['cz']['greeting']);
        $this->assertSame(RawRequestEmailTemplate::DEFAULTS['label_date'], $settings->raw_request_email_labels_i18n['cz']['label_date']);
        $this->assertSame(['greeting' => 'Hi'], $settings->raw_request_email_labels_i18n['en']);
        $this->assertSame([], RawRequestEmailTemplate::missingDefaults($settings));
        $this->assertFalse(RawRequestEmailTemplate::completeDefaults($settings));
    }

    /**
     * @description The migrations of 2026-11 complete the Czech texts of the stored templates of
     *   the web, the project portal and the e-shop (other texts and languages stay); without a
     *   settings row they create none.
     * @input Rows with partial Czech texts + an English text; up() of each migration; then the
     *   rows deleted and up() again.
     * @output Nothing missing in Czech, the edited Czech / English texts kept; no row created.
     */
    public function test_migrations_complete_the_czech_texts(): void
    {
        $migrations = [
            'Apps/Web/Database/Migrations/2026_11_29_000000_web_inquiry_email_czech_complete.php',
            'Apps/ProjectPortal/Database/Migrations/2026_11_29_000000_project_portal_order_email_czech_complete.php',
            'Apps/Shop/Database/Migrations/2026_11_29_000000_shop_order_email_czech_complete.php',
        ];
        WebSiteSetting::create(['is_web_active' => true, 'raw_request_email_subject_i18n' => ['cz' => 'Díky', 'en' => 'Thanks']]);
        ProjectPortalSetting::create(['sales_order_email_labels_i18n' => ['cz' => ['label_ico' => 'IČ'], 'en' => ['label_ico' => 'ID']]]);
        ShopSiteSetting::create(['is_shop_active' => true, 'order_email_labels_i18n' => ['cz' => []]]);

        foreach ($migrations as $path) {
            (require app_path($path))->up();
        }

        $web = WebSiteSetting::sole();
        $this->assertSame([], RawRequestEmailTemplate::missingDefaults($web));
        $this->assertSame(['cz' => 'Díky', 'en' => 'Thanks'], $web->raw_request_email_subject_i18n);
        $portal = ProjectPortalSetting::sole();
        $this->assertSame([], SalesOrderEmailTemplate::missingDefaults($portal));
        $this->assertSame(['IČ', ['label_ico' => 'ID']], [$portal->sales_order_email_labels_i18n['cz']['label_ico'], $portal->sales_order_email_labels_i18n['en']]);
        $this->assertSame([], ShopOrderEmailTemplate::missingDefaults(ShopSiteSetting::sole()));

        WebSiteSetting::query()->delete();
        ProjectPortalSetting::query()->delete();
        ShopSiteSetting::query()->delete();
        foreach ($migrations as $path) {
            (require app_path($path))->up();
        }
        $this->assertSame([0, 0, 0], [WebSiteSetting::count(), ProjectPortalSetting::count(), ShopSiteSetting::count()]);
    }
}
