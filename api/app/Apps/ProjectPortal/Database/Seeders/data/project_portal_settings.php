<?php
/**
 * @file project_portal_settings.php
 * @path api/app/Apps/ProjectPortal/Database/Seeders/data/project_portal_settings.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Default row of project_portal_settings (one row): the texts of the confirmation
 *   e-mail of an order (editable in the admin, Orders → E-mail template).
 */

return [
    'sales_order_email_subject_i18n' => ['cz' => 'Vaše objednávka byla přijata', 'en' => 'Your order has been received'],
    'sales_order_email_title_i18n' => ['cz' => 'Vaše objednávka byla přijata', 'en' => 'Your order has been received'],
    'sales_order_email_intro_i18n' => ['cz' => 'děkujeme za Vaši objednávku. Byla úspěšně přijata a náš tým se jí bude v nejbližší době věnovat.', 'en' => 'thank you for your order. It has been successfully received and our team will attend to it shortly.'],
    'sales_order_email_outro_i18n' => ['cz' => 'V případě dotazů nás neváhejte kontaktovat.', 'en' => 'If you have any questions, please do not hesitate to contact us.'],
    'sales_order_email_labels_i18n' => [
        'cz' => [
            'greeting' => 'Dobrý den',
            'summary_header' => 'Rekapitulace objednávky',
            'label_name' => 'Jméno / Firma',
            'label_ico' => 'IČO',
            'label_email' => 'Kontaktní e-mail',
            'label_phone' => 'Telefon',
            'label_address' => 'Adresa',
            'label_description' => 'Popis objednávky',
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
