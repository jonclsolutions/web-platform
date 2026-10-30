<?php
/**
 * @file web_site_settings.php
 * @path api/database/seeders/data/web_site_settings.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026-10-30
 * @description Default row of web_site_settings (singleton id 1): web switched on, maintenance
 *   message, texts of the confirmation e-mail of a raw request (all editable in the admin).
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
];
