<?php

/**
 * @file ShopOrderEmailTemplate.php
 * @path app/Support/Mail/ShopOrderEmailTemplate.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Texts of the e-shop order confirmation e-mail (ShopOrderConfirmation) in the
 * language of the storefront the order was placed from (`ShopOrder::lang`) - the same mechanism as
 * the web order confirmation (SalesOrderEmailTemplate). The texts are edited in the admin
 * (E-shop orders → Edit confirmation e-mail, `shop_site_settings.order_email_*_i18n`); a language
 * without text uses the Czech one, then the built-in default (I18nEmailTemplate).
 * @note The e-mail is the confirmation of the concluded contract on a durable medium (Directive
 * 2011/83/EU, Art. 8(7)): besides the order it carries the information on the right of withdrawal
 * (`withdrawal_info`) and the link to the terms and conditions (`terms_link`).
 * @dependencies
 * - App\Models\Shop\ShopSiteSetting: singleton row with the editable texts.
 * - I18nEmailTemplate: the shared language fallback.
 */

namespace App\Support\Mail;

use App\Models\Shop\ShopSiteSetting;

class ShopOrderEmailTemplate extends I18nEmailTemplate
{
    /** @description Template fields of shop_site_settings (admin API, language purge). */
    public const FIELDS = ['order_email_subject_i18n', 'order_email_title_i18n', 'order_email_intro_i18n', 'order_email_outro_i18n', 'order_email_labels_i18n'];

    /**
     * @description Built-in texts used when the admin filled in nothing for the language (nor for
     * 'cz'). MUST match the defaults of the admin editor (`orders.email_tpl_default_*`).
     */
    public const DEFAULTS = [
        'subject'               => 'Order confirmation',
        'title'                 => 'Thank you for your order',
        'intro'                 => 'we confirm the receipt of your order. Its summary is below; we will let you know when it is on its way.',
        'outro'                 => 'If you have any questions, please do not hesitate to contact us.',
        'greeting'              => 'Hello',
        'summary_header'        => 'Order summary',
        'label_order_number'    => 'Order number',
        'label_date'            => 'Order date',
        'label_product'         => 'Product',
        'label_quantity'        => 'Qty',
        'label_unit_price'      => 'Unit price',
        'label_line_total'      => 'Total',
        'label_subtotal'        => 'Goods',
        'label_discount'        => 'Discount',
        'label_shipping'        => 'Shipping',
        'label_payment'         => 'Payment',
        'label_total'           => 'Total incl. VAT',
        'label_vat'             => 'of which VAT',
        'label_delivery'        => 'Delivery address',
        'label_contact'         => 'Contact',
        'label_notes'           => 'Note',
        'withdrawal_info'       => 'As a consumer you may withdraw from the contract within 14 days of receiving the goods without giving any reason. The conditions of the withdrawal are part of our terms and conditions.',
        'terms_link'            => 'Terms and conditions',
    ];

    /**
     * @description Returns the `Content::with()` array of texts for the language. Priority:
     * (1) the text filled in for `$lang`, (2) the text for 'cz', (3) the built-in default.
     * @param string|null $lang Language of the order - null / empty behaves like 'cz'.
     * @return array{subject: string, title: string, intro: string, outro: string, htmlLang: string,
     *   labels: array<string, string>}
     */
    public static function forLang(?string $lang): array
    {
        $lang = $lang ?: 'cz';
        $settings = ShopSiteSetting::first();
        $labels = $settings?->order_email_labels_i18n ?? [];

        $texts = [
            'subject'  => self::resolve($settings?->order_email_subject_i18n ?? [], $lang, self::DEFAULTS['subject']),
            'title'    => self::resolve($settings?->order_email_title_i18n ?? [], $lang, self::DEFAULTS['title']),
            'intro'    => self::resolve($settings?->order_email_intro_i18n ?? [], $lang, self::DEFAULTS['intro']),
            'outro'    => self::resolve($settings?->order_email_outro_i18n ?? [], $lang, self::DEFAULTS['outro']),
            'htmlLang' => self::htmlLang($lang),
            'labels'   => [],
        ];
        foreach (array_keys(self::DEFAULTS) as $key) {
            if (!in_array($key, ['subject', 'title', 'intro', 'outro'], true)) {
                $texts['labels'][$key] = self::resolveLabel($labels[$lang] ?? [], $labels['cz'] ?? [], $key, self::DEFAULTS[$key]);
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
