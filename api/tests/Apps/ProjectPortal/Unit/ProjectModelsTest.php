<?php

/**
 * @file ProjectModelsTest.php
 * @path api/tests/Apps/ProjectPortal/Unit/ProjectModelsTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Unit tests of the project portal models: relations not reached through the API,
 *   the checkpoint status setter and the portal session lookup.
 * @dependencies
 * - Tests\TestCase, Tests\Apps\ProjectPortal\Support\ProjectFixtures.
 */

namespace Tests\Apps\ProjectPortal\Unit;

use App\Apps\ProjectPortal\Models\ProjectCheckpoint;
use App\Apps\ProjectPortal\Models\ProjectSession;
use Illuminate\Support\Facades\Storage;
use Tests\Apps\ProjectPortal\Support\ProjectFixtures;
use Tests\TestCase;

/**
 * @description App\Apps\ProjectPortal\Models\*.
 */
class ProjectModelsTest extends TestCase
{
    use ProjectFixtures;

    /**
     * @description Relations resolve to the owning / owned records.
     * @input Project with checkpoint, session and thread with a message; an attachment of the message.
     * @output checkpoint/session → project, message → thread, project → sessions, attachment → its
     *   owner (morph).
     */
    public function test_relations(): void
    {
        Storage::fake('private');
        $project = $this->project();
        $checkpoint = $project->checkpoints()->create(['label' => 'A']);
        $this->portalSession($project);
        $message = $this->thread($project, [], [['customer', 'Hi']])->messages()->sole();

        $this->assertTrue($checkpoint->project->is($project));
        $this->assertTrue(ProjectSession::sole()->project->is($project));
        $this->assertSame(1, $project->sessions()->count());
        $this->assertSame('Logo colours', $message->thread->subject);
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
        $this->assertSame('done', ProjectCheckpoint::find($checkpoint->id)->status);
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
     * @description A session is found by its raw token only while unexpired; the stored value
     *   is a SHA-256 hash, never the raw token.
     * @input issueFor(); lookup now, lookup after 25 h; lookup of an unknown token.
     * @output Found, hash ≠ raw token; null after expiry; null.
     */
    public function test_session_lookup(): void
    {
        $raw = $this->portalSession($this->project());

        $session = ProjectSession::findValidByPlaintextToken($raw);
        $this->assertNotNull($session);
        $this->assertSame(hash('sha256', $raw), $session->session_token_hash);
        $this->assertNull(ProjectSession::findValidByPlaintextToken('unknown'));

        $this->travel(25)->hours();
        $this->assertNull(ProjectSession::findValidByPlaintextToken($raw));
    }
}
