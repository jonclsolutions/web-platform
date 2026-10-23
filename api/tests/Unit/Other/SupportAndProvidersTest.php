<?php

/**
 * @file SupportAndProvidersTest.php
 * @path api/tests/Unit/Other/SupportAndProvidersTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the remaining shared code: company details of the e-mail footer
 *   (CompanyContactInfo), legal model relations and the rate limiters defined by the service
 *   providers (login, 2FA resend, api).
 * @dependencies
 * - Tests\TestCase.
 */

namespace Tests\Unit\Other;

use App\Models\Legal\DocumentSection;
use App\Models\Legal\DocumentType;
use App\Models\Legal\SiteSetting;
use App\Support\Mail\CompanyContactInfo;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * @description App\Support\Mail\CompanyContactInfo, App\Models\Legal\*, App\Providers\*.
 */
class SupportAndProvidersTest extends TestCase
{
    /**
     * @description Without settings the footer uses the app name; with settings the company
     *   name, e-mail and phone.
     * @input No legal_site_settings row (APP_NAME 'RPSW'); then a row of Acme.
     * @output {RPSW, null, null}; {Acme s.r.o., info@acme.cz, +420 123}.
     */
    public function test_company_contact_info(): void
    {
        config(['app.name' => 'RPSW']);
        $this->assertSame(['companyName' => 'RPSW', 'contactEmail' => null, 'contactPhone' => null], CompanyContactInfo::get());

        SiteSetting::create(['company_name' => 'Acme s.r.o.', 'ico' => '1', 'brand_tagline' => 't', 'copyright_text' => 'c', 'contact_email' => 'info@acme.cz', 'contact_phone' => '+420 123', 'address' => 'Praha']);
        $this->assertSame(['companyName' => 'Acme s.r.o.', 'contactEmail' => 'info@acme.cz', 'contactPhone' => '+420 123'], CompanyContactInfo::get());
    }

    /**
     * @description A document type lists its sections, a section knows its type.
     * @input Type gdpr with two sections.
     * @output sections count 2; section->documentType = gdpr.
     */
    public function test_legal_relations(): void
    {
        $type = DocumentType::create(['slug' => 'gdpr', 'title' => 'GDPR']);
        $section = DocumentSection::create(['document_type_id' => $type->id, 'content' => 'A', 'lang' => 'cz']);
        DocumentSection::create(['document_type_id' => $type->id, 'content' => 'B', 'lang' => 'en']);

        $this->assertSame(2, $type->sections()->count());
        $this->assertTrue($section->documentType->is($type));
    }

    /**
     * @description Rate limiters: login is limited per IP and per (normalised) e-mail, 2FA resend
     *   per IP, the api limiter per user, else per IP - 5 / 5 / 60 per minute.
     * @input Request from 10.0.0.1 with e-mail ' Eva@X.cz '; the same signed in as user 7.
     * @output Keys login-ip:10.0.0.1 / login-email:eva@x.cz, 2fa-resend-ip:10.0.0.1, api 10.0.0.1 / 7.
     */
    public function test_rate_limiters(): void
    {
        $request = Request::create('/api/login', 'POST', ['email' => ' Eva@X.cz '], [], [], ['REMOTE_ADDR' => '10.0.0.1']);

        $login = RateLimiter::limiter('login')($request);
        $this->assertSame(['login-ip:10.0.0.1', 'login-email:eva@x.cz'], array_map(fn (Limit $l) => $l->key, $login));
        $this->assertSame([5, 5], array_map(fn (Limit $l) => $l->maxAttempts, $login));
        $this->assertSame('2fa-resend-ip:10.0.0.1', RateLimiter::limiter('login-2fa-resend')($request)[0]->key);

        $api = RateLimiter::limiter('api');
        $this->assertSame(['10.0.0.1', 60], [$api($request)->key, $api($request)->maxAttempts]);
        $user = $this->user();
        $request->setUserResolver(fn () => $user);
        $this->assertSame($user->id, $api($request)->key);
    }
}
