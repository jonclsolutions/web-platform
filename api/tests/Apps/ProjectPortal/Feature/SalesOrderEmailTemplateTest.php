<?php

/**
 * @file SalesOrderEmailTemplateTest.php
 * @path api/tests/Apps/ProjectPortal/Feature/SalesOrderEmailTemplateTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the order confirmation e-mail in the language of the page
 *   (VT-15): the public order stores its language, the e-mail uses the texts of that language
 *   (fallback 'cz', then the built-in English defaults), and the admin edits the template through
 *   project-portal/sales_orders/email-template (permission project-portal-sales-orders-update).
 * @dependencies
 * - Tests\TestCase, Tests\Apps\ProjectPortal\Support\ProjectFixtures; Mail / Storage fakes.
 */

namespace Tests\Apps\ProjectPortal\Feature;

use App\Apps\ProjectPortal\Mail\SalesOrderReceivedMail;
use App\Apps\ProjectPortal\Models\SalesOrder;
use App\Apps\ProjectPortal\Models\ProjectPortalSetting;
use App\Apps\ProjectPortal\Support\SalesOrderEmailTemplate;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\ProjectPortal\Support\ProjectFixtures;
use Tests\TestCase;

/**
 * @description Language of the order confirmation and its template API.
 */
class SalesOrderEmailTemplateTest extends TestCase
{
    use ProjectFixtures;

    /**
     * @description Fake disk / mailer, accepted captcha.
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('private');
        Mail::fake();
        $this->fakeCaptcha();
    }

    /**
     * @description Stores Czech and English texts of the template.
     * @return void
     */
    private function template(): void
    {
        ProjectPortalSetting::create([
            'sales_order_email_subject_i18n' => ['cz' => 'Objednávka přijata', 'en' => 'Order received'],
            'sales_order_email_title_i18n'   => ['cz' => 'Děkujeme', 'en' => 'Thank you'],
            'sales_order_email_labels_i18n'  => ['cz' => ['greeting' => 'Dobrý den', 'label_ico' => 'IČO'], 'en' => ['greeting' => 'Hello there']],
        ]);
    }

    /**
     * @description The public order keeps the language of the page and its e-mail is written in
     *   it: subject, title, greeting and the html lang; a missing English label falls back to the
     *   Czech one; an order without a language is Czech.
     * @input Template cz + en; POST order lang 'en'; POST order without lang.
     * @output lang 'en' stored; mail subject 'Order received', body 'Thank you', 'Hello there, Acme',
     *   '<html lang="en">', label IČO (cz fallback); second order: 'Objednávka přijata', lang="cs".
     */
    public function test_confirmation_is_sent_in_the_language_of_the_page(): void
    {
        $this->template();
        $body = ['client_name' => 'Acme', 'client_email' => 'order@acme.cz', 'order_description' => 'Shop', 'ico' => '123',
            'dataProcessingAgreement' => '1', 'tosAgreement' => '1'] + $this->captcha();

        $this->postJson('/api/project-portal/public/sales-orders', ['lang' => 'en'] + $body)->assertCreated()->assertJsonPath('data.lang', 'en');
        Mail::assertQueued(SalesOrderReceivedMail::class, function (SalesOrderReceivedMail $mail) {
            $html = $mail->render();
            return $mail->envelope()->subject === 'Order received'
                && str_contains($html, 'Thank you') && str_contains($html, 'Hello there, Acme')
                && str_contains($html, '<html lang="en">') && str_contains($html, 'IČO');
        });

        $czech = $this->postJson('/api/project-portal/public/sales-orders', ['client_email' => 'cz@acme.cz'] + $body)->assertCreated()->json('data.id');
        $mail = new SalesOrderReceivedMail(SalesOrder::find($czech));
        $this->assertSame('Objednávka přijata', $mail->envelope()->subject);
        $this->assertStringContainsString('<html lang="cs">', $mail->render());
    }

    /**
     * @description Without any text the built-in English defaults are used, empty texts count
     *   as missing; a language without texts takes the Czech ones.
     * @input No settings row; then cz subject '  ' and title 'Díky'; forLang('de').
     * @output Defaults; subject default + title 'Díky' + htmlLang 'de'.
     */
    public function test_template_fallbacks(): void
    {
        $texts = SalesOrderEmailTemplate::forLang(null);
        $this->assertSame(SalesOrderEmailTemplate::DEFAULTS['subject'], $texts['emailSubject']);
        $this->assertSame(SalesOrderEmailTemplate::DEFAULTS['label_address'], $texts['emailLabelAddress']);
        $this->assertSame('cs', $texts['emailHtmlLang']);

        ProjectPortalSetting::current()->update(['sales_order_email_subject_i18n' => ['cz' => '  '], 'sales_order_email_title_i18n' => ['cz' => 'Díky']]);
        $texts = SalesOrderEmailTemplate::forLang('de');
        $this->assertSame([SalesOrderEmailTemplate::DEFAULTS['subject'], 'Díky', 'de'], [$texts['emailSubject'], $texts['emailTitle'], $texts['emailHtmlLang']]);
    }

    /**
     * @description The admin reads and saves the template with project-portal-sales-orders-update; the save
     *   is logged and validated; without the permission both are refused.
     * @input GET / PUT as editor; PUT title 'x'; GET / PUT without the permission.
     * @output 200 null fields (row created); 200 with the saved arrays + portal log; 422; 403 ×2.
     */
    public function test_template_endpoints(): void
    {
        $this->signIn($this->userWith(['project-portal-sales-orders-update']));

        $this->getJson('/api/project-portal/sales_orders/email-template')->assertOk()
            ->assertExactJson(['data' => array_fill_keys(['sales_order_email_subject_i18n', 'sales_order_email_title_i18n',
                'sales_order_email_intro_i18n', 'sales_order_email_outro_i18n', 'sales_order_email_labels_i18n'], null)]);

        $this->putJson('/api/project-portal/sales_orders/email-template', [
            'sales_order_email_subject_i18n' => ['en' => 'Thanks'],
            'sales_order_email_labels_i18n'  => ['en' => ['label_ico' => 'Company ID']],
        ])->assertOk()->assertJsonPath('data.sales_order_email_subject_i18n.en', 'Thanks')->assertJsonMissingPath('data.id');
        $this->assertSame('Company ID', ProjectPortalSetting::current()->sales_order_email_labels_i18n['en']['label_ico']);
        $this->assertPortalLog('update', 'Updated confirmation email template (orders).');
        $this->putJson('/api/project-portal/sales_orders/email-template', ['sales_order_email_title_i18n' => 'x'])->assertStatus(422);

        $this->signIn($this->userWith(['project-portal-sales-orders-view']));
        $this->getJson('/api/project-portal/sales_orders/email-template')->assertForbidden();
        $this->putJson('/api/project-portal/sales_orders/email-template', [])->assertForbidden();
    }
}
