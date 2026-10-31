<?php
/**
 * @file legal_site_settings.php
 * @path api/database/seeders/data/legal_site_settings.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-30
 * @description Default company details of a new installation (legal_site_settings, singleton
 *   row): neutral English PLACEHOLDERS - visible at once as "to be filled in" (admin → Company
 *   details). The public footer, contact page and FAQ render only when this row exists.
 *   example.com is a domain reserved for examples (RFC 2606) - no real mailbox.
 * @note No Google Analytics ID: analytics may run only with consent and only once the operator
 *   sets their own ID. The logo is set by BaseDataSeeder (copied default logo).
 * @refactor-note (2026-10-31) `hidden_fields`: the GA field starts switched off (no ID yet);
 *   every other placeholder is switched on so it is visible as "to be filled in".
 */

return [
    'company_name'        => 'Company name Ltd.',
    'ico'                 => '00000000',
    'dic'                 => 'CZ00000000',
    'google_analytics_id' => null,
    'brand_tagline'       => 'Your company tagline',
    'brand_tagline_i18n'  => ['cz' => 'Your company tagline', 'en' => 'Your company tagline'],
    'copyright_text'      => '© Company name Ltd.',
    'copyright_text_i18n' => ['cz' => '© Company name Ltd.', 'en' => '© Company name Ltd.'],
    'contact_email'       => 'info@example.com',
    'contact_phone'       => '+420 000 000 000',
    'address'             => 'Street 1, 100 00 City',
    'footer_text'         => '© Company name Ltd. All rights reserved.',
    'hidden_fields'       => ['google_analytics_id'],
];
