<?php

/**
 * @file EffectiveFieldsTest.php
 * @path api/tests/Apps/JsCreator/Unit/EffectiveFieldsTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the fields of a template with its block instances (EffectiveFields):
 *   template fields first, then the fields of every instance; a taken key gets `_2`, `_3` …
 *   within 40 characters; a missing block is skipped. The frontend has the same rules
 *   (block-fields.ts) - the expected keys are the same in its spec.
 * @dependencies EffectiveFields, JsCreatorFixtures (documents).
 */

namespace Tests\Apps\JsCreator\Unit;

use App\Apps\JsCreator\Support\EffectiveFields;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;

/**
 * @description EffectiveFields::types() and freeKey().
 */
class EffectiveFieldsTest extends TestCase
{
    use JsCreatorFixtures;

    /**
     * @description Fields of a template with two instances of a price-tag block and one missing block.
     * @input template fields title (text), price (image); block 4 with price (text) + logo (image);
     *   instances: block 4, block 99 (missing), block 4.
     * @output title, price (template), price_2, logo, price_3, logo_2 with their kinds, in this order.
     */
    public function test_fields_of_instances_get_free_keys(): void
    {
        $template = $this->document([
            $this->layer('block', ['blockId' => 4]),
            $this->layer('text'),
            $this->layer('block', ['blockId' => 99]),
            $this->layer('block', ['blockId' => 4]),
        ], [$this->textField('title'), $this->imageField('price')]);
        $block = $this->document([], [$this->textField('price'), $this->imageField('logo')]);

        $this->assertSame(
            ['title' => 'text', 'price' => 'image', 'price_2' => 'text', 'logo' => 'image', 'price_3' => 'text', 'logo_2' => 'image'],
            EffectiveFields::types($template, [4 => $block])
        );
    }

    /**
     * @description A long key keeps at most 40 characters with its suffix.
     * @input key of 40 characters taken once and twice.
     * @output first 38 characters + `_2`, then + `_3`; a free key stays.
     */
    public function test_free_key_keeps_the_length_limit(): void
    {
        $key = str_repeat('a', 40);
        $this->assertSame(str_repeat('a', 38) . '_2', EffectiveFields::freeKey($key, [$key => true]));
        $this->assertSame(str_repeat('a', 38) . '_3', EffectiveFields::freeKey($key, [$key => true, str_repeat('a', 38) . '_2' => true]));
        $this->assertSame('free', EffectiveFields::freeKey('free', ['other' => true]));
    }
}
