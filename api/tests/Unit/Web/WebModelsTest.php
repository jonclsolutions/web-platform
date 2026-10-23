<?php

/**
 * @file WebModelsTest.php
 * @path api/tests/Unit/Web/WebModelsTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Unit tests of the web models: relations not reached through the API, the
 *   checkpoint status setter, the attachment storage URL and the project session lookup.
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures.
 */

namespace Tests\Unit\Web;

use App\Models\Web\WebAttachment;
use App\Models\Web\WebProjectCheckpoint;
use App\Models\Web\WebProjectSession;
use Illuminate\Support\Facades\Storage;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description App\Models\Web\*.
 */
class WebModelsTest extends TestCase
{
    use WebFixtures;

    /**
     * @description Relations resolve to the owning / owned records.
     * @input Project with checkpoint, session and thread with a message; lead of user U with an
     *        order; ticket of user U.
     * @output checkpoint/session → project, message → thread, project → sessions, lead → user /
     *   orders, ticket → user, attachment → its owner (morph).
     */
    public function test_relations(): void
    {
        Storage::fake('private');
        $owner = $this->user();
        $project = $this->project();
        $checkpoint = $project->checkpoints()->create(['label' => 'A']);
        $this->portalSession($project);
        $message = $this->thread($project, [], [['customer', 'Hi']])->messages()->sole();
        $lead = $this->lead(['user_id' => $owner->id]);
        $order = $this->salesOrder(['lead_id' => $lead->id]);
        $ticket = $this->ticket(['user_id' => $owner->id]);

        $this->assertTrue($checkpoint->project->is($project));
        $this->assertTrue(WebProjectSession::sole()->project->is($project));
        $this->assertSame(1, $project->sessions()->count());
        $this->assertSame('Logo colours', $message->thread->subject);
        $this->assertTrue($lead->user->is($owner));
        $this->assertTrue($lead->orders->sole()->is($order));
        $this->assertTrue($ticket->user->is($owner));
        $this->assertTrue($this->attach($message)->attachable->is($message));
    }

    /**
     * @description The checkpoint status setter stamps the change time and refuses unknown states.
     * @input setStatus('done'); setStatus('bogus').
     * @output status 'done', status_changed_at set, saved; InvalidArgumentException, status kept.
     */
    public function test_checkpoint_set_status(): void
    {
        $checkpoint = $this->project()->checkpoints()->create(['label' => 'A']);

        $checkpoint->setStatus('done');
        $this->assertSame('done', WebProjectCheckpoint::find($checkpoint->id)->status);
        $this->assertNotNull($checkpoint->fresh()->status_changed_at);

        try {
            $checkpoint->setStatus('bogus');
            $this->fail('An unknown status must be refused.');
        } catch (\InvalidArgumentException $e) {
            $this->assertStringContainsString('bogus', $e->getMessage());
        }
        $this->assertSame('done', $checkpoint->fresh()->status);
    }

    /**
     * @description The legacy `url` attribute points into public storage (kept for backward
     *   compatibility; private files are served through the signed download routes only).
     * @input Attachment with path web/x/a.pdf; root URL https://api.example.com.
     * @output Host api.example.com, path /storage/web/x/a.pdf.
     */
    public function test_attachment_url(): void
    {
        $this->app['url']->forceRootUrl('https://api.example.com');

        $attachment = new WebAttachment(['disk' => 'private', 'path' => 'web/x/a.pdf', 'original_filename' => 'a.pdf']);

        $this->assertSame('/storage/web/x/a.pdf', parse_url($attachment->url, PHP_URL_PATH));
        $this->assertSame('api.example.com', parse_url($attachment->url, PHP_URL_HOST));
    }

    /**
     * @description A session is found by its raw token only while unexpired; the stored value
     *   is a SHA-256 hash, never the raw token.
     * @input issueFor(); lookup now, lookup after 25 h; lookup of an unknown token.
     * @output Found, hash ≠ raw token; null after expiry; null.
     */
    public function test_session_lookup(): void
    {
        $raw = $this->portalSession($this->project());

        $session = WebProjectSession::findValidByPlaintextToken($raw);
        $this->assertNotNull($session);
        $this->assertSame(hash('sha256', $raw), $session->session_token_hash);
        $this->assertNull(WebProjectSession::findValidByPlaintextToken('unknown'));

        $this->travel(25)->hours();
        $this->assertNull(WebProjectSession::findValidByPlaintextToken($raw));
    }
}
