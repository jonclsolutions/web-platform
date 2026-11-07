<?php

/**
 * @file SalesOrderEmailTemplate.php
 * @path app/Support/Mail/SalesOrderEmailTemplate.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Picks the editable content of the WebSalesOrder confirmation e-mail by the
 * language of the page the order was sent from (`WebSalesOrder::lang`, VT-15) - the same
 * mechanism as the inquiry confirmation (RawRequestEmailTemplate). The texts are edited in the
 * admin (Received orders → E-mail template, `web_site_settings.sales_order_email_*_i18n`).
 * @dependencies
 * - App\Models\Web\WebSiteSetting: singleton row with the editable i18n template.
 * - I18nEmailTemplate: the shared language fallback.
 */

namespace App\Support\Mail;

use App\Models\Web\WebSiteSetting;

class SalesOrderEmailTemplate extends I18nEmailTemplate
{
    /**
     * @description Built-in texts used when the admin filled in nothing for the language (nor
     * for 'cz'). MUST match the defaults of the admin editor (`sales-orders.email_tpl_default_*`).
     */
    public const DEFAULTS = [
        'subject'           => 'Your order has been received',
        'title'             => 'Your order has been received',
        'intro'             => 'thank you for your order. It has been successfully received and our team will attend to it shortly.',
        'outro'             => 'If you have any questions, please do not hesitate to contact us.',
        'greeting'          => 'Hello',
        'summary_header'    => 'Order Summary',
        'label_name'        => 'Name / Company',
        'label_ico'         => 'Company ID',
        'label_email'       => 'Contact Email',
        'label_phone'       => 'Phone',
        'label_address'     => 'Address',
        'label_description' => 'Order Description',
        'label_attachments' => 'Attached Files',
        'label_date'        => 'Date Received',
    ];

    /** @description Label keys of `sales_order_email_labels_i18n` → variable of the view. */
    private const LABELS = [
        'greeting' => 'emailGreeting', 'summary_header' => 'emailSummaryHeader', 'label_name' => 'emailLabelName',
        'label_ico' => 'emailLabelIco', 'label_email' => 'emailLabelEmail', 'label_phone' => 'emailLabelPhone',
        'label_address' => 'emailLabelAddress', 'label_description' => 'emailLabelDescription',
        'label_attachments' => 'emailLabelAttachments', 'label_date' => 'emailLabelDate',
    ];

    /**
     * @description Returns the `Content::with()` array of texts for the language. Priority:
     * (1) the text filled in for `$lang`, (2) the text for 'cz', (3) the built-in default.
     * @param string|null $lang Language of the order - null / empty behaves like 'cz'.
     * @return array<string, string> emailSubject, emailTitle, emailIntro, emailOutro, emailHtmlLang
     *   and the label variables of LABELS.
     */
    public static function forLang(?string $lang): array
    {
        $lang = $lang ?: 'cz';
        $settings = WebSiteSetting::first();
        $labels = $settings->sales_order_email_labels_i18n ?? [];

        $texts = [
            'emailSubject'  => self::resolve($settings->sales_order_email_subject_i18n ?? [], $lang, self::DEFAULTS['subject']),
            'emailTitle'    => self::resolve($settings->sales_order_email_title_i18n ?? [], $lang, self::DEFAULTS['title']),
            'emailIntro'    => self::resolve($settings->sales_order_email_intro_i18n ?? [], $lang, self::DEFAULTS['intro']),
            'emailOutro'    => self::resolve($settings->sales_order_email_outro_i18n ?? [], $lang, self::DEFAULTS['outro']),
            'emailHtmlLang' => self::htmlLang($lang),
        ];
        foreach (self::LABELS as $key => $variable) {
            $texts[$variable] = self::resolveLabel($labels[$lang] ?? [], $labels['cz'] ?? [], $key, self::DEFAULTS[$key]);
        }

        return $texts;
    }
}
