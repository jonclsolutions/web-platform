<?php

/**
 * @file PartialUpdateRulesTest.php
 * @path api/tests/Unit/Core/PartialUpdateRulesTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit test of PartialUpdateRules: the rules of a create request become optional
 *   (`sometimes`) for a partial update, in string and array form, without doubling it.
 * @dependencies Tests\TestCase; App\Http\Requests\Concerns\PartialUpdateRules.
 */

namespace Tests\Unit\Core;

use App\Http\Requests\Concerns\PartialUpdateRules;
use Illuminate\Validation\Rule;
use Tests\TestCase;

/**
 * @description PartialUpdateRules::partial().
 */
class PartialUpdateRulesTest extends TestCase
{
    use PartialUpdateRules;

    /**
     * @description Every field gets `sometimes` first; a rule object is kept; a field that has it
     *   already is unchanged.
     * @input ['name' => 'required|string', 'tags' => ['nullable', Rule::in(['a'])], 'x' => ['sometimes', 'integer'], 'y' => 'sometimes|date']
     * @output 'sometimes|required|string'; ['sometimes', 'nullable', Rule]; x / y unchanged.
     */
    public function test_partial_rules(): void
    {
        $in = Rule::in(['a']);
        $this->assertSame([
            'name' => 'sometimes|required|string',
            'tags' => ['sometimes', 'nullable', $in],
            'x'    => ['sometimes', 'integer'],
            'y'    => 'sometimes|date',
        ], self::partial(['name' => 'required|string', 'tags' => ['nullable', $in], 'x' => ['sometimes', 'integer'], 'y' => 'sometimes|date']));
    }
}
