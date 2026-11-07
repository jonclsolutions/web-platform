<?php

/**
 * @file RawRequestEmailTemplate.php
 * @path app/Support/Mail/RawRequestEmailTemplate.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Picks the editable content of the WebRawRequestCommission confirmation e-mail by
 * the language of the sender - one place for the fallback logic, like `CompanyContactInfo`.
 * @dependencies
 * - App\Models\Web\WebSiteSetting: singleton row with the editable i18n template.
 * - I18nEmailTemplate: the shared language fallback.
 */

namespace App\Support\Mail;

use App\Models\Web\WebSiteSetting;

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
}
