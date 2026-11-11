<?php
/**
 * @file shop_order_email.php
 * @path api/database/seeders/Shop/data/shop_order_email.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Czech texts of the e-shop order confirmation e-mail (shop_site_settings
 *   `order_email_*_i18n`, ShopOrderEmailTemplate) - part of the default settings row
 *   (data/shop_site_settings.php) and filled into an existing row by the migration
 *   2026_11_14_000000_shop_order_confirmation_email. Editable in the admin (E-shop orders →
 *   Edit confirmation e-mail); other languages fall back to them.
 */

return [
    'order_email_subject_i18n' => ['cz' => 'Potvrzení objednávky'],
    'order_email_title_i18n'   => ['cz' => 'Děkujeme za Vaši objednávku'],
    'order_email_intro_i18n'   => ['cz' => 'potvrzujeme přijetí Vaší objednávky. Její rekapitulaci najdete níže; jakmile ji odešleme, dáme Vám vědět.'],
    'order_email_outro_i18n'   => ['cz' => 'V případě dotazů nás neváhejte kontaktovat.'],
    'order_email_labels_i18n'  => ['cz' => [
        'greeting'           => 'Dobrý den',
        'summary_header'     => 'Rekapitulace objednávky',
        'label_order_number' => 'Číslo objednávky',
        'label_date'         => 'Datum objednávky',
        'label_product'      => 'Zboží',
        'label_quantity'     => 'Ks',
        'label_unit_price'   => 'Cena / ks',
        'label_line_total'   => 'Celkem',
        'label_subtotal'     => 'Zboží celkem',
        'label_discount'     => 'Sleva',
        'label_shipping'     => 'Doprava',
        'label_payment'      => 'Platba',
        'label_total'        => 'Celkem k úhradě vč. DPH',
        'label_vat'          => 'z toho DPH',
        'label_delivery'     => 'Doručovací adresa',
        'label_contact'      => 'Kontakt',
        'label_notes'        => 'Poznámka',
        'withdrawal_info'    => 'Jako spotřebitel máte právo od smlouvy odstoupit bez udání důvodu do 14 dnů od převzetí zboží. Podmínky odstoupení jsou součástí našich obchodních podmínek.',
        'terms_link'         => 'Obchodní podmínky',
    ]],
];
