<?php

/**
 * @file DeliveryCountriesTest.php
 * @path api/tests/Apps/Shop/Unit/DeliveryCountriesTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of App\Apps\Shop\Support\DeliveryCountries: the code of a sent country
 *   (codes in any case, legacy names) and the name of a country in a language.
 * @dependencies Tests\TestCase, PHP intl.
 */

namespace Tests\Apps\Shop\Unit;

use App\Apps\Shop\Support\DeliveryCountries;
use Tests\TestCase;

/**
 * @description DeliveryCountries.
 */
class DeliveryCountriesTest extends TestCase
{
    /**
     * @description Codes in any case, the legacy names of the checkout, unknown values.
     * @input 'sk', ' CZ ', 'Czechia', 'Česká republika', 'US', '', null.
     * @output SK, CZ, CZ, CZ, null, null, null.
     */
    public function test_code(): void
    {
        $this->assertSame(['SK', 'CZ', 'CZ', 'CZ', null, null, null], array_map(
            [DeliveryCountries::class, 'code'], ['sk', ' CZ ', 'Czechia', 'Česká republika', 'US', '', null]
        ));
    }

    /**
     * @description Names in the language of the order (cz = Czech); a legacy text unchanged.
     * @input SK in cz / en / de; 'Czechia'; ''.
     * @output Slovensko, Slovakia, Slowakei; Czechia; ''.
     */
    public function test_name(): void
    {
        $this->assertSame(['Slovensko', 'Slovakia', 'Slowakei'], [
            DeliveryCountries::name('SK', 'cz'), DeliveryCountries::name('SK', 'en'), DeliveryCountries::name('SK', 'de'),
        ]);
        $this->assertSame(['Czechia', ''], [DeliveryCountries::name('Czechia', 'en'), DeliveryCountries::name('', 'cz')]);
    }
}
