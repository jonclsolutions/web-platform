<?php

/**
 * @file RawRequestEmailTemplate.php
 * @path app/Apps/Web/Support/RawRequestEmailTemplate.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Picks the editable content of the WebRawRequestCommission confirmation e-mail by
 * the language of the sender - one place for the fallback logic, like `CompanyContactInfo`.
 * @dependencies
 * - App\Apps\Web\Models\WebSiteSetting: singleton row with the editable i18n template.
 * - I18nEmailTemplate: the shared language fallback.
 * - storage/app/public/translations/web/{lang}.json: texts of the contact form - the names of
 *   the topics (`contact.options.<slug>`) shown instead of the stored slug.
 */

namespace App\Apps\Web\Support;

use App\Apps\Web\Models\WebSiteSetting;
use App\Support\Mail\I18nEmailTemplate;

class RawRequestEmailTemplate extends I18nEmailTemplate
{
    /** @description Column prefix of the template (web_site_settings `raw_request_email_*_i18n`). */
    public const PREFIX = 'raw_request_email';

    /**
     * @description Built-in Czech texts (Czech = the default language): the last resort of a text
     *   the admin could not fill in yet - the Czech template must be complete to be saved, and the
     *   migration of 2026-11 filled the empty Czech texts with these.
     */
    public const DEFAULTS = [
        'subject'           => 'Vaše poptávka byla přijata',
        'title'             => 'Vaše poptávka byla přijata',
        'intro'             => 'děkujeme za Vaši poptávku. Byla úspěšně přijata a náš tým se jí bude v nejbližší době věnovat.',
        'outro'             => 'V případě dotazů nás neváhejte kontaktovat.',
        'greeting'          => 'Dobrý den,',
        'summary_header'    => 'Rekapitulace poptávky',
        'label_thema'       => 'Téma',
        'label_email'       => 'Kontaktní e-mail',
        'label_phone'       => 'Telefon',
        'label_description' => 'Popis požadavku',
        'label_attachments' => 'Přiložené soubory',
        'label_date'        => 'Datum přijetí',
    ];

    /** @description Label keys of `raw_request_email_labels_i18n` → variable of the view. */
    private const LABELS = [
        'greeting' => 'emailGreeting', 'summary_header' => 'emailSummaryHeader', 'label_thema' => 'emailLabelThema',
        'label_email' => 'emailLabelEmail', 'label_phone' => 'emailLabelPhone', 'label_description' => 'emailLabelDescription',
        'label_attachments' => 'emailLabelAttachments', 'label_date' => 'emailLabelDate',
    ];

    /** @description Language codes allowed in the path of a translation file. */
    private const LANG_PATTERN = '/^[a-z]{2,5}$/';

    /** @var array<string, array<string, mixed>> Decoded translation files of this request. */
    private static array $translationFiles = [];

    /**
     * @description Returns the `Content::with()` array of texts for the language. Priority:
     * (1) the text filled in for `$lang`, (2) the text for `'cz'` (the default language),
     * (3) the built-in Czech text - never an empty / missing text, not even without a
     * `WebSiteSetting` row (new installation).
     * @param string|null $lang Language of the record (`WebRawRequestCommission::lang`) -
     * `null` / empty string behaves like `'cz'`.
     * @return array{emailSubject: string, emailTitle: string, emailIntro: string, emailOutro: string,
     * emailGreeting: string, emailSummaryHeader: string, emailLabelThema: string,
     * emailLabelEmail: string, emailLabelPhone: string, emailLabelDescription: string,
     * emailLabelAttachments: string, emailLabelDate: string}
     */
    public static function forLang(?string $lang): array
    {
        $lang = $lang ?: 'cz';
        $settings = WebSiteSetting::first();
        $labels = self::textMap($settings->raw_request_email_labels_i18n ?? null);

        $texts = [
            'emailSubject' => self::resolve(self::textMap($settings->raw_request_email_subject_i18n ?? null), $lang, self::DEFAULTS['subject']),
            'emailTitle'   => self::resolve(self::textMap($settings->raw_request_email_title_i18n ?? null), $lang, self::DEFAULTS['title']),
            'emailIntro'   => self::resolve(self::textMap($settings->raw_request_email_intro_i18n ?? null), $lang, self::DEFAULTS['intro']),
            'emailOutro'   => self::resolve(self::textMap($settings->raw_request_email_outro_i18n ?? null), $lang, self::DEFAULTS['outro']),
        ];
        foreach (self::LABELS as $key => $variable) {
            $texts[$variable] = self::resolveLabel(self::textMap($labels[$lang] ?? null), self::textMap($labels['cz'] ?? null), $key, self::DEFAULTS[$key]);
        }

        return $texts;
    }

    /**
     * @description Name of the topic of a request as the customer saw it in the contact form: the
     *   public form stores a slug (new_project, support, careers, other), its name is the text
     *   `contact.options.<slug>` of the web translations - in the language of the request, else in
     *   Czech. A topic typed in the admin (free text) or a slug without a text is returned as it is.
     * @param string|null $thema Stored topic.
     * @param string|null $lang Language of the request (null / empty = Czech).
     * @return string The text for the subject and the summary of the e-mail.
     */
    public static function themaLabel(?string $thema, ?string $lang): string
    {
        $thema = trim((string) $thema);
        if ($thema === '') {
            return '';
        }
        foreach (array_unique([$lang ?: 'cz', 'cz']) as $code) {
            $text = self::translations($code)['contact']['options'][$thema] ?? null;
            if (is_string($text) && trim($text) !== '') {
                return trim($text);
            }
        }

        return $thema;
    }

    /**
     * @description Decoded web translations of a language ([] when the file is missing, invalid
     *   or the code is not a language code - never a path outside the folder).
     * @param string $lang Language code.
     * @return array<string, mixed>
     */
    private static function translations(string $lang): array
    {
        if (!preg_match(self::LANG_PATTERN, $lang)) {
            return [];
        }
        $path = storage_path("app/public/translations/web/{$lang}.json");
        $key = $path;
        if (!array_key_exists($key, self::$translationFiles)) {
            $decoded = is_file($path) ? json_decode((string) file_get_contents($path), true) : null;
            self::$translationFiles[$key] = is_array($decoded) ? $decoded : [];
        }

        return self::$translationFiles[$key];
    }
}
