<?php

/**
 * @file WebFixtures.php
 * @path api/tests/Apps/Web/Support/WebFixtures.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Test helpers of the web application: creates the web records (requests, leads,
 *   orders, job applications) and asserts on the web audit log; the shared helpers (files,
 *   captcha, broken mailer) come from CommonFixtures.
 * @dependencies
 * - App\Apps\Web\Models\*; Tests\Support\CommonFixtures.
 */

namespace Tests\Apps\Web\Support;

use App\Apps\Web\Models\WebJobApplication;
use App\Apps\Web\Models\WebLog;
use App\Apps\Web\Models\WebRawRequestCommission;
use App\Apps\Web\Models\WebSalesLead;
use App\Apps\Web\Models\WebSalesOrder;
use Tests\Support\CommonFixtures;

/**
 * @description Used by the tests in tests/Apps/Web (and by tests of other applications that
 *   need web records, e.g. a project from a web order).
 */
trait WebFixtures
{
    use CommonFixtures;

    /**
     * @description Creates a commission request (public contact form record).
     * @param array<string, mixed> $attributes Column overrides.
     * @return WebRawRequestCommission
     */
    protected function rawRequest(array $attributes = []): WebRawRequestCommission
    {
        return WebRawRequestCommission::create(array_merge([
            'thema' => 'Website redesign', 'contact_email' => 'client@example.com', 'contact_phone' => '+420 777 123 456',
            'order_description' => 'We need a new website.', 'status' => 'new', 'priority' => 'neutral', 'lang' => 'cz',
        ], $attributes));
    }

    /**
     * @description Creates a sales lead.
     * @param array<string, mixed> $attributes Column overrides (public_token is set directly).
     * @return WebSalesLead
     */
    protected function lead(array $attributes = []): WebSalesLead
    {
        $lead = new WebSalesLead(array_merge([
            'salesman_name' => 'Petr Obchodnik', 'subject_name' => 'Acme s.r.o.', 'contact_person' => 'Jan Acme',
            'contact_email' => 'jan@acme.cz', 'contact_phone' => '777123456', 'source_channel' => 'web_form',
            'priority' => 'neutral', 'status' => 'new',
        ], $attributes));
        foreach (['public_token', 'public_token_used_at', 'public_token_expires_at'] as $column) {
            if (array_key_exists($column, $attributes)) {
                $lead->{$column} = $attributes[$column];
            }
        }
        $lead->save();

        return $lead;
    }

    /**
     * @description Creates a sales order (order form record).
     * @param array<string, mixed> $attributes Column overrides.
     * @return WebSalesOrder
     */
    protected function salesOrder(array $attributes = []): WebSalesOrder
    {
        return WebSalesOrder::create(array_merge([
            'client_name' => 'Acme s.r.o.', 'client_email' => 'jan@acme.cz', 'order_description' => 'E-shop',
            'salesman_name' => 'Petr', 'data_processing_agreement' => true, 'tos_agreement' => true,
        ], $attributes));
    }

    /**
     * @description Creates a job application.
     * @param array<string, mixed> $attributes Column overrides.
     * @return WebJobApplication
     */
    protected function jobApplication(array $attributes = []): WebJobApplication
    {
        return WebJobApplication::create(array_merge([
            'first_name' => 'Eva', 'last_name' => 'Kralova', 'email' => 'eva@example.com',
            'position_name' => 'Developer', 'state' => 'new',
        ], $attributes));
    }

    /**
     * @description Whether a web_logs row with the given event type exists.
     * @param string $eventType Event type, e.g. 'create'.
     * @param string|null $descriptionContains Optional fragment of the description.
     * @return void
     */
    protected function assertWebLog(string $eventType, ?string $descriptionContains = null): void
    {
        $query = WebLog::where('event_type', $eventType);
        if ($descriptionContains !== null) {
            $query->where('description', 'like', '%' . $descriptionContains . '%');
        }
        $this->assertTrue($query->exists(), "web_logs entry '{$eventType}'" . ($descriptionContains ? " containing '{$descriptionContains}'" : '') . ' not found.');
    }
}
