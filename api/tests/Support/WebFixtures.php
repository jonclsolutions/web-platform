<?php

/**
 * @file WebFixtures.php
 * @path api/tests/Support/WebFixtures.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Test helpers of the Web section: creates the web records (requests, tickets,
 *   news, leads, orders, job applications, projects with sessions / threads / messages),
 *   upload files, import files, a broken mailer, and asserts on the web audit log.
 * @dependencies
 * - App\Models\Web\*; Illuminate\Http\UploadedFile (fake files).
 */

namespace Tests\Support;

use App\Models\Web\WebAttachment;
use App\Models\Web\WebJobApplication;
use App\Models\Web\WebLog;
use App\Models\Web\WebNews;
use App\Models\Web\WebProject;
use App\Models\Web\WebProjectSession;
use App\Models\Web\WebProjectThread;
use App\Models\Web\WebRawRequestCommission;
use App\Models\Web\WebSalesLead;
use App\Models\Web\WebSalesOrder;
use App\Models\Web\WebSupportTicket;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

/**
 * @description Used by the tests in tests/Feature/Web and tests/Unit/Web.
 */
trait WebFixtures
{
    /** @var string Plain password of every project created by project(). */
    protected string $projectPassword = 'Portal1234';

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
     * @description Creates a support ticket.
     * @param array<string, mixed> $attributes Column overrides.
     * @return WebSupportTicket
     */
    protected function ticket(array $attributes = []): WebSupportTicket
    {
        return WebSupportTicket::create(array_merge([
            'user_name_plain' => 'Jana Nova', 'user_plain' => 'jana@example.com', 'category' => 'it',
            'priority' => 'medium', 'subject' => 'Printer', 'description' => 'It does not print.',
        ], $attributes));
    }

    /**
     * @description Creates a news item.
     * @param array<string, mixed> $attributes Column overrides.
     * @return WebNews
     */
    protected function news(array $attributes = []): WebNews
    {
        return WebNews::create(array_merge([
            'title' => 'Release 2.0', 'message' => 'A new version is out.', 'author' => 'Team', 'thema' => 'update',
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
        foreach (['public_token', 'public_token_used_at'] as $column) {
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
     * @description Creates a customer project with an access token and the password
     *   $projectPassword.
     * @param array<string, mixed> $attributes Column overrides.
     * @return WebProject
     */
    protected function project(array $attributes = []): WebProject
    {
        $project = new WebProject(array_merge(['name' => 'Client portal', 'visibility' => 'public', 'contact_email' => 'pm@example.com'], $attributes));
        $project->status = $attributes['status'] ?? 'new';
        $project->access_token = $attributes['access_token'] ?? WebProject::generateAccessToken();
        $project->access_password_hash = Hash::make($this->projectPassword);
        $project->save();

        return $project;
    }

    /**
     * @description Opens a portal session for the project and returns the raw session token.
     * @param WebProject $project Project to sign in to.
     * @return string Raw session token (Bearer).
     */
    protected function portalSession(WebProject $project): string
    {
        return WebProjectSession::issueFor($project, '127.0.0.1', 'UA');
    }

    /**
     * @description Creates a thread of the project, optionally with messages.
     * @param WebProject $project Owner project.
     * @param array<string, mixed> $attributes Column overrides.
     * @param array<int, array{0: string, 1: string}> $messages [author_type, body] pairs.
     * @return WebProjectThread
     */
    protected function thread(WebProject $project, array $attributes = [], array $messages = []): WebProjectThread
    {
        $thread = $project->threads()->create(array_merge([
            'subject' => 'Logo colours', 'priority' => 'medium', 'status' => 'active', 'opened_by' => 'customer', 'last_message_at' => now(),
        ], $attributes));
        foreach ($messages as [$author, $body]) {
            $thread->messages()->create(['author_type' => $author, 'author_label' => $author === 'admin' ? 'admin@example.com' : null, 'body' => $body]);
        }

        return $thread;
    }

    /**
     * @description Adds a stored attachment row (+ file on the given disk) to a model.
     * @param Model $model Model with an attachments() relation.
     * @param string $path Path on the disk.
     * @param string $disk Disk name.
     * @return WebAttachment
     */
    protected function attach(Model $model, string $path = 'web/x/file.pdf', string $disk = 'private'): WebAttachment
    {
        Storage::disk($disk)->put($path, 'content');

        return $model->attachments()->create([
            'disk' => $disk, 'path' => $path, 'original_filename' => basename($path), 'mime_type' => 'application/pdf', 'size_bytes' => 7,
        ]);
    }

    /**
     * @description A fake uploaded file.
     * @param string $name File name (the extension matters for the validation).
     * @param int $kilobytes Size in KB.
     * @param string|null $mime Reported MIME type.
     * @return UploadedFile
     */
    protected function upload(string $name = 'brief.pdf', int $kilobytes = 10, ?string $mime = 'application/pdf'): UploadedFile
    {
        return UploadedFile::fake()->create($name, $kilobytes, $mime);
    }

    /**
     * @description A fake import file with the given content.
     * @param string $format 'csv', 'txt' or 'json'.
     * @param string $content File content.
     * @return UploadedFile
     */
    protected function importFile(string $format, string $content): UploadedFile
    {
        return UploadedFile::fake()->createWithContent("import.{$format}", $content);
    }

    /**
     * @description Makes every mail send fail (unknown transport) - with the sync queue of the
     *   tests a queued mail fails at queue() time as well.
     * @return void
     */
    protected function breakMailer(): void
    {
        config(['mail.default' => 'broken', 'mail.mailers.broken' => ['transport' => 'does-not-exist']]);
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
