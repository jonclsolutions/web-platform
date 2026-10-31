<?php

/**
 * @file CompanyContactInfo.php
 * @path app/Support/Mail/CompanyContactInfo.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Sdílená pomocná třída pro naplnění e-mailových šablon firemními
 * kontaktními údaji (patička s e-mailem/telefonem) - jeden zdroj pravdy napříč VŠEMI
 * Mailable třídami v aplikaci, ne kopírování `SiteSetting::first()->contact_email`
 * do každé zvlášť. Zdrojem je `SiteSetting` (`core/edit-legal` -> "Firemní údaje"
 * stránka v adminu, `SiteConfigurationController::updateSettings()`).
 * @dependencies
 * - App\Models\Legal\SiteSetting: Singleton řádek s firemní konfigurací.
 * @refactor-note (2026-10-31) A phone switched off in the admin (SiteSetting::hidden_fields)
 *   is returned as null - the mail footer leaves it out like a missing phone.
 */

namespace App\Support\Mail;

use App\Models\Legal\SiteSetting;

class CompanyContactInfo
{
    /**
     * @description Vrátí asociativní pole připravené k předání jako `Content::with()`
     * v Mailable třídě - klíče se stanou proměnnými přímo v Blade view
     * (`$companyName`, `$contactEmail`, `$contactPhone`). Chybějící/prázdný
     * `SiteSetting` řádek nikdy nezpůsobí chybu při odesílání e-mailu - v tom případě
     * se vrátí `companyName` z `config('app.name')` a kontakty jako `null` (šablona
     * pak celý řádek s kontaktem v patičce jednoduše vynechá, viz
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