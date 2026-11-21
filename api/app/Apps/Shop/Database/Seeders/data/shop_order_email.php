<?php
/**
 * @file shop_order_email.php
 * @path api/app/Apps/Shop/Database/Seeders/data/shop_order_email.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Czech texts of the e-shop order confirmation e-mail (shop_site_settings
 *   `order_email_*_i18n`, ShopOrderEmailTemplate) - part of the default settings row
 *   (data/shop_site_settings.php) and filled into an existing row by the migration
 *   2026_11_14_000000_shop_order_confirmation_email (texts added later: by their own migration,
 *   e.g. 2026_11_21_000003_shop_unpaid_orders). The reminder / cancellation e-mails of an unpaid
 *   order use them too. Editable in the admin (E-shop orders →
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
        'label_company_ids'  => 'IČO / DIČ',
        'label_notes'        => 'Poznámka',
        'payment_details_header' => 'Platební údaje',
        'label_account'      => 'Číslo účtu',
        'label_iban'         => 'IBAN',
        'label_swift'        => 'SWIFT / BIC',
        'label_variable_symbol' => 'Variabilní symbol',
        'label_pay_by'       => 'Uhradit do',
        'reminder_subject'   => 'Připomínka platby objednávky',
        'reminder_intro'     => 'zatím jsme neobdrželi platbu za Vaši objednávku. Uhraďte ji prosím do níže uvedeného data, jinak objednávku zrušíme. Pokud jste již zaplatili, tento e-mail prosím ignorujte.',
        'canceled_subject'   => 'Zrušení objednávky',
        'canceled_intro'     => 'Vaši objednávku jsme zrušili, protože jsme za ni ve stanovené lhůtě neobdrželi platbu. Pokud o zboží stále máte zájem, objednejte ho prosím znovu.',
        'withdrawal_info'    => 'Jako spotřebitel máte právo od smlouvy odstoupit bez udání důvodu do 14 dnů od převzetí zboží. Podmínky odstoupení jsou součástí našich obchodních podmínek.',
        'terms_link'         => 'Obchodní podmínky',
    ]],
];
