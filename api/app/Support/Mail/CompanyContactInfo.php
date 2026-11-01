<?php

/**
 * @file CompanyContactInfo.php
 * @path app/Support/Mail/CompanyContactInfo.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Company contact details for the e-mail templates (footer with e-mail / phone) -
 * one source for EVERY Mailable instead of reading `SiteSetting::first()->contact_email` in
 * each. The source is `SiteSetting` (admin "Company details",
 * `SiteConfigurationController::updateSettings()`). A phone switched off in the admin
 * (`hidden_fields`) is returned as null.
 * @dependencies
 * - App\Models\Legal\SiteSetting: singleton row of the company details.
 */

namespace App\Support\Mail;

use App\Models\Legal\SiteSetting;

class CompanyContactInfo
{
    /**
     * @description Returns an array for `Content::with()` of a Mailable - the keys become
     * variables of the Blade view (`$companyName`, `$contactEmail`, `$contactPhone`). A missing
     * `SiteSetting` row never breaks sending: `companyName` falls back to `config('app.name')` and
     * the contacts are `null` (the footer then leaves the contact line out, see
     * `emails/partials/footer.blade.php`).
     * @return array{companyName: string, contactEmail: string|null, contactPhone: string|null}
     */
    public static function get(): array
    {
        $settings = SiteSetting::first();

        return [
            'companyName'  => $settings->company_name ?? config('app.name'),
            'contactEmail' => $settings->contact_email ?? null,
            // A phone switched off in the admin is not shown in the e-mails either.
            'contactPhone' => $settings?->isFieldHidden('contact_phone') ? null : ($settings->contact_phone ?? null),
        ];
    }
}