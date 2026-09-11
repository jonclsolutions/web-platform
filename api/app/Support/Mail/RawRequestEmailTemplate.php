<?php

/**
 * @file RawRequestEmailTemplate.php
 * @path app/Support/Mail/RawRequestEmailTemplate.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Sdílená pomocná třída pro výběr editovatelného obsahu potvrzovacího
 * e-mailu WebRawRequestCommission podle jazyka odesílatele - jeden zdroj pravdy pro
 * fallback logiku, analogicky k `CompanyContactInfo`.
 * @dependencies
 * - App\Models\Web\WebSiteSetting: Singleton řádek s editovatelnou i18n šablonou
 *   (viz refactor-note 2026-08-19 v hlavičce WebSiteSetting.php).
 *
 * @refactor-note (2026-08-19v2) BACKLOG "editace všech textů + live preview":
 * rozšířeno o pozdrav, nadpis rekapitulace a 6 popisků tabulky (dřív natvrdo v Blade
 * šabloně) - viz `raw_request_email_labels_i18n` sloupec. Fallback logika stejná jako
 * u title/intro/outro: text pro `$lang` -> text pro `'cz'` -> hardcoded default.
 */

namespace App\Support\Mail;

use App\Models\Web\WebSiteSetting;

class RawRequestEmailTemplate
{
    /**
     * @description Výchozí texty použité, pokud admin pro daný jazyk (ani pro 'cz')
     * nikdy nic nevyplnil - stejné znění, jaké šablona měla natvrdo PŘED zavedením
     * editovatelného obsahu, takže bez zásahu admina se e-mail chová beze změny.
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
     * @description Vrátí `Content::with()` pole s texty pro daný jazyk. Priorita:
     * (1) text vyplněný pro `$lang`, (2) text vyplněný pro `'cz'` (fallback jazyk),
     * (3) hardcoded default - nikdy nevrátí prázdný/chybějící text, ani když
     * `WebSiteSetting` řádek vůbec neexistuje (nový/nenastavený systém).
     * @param string|null $lang Jazyk záznamu (`WebRawRequestCommission::lang`) -
     * `null`/prázdný string se chová jako `'cz'`.
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
     * @description Vybere první neprázdnou hodnotu z: `$i18n[$lang]`, `$i18n['cz']`,
     * `$default` (pro title/intro/outro - ploché i18n pole keyed přímo jazykem).
     */
    private static function resolve(array $i18n, string $lang, string $default): string
    {
        $candidate = $i18n[$lang] ?? $i18n['cz'] ?? null;
        return ($candidate !== null && trim($candidate) !== '') ? $candidate : $default;
    }

    /**
     * @description Stejná fallback logika jako `resolve()`, ale pro vnořenou strukturu
     * `raw_request_email_labels_i18n[jazyk][klíč]` - `$forLang`/`$forCz` jsou už
     * rozbalené sub-objekty pro konkrétní jazyk resp. pro 'cz'.
     */
    private static function resolveLabel(array $forLang, array $forCz, string $key, string $default): string
    {
        $candidate = $forLang[$key] ?? $forCz[$key] ?? null;
        return ($candidate !== null && trim($candidate) !== '') ? $candidate : $default;
    }
}