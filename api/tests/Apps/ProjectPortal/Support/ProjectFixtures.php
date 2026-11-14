<?php

/**
 * @file ProjectFixtures.php
 * @path api/tests/Apps/ProjectPortal/Support/ProjectFixtures.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Test helpers of the project portal: creates sales leads, orders, projects with
 *   client accounts, portal sessions and threads with messages, and asserts on the portal audit log; the shared
 *   helpers (files, captcha, broken mailer) come from CommonFixtures.
 * @dependencies
 * - App\Apps\ProjectPortal\Models\*; Tests\Support\CommonFixtures.
 */

namespace Tests\Apps\ProjectPortal\Support;

use App\Apps\ProjectPortal\Models\Project;
use App\Apps\ProjectPortal\Models\ProjectAccount;
use App\Apps\ProjectPortal\Models\ProjectPortalLog;
use App\Apps\ProjectPortal\Models\ProjectSession;
use App\Apps\ProjectPortal\Models\ProjectThread;
use App\Apps\ProjectPortal\Models\SalesLead;
use App\Apps\ProjectPortal\Models\SalesOrder;
use Tests\Support\CommonFixtures;

/**
 * @description Used by the tests in tests/Apps/ProjectPortal (and by core tests that need a project).
 */
trait ProjectFixtures
{
    use CommonFixtures;

    /**
     * @description Creates a sales lead.
     * @param array<string, mixed> $attributes Column overrides (public_token is set directly).
     * @return SalesLead
     */
    protected function lead(array $attributes = []): SalesLead
    {
        $lead = new SalesLead(array_merge([
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
     * @return SalesOrder
     */
    protected function salesOrder(array $attributes = []): SalesOrder
    {
        return SalesOrder::create(array_merge([
            'client_name' => 'Acme s.r.o.', 'client_email' => 'jan@acme.cz', 'order_description' => 'E-shop',
            'salesman_name' => 'Petr', 'data_processing_agreement' => true, 'tos_agreement' => true,
        ], $attributes));
    }

    /** @var string Plain password of every project created by project(). */
    protected string $projectPassword = 'Portal1234';

    /**
     * @description Creates a customer project with an access token and one client account
     *   "klient" (display name "Klient") with the password $projectPassword.
     * @param array<string, mixed> $attributes Column overrides.
     * @return Project
     */
    protected function project(array $attributes = []): Project
    {
        $project = new Project(array_merge(['name' => 'Client portal', 'visibility' => 'public', 'contact_email' => 'pm@example.com'], $attributes));
        $project->status = $attributes['status'] ?? 'new';
        $project->access_token = $attributes['access_token'] ?? Project::generateAccessToken();
        $project->save();
        $this->portalAccount($project, 'klient', 'Klient');

        return $project;
    }

    /**
     * @description Adds a client account to the project (password $projectPassword).
     * @param Project $project Owner project.
     * @param string $username Login name.
     * @param string $displayName Display name.
     * @param array<string, mixed> $attributes Other columns (email, notify_*, language).
     * @return ProjectAccount
     */
    protected function portalAccount(Project $project, string $username, string $displayName, array $attributes = []): ProjectAccount
    {
        $account = new ProjectAccount(array_merge(['project_id' => $project->id, 'username' => $username, 'display_name' => $displayName], $attributes));
        $account->setPassword($this->projectPassword);
        $account->save();

        return $account;
    }

    /**
     * @description Opens a portal session (of the given account, else the project's first account)
     *   and returns the raw session token.
     * @param Project $project Project to sign in to.
     * @param ProjectAccount|null $account Signed-in account.
     * @return string Raw session token (Bearer).
     */
    protected function portalSession(Project $project, ?ProjectAccount $account = null): string
    {
        return ProjectSession::issueFor($account ?? $project->accounts()->firstOrFail(), '127.0.0.1', 'UA');
    }

    /**
     * @description Creates a thread of the project, optionally with messages (the last one decides
     *   whose turn it is).
     * @param Project $project Owner project.
     * @param array<string, mixed> $attributes Column overrides.
     * @param array<int, array{0: string, 1: string}> $messages [author_type, body] pairs.
     * @return ProjectThread
     */
    protected function thread(Project $project, array $attributes = [], array $messages = []): ProjectThread
    {
        $thread = $project->threads()->create(array_merge([
            'subject' => 'Logo colours', 'priority' => 'medium', 'status' => 'active', 'opened_by' => 'customer', 'last_message_at' => now(),
        ], $attributes));
        foreach ($messages as [$author, $body]) {
            $thread->messages()->create(['author_type' => $author, 'author_label' => $author === 'admin' ? 'admin@example.com' : null, 'body' => $body]);
        }
        // Whose turn it is follows the last message, unless the test sets it.
        if ($messages !== [] && !array_key_exists('last_public_author', $attributes)) {
            $thread->update(['last_public_author' => end($messages)[0]]);
        }

        return $thread;
    }

    /**
     * @description Whether a project_portal_logs row with the given event type exists.
     * @param string $eventType Event type, e.g. 'create'.
     * @param string|null $descriptionContains Optional fragment of the description.
     * @return void
     */
    protected function assertPortalLog(string $eventType, ?string $descriptionContains = null): void
    {
        $query = ProjectPortalLog::where('event_type', $eventType);
        if ($descriptionContains !== null) {
            $query->where('description', 'like', '%' . $descriptionContains . '%');
        }
        $this->assertTrue($query->exists(), "project_portal_logs entry '{$eventType}'" . ($descriptionContains ? " containing '{$descriptionContains}'" : '') . ' not found.');
    }
}
