<?php

/**
 * @file CompanyIds.php
 * @path app/Apps/Shop/Support/CompanyIds.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Company identification number (IČO) and VAT ID (DIČ) of a buyer who orders on a
 * company (audit U-03): the shared validation rules of the checkout and of the admin forms of
 * orders and customers, and their normalisation (spaces removed, upper case) before validation.
 * @note The rules are general (EU): IČO 2-20 letters / digits (a Czech / Slovak IČO has 8
 * digits), DIČ = 2-letter country prefix + 2-12 letters / digits (CZ12345678, SK1234567890,
 * DE123456789). Both are personal data of a sole trader - masked in the audit log (AUDIT_MASKED).
 * @dependencies none
 */

namespace App\Apps\Shop\Support;

use Illuminate\Http\Request;

final class CompanyIds
{
    /** @description Validation of the IČO (after normalize()). */
    public const ICO_RULE = ['nullable', 'string', 'max:20', 'regex:/^[A-Z0-9]{2,20}$/'];

    /** @description Validation of the DIČ (after normalize()). */
    public const DIC_RULE = ['nullable', 'string', 'max:20', 'regex:/^[A-Z]{2}[A-Z0-9]{2,12}$/'];

    /** @description English messages of the rules (translated in the frontend). */
    public const MESSAGES = [
        'ico.regex' => 'Enter a valid company ID (letters and digits only).',
        'dic.regex' => 'Enter a valid VAT ID with the country prefix (e.g. CZ12345678).',
    ];

    /**
     * @description Normalises `ico` and `dic` of the request in place: spaces removed, upper case;
     *   an empty value becomes null.
     * @param Request $request Request with the optional fields `ico` / `dic`.
     * @return void
     */
    public static function normalize(Request $request): void
    {
        $values = [];
        foreach (['ico', 'dic'] as $field) {
            if ($request->has($field)) {
                $value = strtoupper((string) preg_replace('/\s+/', '', (string) $request->input($field)));
                $values[$field] = $value === '' ? null : $value;
            }
        }
        if ($values !== []) {
            $request->merge($values);
        }
    }
}
