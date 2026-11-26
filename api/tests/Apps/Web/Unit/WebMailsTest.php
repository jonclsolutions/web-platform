<?php

/**
 * @file WebMailsTest.php
 * @path api/tests/Apps/Web/Unit/WebMailsTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the web e-mails: subject and rendered content of the raw
 *   request confirmation, the topic shown by its name (not the slug).
 * @dependencies
 * - Tests\TestCase, Tests\Apps\Web\Support\WebFixtures; views web::emails.*.
 */

namespace Tests\Apps\Web\Unit;

use App\Apps\Web\Mail\WebRawRequestCommissionReceived;
use Tests\Apps\Web\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description App\Apps\Web\Mail\*.
 */
class WebMailsTest extends TestCase
{
    use WebFixtures;

    /**
     * @description The raw request confirmation uses the template texts (the built-in Czech
     *   subject without settings - never English) plus the topic, and lists the request data and
     *   attachment names.
     * @input Raw request 'Website redesign' with attachment brief.pdf, no site settings.
     * @output Subject 'Vaše poptávka byla přijata – Website redesign'; HTML contains e-mail,
     *   description and brief.pdf; no attachments on the mail itself.
     */
    public function test_raw_request_confirmation(): void
    {
        $request = $this->rawRequest();
        $request->attachments()->create(['disk' => 'private', 'path' => 'web/x/brief.pdf', 'original_filename' => 'brief.pdf', 'mime_type' => 'application/pdf', 'size_bytes' => 1]);

        $mail = new WebRawRequestCommissionReceived($request->load('attachments'));
        $html = $mail->render();

        $mail->assertHasSubject('Vaše poptávka byla přijata – Website redesign');
        $this->assertStringContainsString('client@example.com', $html);
        $this->assertStringContainsString('We need a new website.', $html);
        $this->assertStringContainsString('brief.pdf', $html);
        $this->assertSame([], $mail->attachments());
    }

    /**
     * @description A topic chosen in the public form is stored as a slug - the e-mail shows its
     *   name from the web translations in the language of the request, else the Czech one; a slug
     *   without a text and a free-text topic stay as they are.
     * @input Translations cz (new_project, support) + en (new_project) in a temporary storage;
     *   requests new_project/en, support/en, careers/cz, 'Website redesign'.
     * @output subjects '… – New project / inquiry', '… – Podpora', '… – careers', '… – Website
     *   redesign' (the built-in Czech subject - no template stored); the HTML shows 'New project /
     *   inquiry' and not the slug.
     */
    public function test_raw_request_topic_is_translated(): void
    {
        $storage = sys_get_temp_dir() . '/kb-mail-' . uniqid();
        mkdir("{$storage}/app/public/translations/web", 0777, true);
        file_put_contents("{$storage}/app/public/translations/web/cz.json", json_encode(['contact' => ['options' => ['new_project' => 'Nový projekt / poptávka', 'support' => 'Podpora']]]));
        file_put_contents("{$storage}/app/public/translations/web/en.json", json_encode(['contact' => ['options' => ['new_project' => 'New project / inquiry']]]));
        $original = $this->app->storagePath();
        $this->app->useStoragePath($storage);

        try {
            $mail = new WebRawRequestCommissionReceived($this->rawRequest(['thema' => 'new_project', 'lang' => 'en']));
            $mail->assertHasSubject('Vaše poptávka byla přijata – New project / inquiry');
            $html = $mail->render();
            $this->assertStringContainsString('New project / inquiry', $html);
            $this->assertStringNotContainsString('new_project', $html);

            (new WebRawRequestCommissionReceived($this->rawRequest(['thema' => 'support', 'lang' => 'en'])))
                ->assertHasSubject('Vaše poptávka byla přijata – Podpora');
            (new WebRawRequestCommissionReceived($this->rawRequest(['thema' => 'careers'])))
                ->assertHasSubject('Vaše poptávka byla přijata – careers');
            (new WebRawRequestCommissionReceived($this->rawRequest()))
                ->assertHasSubject('Vaše poptávka byla přijata – Website redesign');
        } finally {
            $this->app->useStoragePath($original);
            array_map('unlink', glob("{$storage}/app/public/translations/web/*.json"));
        }
    }
}
