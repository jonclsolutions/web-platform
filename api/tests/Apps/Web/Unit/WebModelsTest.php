<?php

/**
 * @file WebModelsTest.php
 * @path api/tests/Apps/Web/Unit/WebModelsTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the web models: relations not reached through the API.
 * @dependencies
 * - Tests\TestCase, Tests\Apps\Web\Support\WebFixtures.
 */

namespace Tests\Apps\Web\Unit;

use Illuminate\Support\Facades\Storage;
use Tests\Apps\Web\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description App\Apps\Web\Models\*.
 */
class WebModelsTest extends TestCase
{
    use WebFixtures;

    /**
     * @description Relations resolve to the owning / owned records.
     * @input Lead of user U with an order; an attachment of the order.
     * @output lead → user / orders, attachment → its owner (morph).
     */
    public function test_relations(): void
    {
        Storage::fake('private');
        $owner = $this->user();
        $lead = $this->lead(['user_id' => $owner->id]);
        $order = $this->salesOrder(['lead_id' => $lead->id]);

        $this->assertTrue($lead->user->is($owner));
        $this->assertTrue($lead->orders->sole()->is($order));
        $this->assertTrue($this->attach($order)->attachable->is($order));
    }
}
