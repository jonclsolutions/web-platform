<?php
/**
 * @file legal_site_settings.php
 * @path api/database/seeders/data/legal_site_settings.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Default company details of a new installation (legal_site_settings, singleton
 *   row): neutral English PLACEHOLDERS - visible at once as "to be filled in" (admin → Company
 *   details). The public footer, contact page and FAQ render only when this row exists.
 *   example.com is a domain reserved for examples (RFC 2606) - no real mailbox.
 * @note The tagline per language is filled in every language of the
 *   default translations (resources/translations/languages.json) - a seeded language is complete.
 *   The copyright line is a text of the applications (`footer.copyright_text`), not seeded here.
 * @note No Google Analytics ID: analytics may run only with consent and only once the operator
 *   sets their own ID. The logo is set by BaseDataSeeder (copied default logo).
 */

return [
    'company_name'        => 'Company name Ltd.',
    'ico'                 => '00000000',
    'dic'                 => 'CZ00000000',
    'google_analytics_id' => null,
    'brand_tagline'       => 'Your company tagline',
    'brand_tagline_i18n'  => ['cz' => 'Your company tagline', 'en' => 'Your company tagline', 'pl' => 'Your company tagline', 'fr' => 'Your company tagline', 'de' => 'Your company tagline'],
    'contact_email'       => 'info@example.com',
    'contact_phone'       => '+420 000 000 000',
    'address'             => 'Street 1, 100 00 City',
    'hidden_fields'       => ['google_analytics_id'],
];
