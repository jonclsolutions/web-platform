<?php

/**
 * @file DeliveryCountries.php
 * @path app/Apps/Shop/Support/DeliveryCountries.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Countries the e-shop can deliver to (audit U-02): the codes a shipping method may
 * serve (ticked in the admin per method), the country of an order (ISO 3166-1 alpha-2) and its
 * name in a language (the confirmation e-mail).
 * @note The list: the EU member states and the EEA / neighbouring countries (CH, GB, NO, IS, LI).
 * Must match DELIVERY_COUNTRIES of the frontend (erp/src/app/apps/shop/shared/delivery-countries.ts).
 * Orders from before the countries keep their text ("Czechia") - name() returns such a value
 * unchanged.
 * @dependencies PHP intl (Locale::getDisplayRegion) - installed in the API image.
 */

namespace App\Apps\Shop\Support;

final class DeliveryCountries
{
    /** @description ISO 3166-1 alpha-2 codes a shipping method may deliver to. */
    public const CODES = [
        'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT',
        'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
        'CH', 'GB', 'IS', 'LI', 'NO',
    ];

    /** @description Country names the storefront sent before the codes (cached older pages) - read as the code. */
    private const LEGACY_NAMES = ['czechia' => 'CZ', 'czech republic' => 'CZ', 'česko' => 'CZ', 'česká republika' => 'CZ'];

    /**
     * @description The code of a country as the storefront sends it: a code (any case) or a
     *   legacy name; null when it is neither.
     * @param string|null $value Sent value.
     * @return string|null
     */
    public static function code(?string $value): ?string
    {
        $value = trim((string) $value);
        $upper = strtoupper($value);
        if (in_array($upper, self::CODES, true)) {
            return $upper;
        }

        return self::LEGACY_NAMES[mb_strtolower($value)] ?? null;
    }

    /**
     * @description Name of a country in a language (cz = Czech); a value that is not a code is
     *   returned as it is.
     * @param string|null $code Country code (or a legacy text).
     * @param string $lang Language of the text (e-shop language code).
     * @return string
     */
    public static function name(?string $code, string $lang): string
    {
        $code = (string) $code;
        if (!in_array($code, self::CODES, true) || !class_exists(\Locale::class)) {
            return $code;
        }
        $locale = strtolower($lang) === 'cz' ? 'cs' : strtolower($lang);
        $name = \Locale::getDisplayRegion('und-' . $code, $locale);

        return is_string($name) && $name !== '' && $name !== $code ? $name : $code;
    }
}
