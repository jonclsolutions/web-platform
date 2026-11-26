<?php

/**
 * @file ShopOrderEmailTemplate.php
 * @path app/Apps/Shop/Support/ShopOrderEmailTemplate.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Texts of the e-shop order confirmation e-mail (ShopOrderConfirmation) in the
 * language of the storefront the order was placed from (`ShopOrder::lang`) - the shared mechanism of
 * the confirmation e-mails (I18nEmailTemplate). The texts are edited in the admin
 * (E-shop orders → Edit confirmation e-mail, `shop_site_settings.order_email_*_i18n`); a language
 * without text uses the Czech one, then the built-in default (I18nEmailTemplate).
 * @note The same texts serve the payment reminder and the cancellation of an unpaid order
 * (ShopPaymentReminder, ShopOrderCanceled: `reminder_*`, `canceled_*`, `label_pay_by`) - one place
 * in the admin for all e-mails of an order.
 * @note The e-mail is the confirmation of the concluded contract on a durable medium (Directive
 * 2011/83/EU, Art. 8(7)): besides the order it carries the information on the right of withdrawal
 * (`withdrawal_info`) and the link to the terms and conditions (`terms_link`).
 * @dependencies
 * - App\Apps\Shop\Models\ShopSiteSetting: singleton row with the editable texts.
 * - I18nEmailTemplate: the shared language fallback.
 */

namespace App\Apps\Shop\Support;

use App\Apps\Shop\Models\ShopSiteSetting;
use App\Support\Mail\I18nEmailTemplate;

class ShopOrderEmailTemplate extends I18nEmailTemplate
{
    /** @description Template fields of shop_site_settings (admin API, language purge). */
    public const FIELDS = ['order_email_subject_i18n', 'order_email_title_i18n', 'order_email_intro_i18n', 'order_email_outro_i18n', 'order_email_labels_i18n'];

    /** @description Column prefix of the template (shop_site_settings `order_email_*_i18n`). */
    public const PREFIX = 'order_email';

    /**
     * @description Built-in Czech texts (Czech = the default language): the last resort of a text
     *   the admin could not fill in yet - the Czech template must be complete to be saved, and the
     *   migration of 2026-11 filled the empty Czech texts with these (the same as the seed,
     *   data/shop_order_email.php).
     */
    public const DEFAULTS = [
        'subject'               => 'Potvrzení objednávky',
        'title'                 => 'Děkujeme za Vaši objednávku',
        'intro'                 => 'potvrzujeme přijetí Vaší objednávky. Její rekapitulaci najdete níže; jakmile ji odešleme, dáme Vám vědět.',
        'outro'                 => 'V případě dotazů nás neváhejte kontaktovat.',
        'greeting'              => 'Dobrý den',
        'summary_header'        => 'Rekapitulace objednávky',
        'label_order_number'    => 'Číslo objednávky',
        'label_date'            => 'Datum objednávky',
        'label_product'         => 'Zboží',
        'label_quantity'        => 'Ks',
        'label_unit_price'      => 'Cena / ks',
        'label_line_total'      => 'Celkem',
        'label_subtotal'        => 'Zboží celkem',
        'label_discount'        => 'Sleva',
        'label_shipping'        => 'Doprava',
        'label_payment'         => 'Platba',
        'label_total'           => 'Celkem k úhradě vč. DPH',
        'label_vat'             => 'z toho DPH',
        'label_delivery'        => 'Doručovací adresa',
        'label_contact'         => 'Kontakt',
        'label_company_ids'     => 'IČO / DIČ',
        'label_notes'           => 'Poznámka',
        // Payment details of a bank transfer (confirmation and reminder).
        'payment_details_header' => 'Platební údaje',
        'label_account'         => 'Číslo účtu',
        'label_iban'            => 'IBAN',
        'label_swift'           => 'SWIFT / BIC',
        'label_variable_symbol' => 'Variabilní symbol',
        // Payment reminder / automatic cancellation of an unpaid order (UnpaidOrders, audit B-04).
        'label_pay_by'          => 'Uhradit do',
        'reminder_subject'      => 'Připomínka platby objednávky',
        'reminder_intro'        => 'zatím jsme neobdrželi platbu za Vaši objednávku. Uhraďte ji prosím do níže uvedeného data, jinak objednávku zrušíme. Pokud jste již zaplatili, tento e-mail prosím ignorujte.',
        'canceled_subject'      => 'Zrušení objednávky',
        'canceled_intro'        => 'Vaši objednávku jsme zrušili, protože jsme za ni ve stanovené lhůtě neobdrželi platbu. Pokud o zboží stále máte zájem, objednejte ho prosím znovu.',
        'withdrawal_info'       => 'Jako spotřebitel máte právo od smlouvy odstoupit bez udání důvodu do 14 dnů od převzetí zboží. Podmínky odstoupení jsou součástí našich obchodních podmínek.',
        'terms_link'            => 'Obchodní podmínky',
    ];

    /**
     * @description Returns the `Content::with()` array of texts for the language. Priority:
     * (1) the text filled in for `$lang`, (2) the text for 'cz' (the default language), (3) the
     * built-in Czech text.
     * @param string|null $lang Language of the order - null / empty behaves like 'cz'.
     * @return array{subject: string, title: string, intro: string, outro: string, htmlLang: string,
     *   labels: array<string, string>}
     */
    public static function forLang(?string $lang): array
    {
        $lang = $lang ?: 'cz';
        $settings = ShopSiteSetting::first();
        $labels = self::textMap($settings?->order_email_labels_i18n);

        $texts = [
            'subject'  => self::resolve(self::textMap($settings?->order_email_subject_i18n), $lang, self::DEFAULTS['subject']),
            'title'    => self::resolve(self::textMap($settings?->order_email_title_i18n), $lang, self::DEFAULTS['title']),
            'intro'    => self::resolve(self::textMap($settings?->order_email_intro_i18n), $lang, self::DEFAULTS['intro']),
            'outro'    => self::resolve(self::textMap($settings?->order_email_outro_i18n), $lang, self::DEFAULTS['outro']),
            'htmlLang' => self::htmlLang($lang),
            'labels'   => [],
        ];
        foreach (array_keys(self::DEFAULTS) as $key) {
            if (!in_array($key, self::FLAT, true)) {
                $texts['labels'][$key] = self::resolveLabel(self::textMap($labels[$lang] ?? null), self::textMap($labels['cz'] ?? null), $key, self::DEFAULTS[$key]);
            }
        }

        return $texts;
    }

    /**
     * @description Removes the texts of a deleted language of the e-shop (nothing of it stays on
     * the server).
     * @param string $code Language code.
     * @return void
     */
    public static function forget(string $code): void
    {
        $settings = ShopSiteSetting::first();
        if (!$settings) {
            return;
        }
        foreach (self::FIELDS as $field) {
            $texts = $settings->{$field};
            if (is_array($texts) && array_key_exists($code, $texts)) {
                unset($texts[$code]);
                $settings->{$field} = $texts;
            }
        }
        $settings->save();
    }

    /**
     * @description Amount of the e-mail in EUR (the e-shop prices in EUR): Czech style
     * "1 234,50 €" for Czech, "1,234.50 €" otherwise.
     * @param float|string|null $amount Amount.
     * @param string|null $lang Language of the order.
     * @return string
     */
    public static function money(float|string|null $amount, ?string $lang): string
    {
        $value = (float) ($amount ?? 0);

        return (($lang ?: 'cz') === 'cz'
            ? number_format($value, 2, ',', "\u{00A0}")
            : number_format($value, 2, '.', ',')) . "\u{00A0}€";
    }
}
