<?php
/**
 * @file web_site_settings.php
 * @path api/app/Apps/Web/Database/Seeders/data/web_site_settings.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Default row of web_site_settings (singleton id 1): web switched on, maintenance
 *   message, texts of the confirmation e-mails of a raw request and of a sales order (all
 *   editable in the admin).
 *   Generated from the database dump of 2026-10-29 (typos of the default e-mail texts fixed);
 *   edit by hand from now on.
 */

return [
    'is_web_active' => 1,
    'web_maintenance_message' => 'Omlouváme se, web je momentálně v údržbě.',
    'raw_request_email_title_i18n' => ['cz' => 'Vaše poptávka byla přijata', 'en' => 'Your request has been accepted'],
    'raw_request_email_intro_i18n' => ['cz' => 'děkujeme za Vaši poptávku. Byla úspěšně přijata a náš tým se jí bude v nejbližší době věnovat.', 'en' => 'thank you for your request. It has been received and our team will look at it shortly.'],
    'raw_request_email_outro_i18n' => ['cz' => 'V případě dotazů nás neváhejte kontaktovat.', 'en' => 'If you have any questions, do not hesitate to contact us.'],
    'raw_request_email_labels_i18n' => [
        'cz' => [],
        'en' => [
            'greeting' => 'Hello,',
            'summary_header' => 'Recapitulation',
            'label_thema' => 'Topic',
            'label_email' => 'Contact Email',
            'label_phone' => 'Telephone',
            'label_description' => 'Description',
            'label_attachments' => 'Attachments',
            'label_date' => 'Date',
        ],
    ],
    'raw_request_email_subject_i18n' => ['cz' => 'Vaše poptávka byla přijata', 'en' => 'Order information'],
    'sales_order_email_subject_i18n' => ['cz' => 'Vaše poptávka byla přijata', 'en' => 'Your order has been received'],
    'sales_order_email_title_i18n' => ['cz' => 'Vaše poptávka byla přijata', 'en' => 'Your order has been received'],
    'sales_order_email_intro_i18n' => ['cz' => 'děkujeme za Vaši poptávku. Byla úspěšně přijata a náš tým se jí bude v nejbližší době věnovat.', 'en' => 'thank you for your order. It has been successfully received and our team will attend to it shortly.'],
    'sales_order_email_outro_i18n' => ['cz' => 'V případě dotazů nás neváhejte kontaktovat.', 'en' => 'If you have any questions, please do not hesitate to contact us.'],
    'sales_order_email_labels_i18n' => [
        'cz' => [
            'greeting' => 'Dobrý den',
            'summary_header' => 'Rekapitulace poptávky',
            'label_name' => 'Jméno / Firma',
            'label_ico' => 'IČO',
            'label_email' => 'Kontaktní e-mail',
            'label_phone' => 'Telefon',
            'label_address' => 'Adresa',
            'label_description' => 'Popis poptávky',
            'label_attachments' => 'Přiložené soubory',
            'label_date' => 'Datum přijetí',
        ],
        'en' => [
            'greeting' => 'Hello',
            'summary_header' => 'Order Summary',
            'label_name' => 'Name / Company',
            'label_ico' => 'Company ID',
            'label_email' => 'Contact Email',
            'label_phone' => 'Phone',
            'label_address' => 'Address',
            'label_description' => 'Order Description',
            'label_attachments' => 'Attached Files',
            'label_date' => 'Date Received',
        ],
    ],
];
