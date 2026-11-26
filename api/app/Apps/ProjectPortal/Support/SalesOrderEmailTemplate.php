<?php

/**
 * @file SalesOrderEmailTemplate.php
 * @path app/Apps/ProjectPortal/Support/SalesOrderEmailTemplate.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Picks the editable content of the SalesOrder confirmation e-mail by the
 * language of the page the order was sent from (`SalesOrder::lang`, VT-15). The texts are edited
 * in the admin (Orders → E-mail template, `project_portal_settings.sales_order_email_*_i18n`).
 * @dependencies
 * - ProjectPortalSetting: the settings row with the editable i18n template.
 * - I18nEmailTemplate: the shared language fallback.
 */

namespace App\Apps\ProjectPortal\Support;

use App\Apps\ProjectPortal\Models\ProjectPortalSetting;
use App\Support\Mail\I18nEmailTemplate;

class SalesOrderEmailTemplate extends I18nEmailTemplate
{
    /** @description Column prefix of the template (project_portal_settings `sales_order_email_*_i18n`). */
    public const PREFIX = 'sales_order_email';

    /**
     * @description Built-in Czech texts (Czech = the default language): the last resort of a text
     *   the admin could not fill in yet - the Czech template must be complete to be saved, and the
     *   migration of 2026-11 filled the empty Czech texts with these.
     */
    public const DEFAULTS = [
        'subject'           => 'Vaše objednávka byla přijata',
        'title'             => 'Vaše objednávka byla přijata',
        'intro'             => 'děkujeme za Vaši objednávku. Byla úspěšně přijata a náš tým se jí bude v nejbližší době věnovat.',
        'outro'             => 'V případě dotazů nás neváhejte kontaktovat.',
        'greeting'          => 'Dobrý den',
        'summary_header'    => 'Rekapitulace objednávky',
        'label_name'        => 'Jméno / Firma',
        'label_ico'         => 'IČO',
        'label_email'       => 'Kontaktní e-mail',
        'label_phone'       => 'Telefon',
        'label_address'     => 'Adresa',
        'label_description' => 'Popis objednávky',
        'label_attachments' => 'Přiložené soubory',
        'label_date'        => 'Datum přijetí',
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
     * (1) the text filled in for `$lang`, (2) the text for 'cz' (the default language), (3) the
     * built-in Czech text.
     * @param string|null $lang Language of the order - null / empty behaves like 'cz'.
     * @return array<string, string> emailSubject, emailTitle, emailIntro, emailOutro, emailHtmlLang
     *   and the label variables of LABELS.
     */
    public static function forLang(?string $lang): array
    {
        $lang = $lang ?: 'cz';
        $settings = ProjectPortalSetting::current();
        $labels = self::textMap($settings->sales_order_email_labels_i18n ?? null);

        $texts = [
            'emailSubject'  => self::resolve(self::textMap($settings->sales_order_email_subject_i18n ?? null), $lang, self::DEFAULTS['subject']),
            'emailTitle'    => self::resolve(self::textMap($settings->sales_order_email_title_i18n ?? null), $lang, self::DEFAULTS['title']),
            'emailIntro'    => self::resolve(self::textMap($settings->sales_order_email_intro_i18n ?? null), $lang, self::DEFAULTS['intro']),
            'emailOutro'    => self::resolve(self::textMap($settings->sales_order_email_outro_i18n ?? null), $lang, self::DEFAULTS['outro']),
            'emailHtmlLang' => self::htmlLang($lang),
        ];
        foreach (self::LABELS as $key => $variable) {
            $texts[$variable] = self::resolveLabel(self::textMap($labels[$lang] ?? null), self::textMap($labels['cz'] ?? null), $key, self::DEFAULTS[$key]);
        }

        return $texts;
    }
}
