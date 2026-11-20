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
    /**
     * @description Default texts used when the admin never filled in anything for the language
     * (nor for 'cz').
     */
    private const DEFAULT_TITLE = 'Your request has been received';
    private const DEFAULT_SUBJECT = 'Your request has been received';
    private const DEFAULT_INTRO = 'thank you for your request. It has been successfully received and our team will attend to it shortly.';
    private const DEFAULT_OUTRO = 'If you have any questions, please do not hesitate to contact us.';
    private const DEFAULT_GREETING = 'Hello,';
    private const DEFAULT_SUMMARY_HEADER = 'Request Summary';
    private const DEFAULT_LABEL_THEMA = 'Topic';
    private const DEFAULT_LABEL_EMAIL = 'Contact Email';
    private const DEFAULT_LABEL_PHONE = 'Phone';
    private const DEFAULT_LABEL_DESCRIPTION = 'Request Description';
    private const DEFAULT_LABEL_ATTACHMENTS = 'Attached Files';
    private const DEFAULT_LABEL_DATE = 'Date Received';

    /** @description Language codes allowed in the path of a translation file. */
    private const LANG_PATTERN = '/^[a-z]{2,5}$/';

    /** @var array<string, array<string, mixed>> Decoded translation files of this request. */
    private static array $translationFiles = [];

    /**
     * @description Returns the `Content::with()` array of texts for the language. Priority:
     * (1) the text filled in for `$lang`, (2) the text for `'cz'` (fallback language),
     * (3) the hard-coded default - never an empty / missing text, not even without a
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

        $titleI18n = $settings->raw_request_email_title_i18n ?? [];
        $introI18n = $settings->raw_request_email_intro_i18n ?? [];
        $outroI18n = $settings->raw_request_email_outro_i18n ?? [];
        $subjectI18n = $settings->raw_request_email_subject_i18n ?? [];
        $labelsI18n = $settings->raw_request_email_labels_i18n ?? [];

        $labelsForLang = $labelsI18n[$lang] ?? [];
        $labelsForCz   = $labelsI18n['cz'] ?? [];

        return [
            'emailSubject'          => self::resolve($subjectI18n, $lang, self::DEFAULT_SUBJECT),
            'emailTitle'            => self::resolve($titleI18n, $lang, self::DEFAULT_TITLE),
            'emailIntro'            => self::resolve($introI18n, $lang, self::DEFAULT_INTRO),
            'emailOutro'            => self::resolve($outroI18n, $lang, self::DEFAULT_OUTRO),
            'emailGreeting'         => self::resolveLabel($labelsForLang, $labelsForCz, 'greeting', self::DEFAULT_GREETING),
            'emailSummaryHeader'    => self::resolveLabel($labelsForLang, $labelsForCz, 'summary_header', self::DEFAULT_SUMMARY_HEADER),
            'emailLabelThema'       => self::resolveLabel($labelsForLang, $labelsForCz, 'label_thema', self::DEFAULT_LABEL_THEMA),
            'emailLabelEmail'       => self::resolveLabel($labelsForLang, $labelsForCz, 'label_email', self::DEFAULT_LABEL_EMAIL),
            'emailLabelPhone'       => self::resolveLabel($labelsForLang, $labelsForCz, 'label_phone', self::DEFAULT_LABEL_PHONE),
            'emailLabelDescription' => self::resolveLabel($labelsForLang, $labelsForCz, 'label_description', self::DEFAULT_LABEL_DESCRIPTION),
            'emailLabelAttachments' => self::resolveLabel($labelsForLang, $labelsForCz, 'label_attachments', self::DEFAULT_LABEL_ATTACHMENTS),
            'emailLabelDate'        => self::resolveLabel($labelsForLang, $labelsForCz, 'label_date', self::DEFAULT_LABEL_DATE),
        ];
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
