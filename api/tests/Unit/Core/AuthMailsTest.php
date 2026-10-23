<?php

/**
 * @file AuthMailsTest.php
 * @path api/tests/Unit/Core/AuthMailsTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the authentication e-mails: subject, rendered content (link,
 *   code, validity) and the company footer from the legal settings.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers); resources/views/emails/auth.
 */

namespace Tests\Unit\Core;

use App\Mail\Auth\AccountActivationMail;
use App\Mail\Auth\PasswordChangedNotification;
use App\Mail\Auth\PasswordResetRequested;
use App\Mail\Auth\TwoFactorCodeMail;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * @description App\Mail\Auth\*.
 */
class AuthMailsTest extends TestCase
{
    /**
     * @description Stores the company details used in the e-mail footer.
     * @return void
     */
    private function company(): void
    {
        // Plain insert: the production table has no created_at column (the row is seeded once
        // and only updated afterwards), so Eloquent create() cannot be used here.
        DB::table('legal_site_settings')->insert([
            'company_name' => 'Acme s.r.o.', 'ico' => '123', 'brand_tagline' => 't', 'copyright_text' => 'c',
            'contact_email' => 'info@acme.cz', 'contact_phone' => '+420 123', 'address' => 'Praha',
        ]);
    }

    /**
     * @description The activation e-mail links to the frontend activation page with the raw
     *   token and states the 48 h validity.
     * @input Frontend URL https://admin.example.com/, raw token 'raw-token'.
     * @output Subject 'Activating your account'; HTML contains the link and the full name.
     */
    public function test_activation_mail(): void
    {
        config(['app.frontend_url' => 'https://admin.example.com/']);
        $user = $this->user(['full_name' => 'Jana Nova']);

        $mail = new AccountActivationMail($user, 'raw-token');
        $html = $mail->render();

        $mail->assertHasSubject('Activating your account');
        $this->assertStringContainsString('https://admin.example.com/auth/activate-account/raw-token', $html);
        $this->assertStringContainsString('Jana Nova', $html);
        $this->assertStringContainsString('48', $html);
    }

    /**
     * @description The 2FA, reset and password-changed e-mails render their data and the
     *   company footer.
     * @input Company settings; 2FA code 654321 (10 min), reset URL (15 min), change time.
     * @output Subjects as defined; HTML contains the code / URL / time and the company name.
     */
    public function test_two_factor_reset_and_changed_mails(): void
    {
        $this->company();
        $user = $this->user();

        $twoFactor = new TwoFactorCodeMail($user, '654321', 10);
        $twoFactor->assertHasSubject('Login verification code');
        $this->assertStringContainsString('654321', $twoFactor->render());
        $this->assertStringContainsString('Acme s.r.o.', $twoFactor->render());

        $reset = new PasswordResetRequested($user, 'https://admin.example.com/auth/reset-password?token=abc', 15);
        $reset->assertHasSubject('Password reset request');
        $this->assertStringContainsString('token=abc', $reset->render());

        $changed = new PasswordChangedNotification($user, '22.10.2026 10:00');
        $changed->assertHasSubject('Your password has been changed');
        $this->assertStringContainsString('22.10.2026 10:00', $changed->render());
    }

    /**
     * @description Without legal settings the footer falls back to the application name.
     * @input No legal_site_settings row, app.name 'RPSW Test'.
     * @output The rendered e-mail contains 'RPSW Test'.
     */
    public function test_footer_fallback_without_company_settings(): void
    {
        config(['app.name' => 'RPSW Test']);

        $this->assertStringContainsString('RPSW Test', (new TwoFactorCodeMail($this->user(), '111111', 10))->render());
    }
}
