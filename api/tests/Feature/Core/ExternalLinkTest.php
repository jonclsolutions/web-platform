<?php

/**
 * @file ExternalLinkTest.php
 * @path api/tests/Feature/Core/ExternalLinkTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the personal external links (CoreExternalLinkController):
 *   every action is scoped to the links of the signed-in account.
 * @dependencies
 * - Tests\TestCase (SQLite in-memory schema, account helpers).
 */

namespace Tests\Feature\Core;

use App\Models\Core\CoreExternalLink;
use App\Models\User;
use App\Models\Web\WebLog;
use Tests\TestCase;

/**
 * @description /api/core/external_links.
 */
class ExternalLinkTest extends TestCase
{
    /** @var string[] All external link permissions. */
    private const ALL = ['core-external-links-view', 'core-external-links-create', 'core-external-links-update', 'core-external-links-delete'];

    /**
     * @description Creates a link of the given owner.
     * @param User $owner Link owner.
     * @param array<string, mixed> $attributes Column overrides.
     * @return CoreExternalLink
     */
    private function link(User $owner, array $attributes = []): CoreExternalLink
    {
        return CoreExternalLink::create(array_merge(['user_id' => $owner->id, 'name' => 'Docs', 'url' => 'https://docs.example.com'], $attributes));
    }

    /**
     * @description The list shows only the own links, sorted by name, with filters and search.
     * @input Own links 'Beta' (b.example.com) and 'Alpha' (a.example.com), a foreign link; several queries.
     * @output Default: [Alpha, Beta]; name=Bet, url=a.example, search=b.example narrow to one; foreign never listed.
     */
    public function test_index_shows_own_links_only(): void
    {
        $me = $this->signIn($this->userWith(self::ALL));
        $this->link($me, ['name' => 'Beta', 'url' => 'https://b.example.com']);
        $this->link($me, ['name' => 'Alpha', 'url' => 'https://a.example.com']);
        $this->link($this->user(), ['name' => 'Foreign']);

        $this->getJson('/api/core/external_links')->assertOk()
            ->assertJson(['meta' => ['total' => 2, 'current_page' => 1, 'last_page' => 1]])
            ->assertJsonPath('data.*.name', ['Alpha', 'Beta']);
        $this->getJson('/api/core/external_links?name=Bet')->assertJsonPath('data.*.name', ['Beta']);
        $this->getJson('/api/core/external_links?url=a.example')->assertJsonPath('data.*.name', ['Alpha']);
        $this->getJson('/api/core/external_links?search=b.example')->assertJsonPath('data.*.name', ['Beta']);
        $this->getJson('/api/core/external_links?no_pagination=1&sort_direction=desc')->assertJsonPath('data.*.name', ['Beta', 'Alpha']);
    }

    /**
     * @description The trash view lists the own trashed links only.
     * @input Own trashed link, own active link; GET ?only_trashed=1.
     * @output Only the trashed link.
     */
    public function test_index_trash(): void
    {
        $me = $this->signIn($this->userWith(self::ALL));
        $this->link($me, ['name' => 'Gone'])->delete();
        $this->link($me, ['name' => 'Here']);

        $this->getJson('/api/core/external_links?only_trashed=1')->assertJsonPath('data.*.name', ['Gone']);
    }

    /**
     * @description Detail of an own (also trashed) link; a foreign link is 404.
     * @input GET own trashed link, GET foreign link.
     * @output 200; 404.
     */
    public function test_show(): void
    {
        $me = $this->signIn($this->userWith(self::ALL));
        $own = $this->link($me);
        $own->delete();
        $foreign = $this->link($this->user());

        $this->getJson("/api/core/external_links/{$own->id}")->assertOk()->assertJsonPath('data.name', 'Docs');
        $this->getJson("/api/core/external_links/{$foreign->id}")->assertStatus(404);
    }

    /**
     * @description Creating validates the URL and stores the link for the signed-in account.
     * @input POST {name, url:'not-a-url'}; POST valid.
     * @output 422; 201 owned by the caller; web log 'create'.
     */
    public function test_store(): void
    {
        $me = $this->signIn($this->userWith(self::ALL));

        $this->postJson('/api/core/external_links', ['name' => 'X', 'url' => 'not-a-url'])->assertStatus(422);
        $this->postJson('/api/core/external_links', ['name' => 'Analytics', 'url' => 'https://analytics.example.com'])
            ->assertCreated()->assertJsonPath('data.name', 'Analytics');

        $this->assertSame($me->id, CoreExternalLink::sole()->user_id);
        $this->assertTrue(WebLog::where('event_type', 'create')->where('description', 'like', '%Analytics%')->exists());
    }

    /**
     * @description Own links can be updated, foreign ones not.
     * @input PUT own link, PUT foreign link.
     * @output 200 with new name + web log; 404.
     */
    public function test_update(): void
    {
        $me = $this->signIn($this->userWith(self::ALL));
        $own = $this->link($me);
        $foreign = $this->link($this->user());

        $this->putJson("/api/core/external_links/{$own->id}", ['name' => 'Renamed', 'url' => 'https://r.example.com'])
            ->assertOk()->assertJsonPath('data.name', 'Renamed');
        $this->assertTrue(WebLog::where('event_type', 'update')->exists());
        $this->putJson("/api/core/external_links/{$foreign->id}", ['name' => 'Hack', 'url' => 'https://h.example.com'])->assertStatus(404);
    }

    /**
     * @description Delete moves an own link to the trash; restore brings it back; foreign = 404.
     * @input DELETE own, DELETE foreign, POST restore own.
     * @output 204; 404; 200 (link active again); web logs soft_delete, restore.
     */
    public function test_destroy_and_restore(): void
    {
        $me = $this->signIn($this->userWith(self::ALL));
        $own = $this->link($me);
        $foreign = $this->link($this->user());

        $this->deleteJson("/api/core/external_links/{$own->id}")->assertNoContent();
        $this->assertSoftDeleted($own);
        $this->deleteJson("/api/core/external_links/{$foreign->id}")->assertStatus(404);

        $this->postJson("/api/core/external_links/{$own->id}/restore")->assertOk();
        $this->assertFalse($own->fresh()->trashed());
        $this->assertTrue(WebLog::where('event_type', 'restore')->exists());
    }

    /**
     * @description Bulk delete touches only own links (foreign ids are skipped), soft or permanent.
     * @input Own links A, B; foreign link F; POST bulk-delete {ids:[A,F,A]}; then {ids:[B], force_delete:true}.
     * @output {deleted 1, skipped 1, requested 2} (A trashed, F untouched); then B gone; logs.
     */
    public function test_bulk_destroy(): void
    {
        $me = $this->signIn($this->userWith(self::ALL));
        $a = $this->link($me);
        $b = $this->link($me);
        $foreign = $this->link($this->user());

        $this->postJson('/api/core/external_links/bulk-delete', ['ids' => [$a->id, $foreign->id, $a->id]])
            ->assertOk()->assertJson(['data' => ['deleted_count' => 1, 'skipped_count' => 1, 'requested' => 2]]);
        $this->assertSoftDeleted($a);
        $this->assertFalse($foreign->fresh()->trashed());
        $this->assertTrue(WebLog::where('event_type', 'soft_delete_bulk')->exists());

        $this->postJson('/api/core/external_links/bulk-delete', ['ids' => [$b->id], 'force_delete' => true])
            ->assertOk()->assertJsonPath('data.deleted_count', 1);
        $this->assertNull(CoreExternalLink::withTrashed()->find($b->id));
        $this->assertTrue(WebLog::where('event_type', 'hard_delete_bulk')->exists());

        $this->postJson('/api/core/external_links/bulk-delete', ['ids' => []])->assertStatus(422);
    }

    /**
     * @description The log of a large bulk delete lists at most 50 ids.
     * @input 51 non-existing ids.
     * @output 200 {deleted 0, skipped 51}; log description ends the id list with "...".
     */
    public function test_bulk_destroy_truncates_logged_ids(): void
    {
        $this->signIn($this->userWith(self::ALL));

        $this->postJson('/api/core/external_links/bulk-delete', ['ids' => range(1001, 1051)])
            ->assertOk()->assertJsonPath('data.skipped_count', 51);

        $this->assertStringContainsString('1050...', WebLog::where('event_type', 'soft_delete_bulk')->sole()->description);
    }

    /**
     * @description A database error during bulk delete answers 500.
     * @input Own link, core_external_links UPDATE fails, POST bulk-delete.
     * @output 500 "Bulk deletion failed."; web log 'error'.
     */
    public function test_bulk_destroy_database_error(): void
    {
        $me = $this->signIn($this->userWith(self::ALL));
        $link = $this->link($me);
        $this->failOn('core_external_links', 'UPDATE');

        $this->postJson('/api/core/external_links/bulk-delete', ['ids' => [$link->id]])
            ->assertStatus(500)->assertJson(['message' => 'Bulk deletion failed.']);
        $this->assertTrue(WebLog::where('event_type', 'error')->exists());
    }

    /**
     * @description Emptying the trash deletes only the own trashed links.
     * @input Own trashed link, foreign trashed link, DELETE force-delete-all.
     * @output 204; own gone, foreign still in the trash.
     */
    public function test_force_delete_all_trashed(): void
    {
        $me = $this->signIn($this->userWith(self::ALL));
        $own = $this->link($me);
        $own->delete();
        $foreign = $this->link($this->user());
        $foreign->delete();

        $this->deleteJson('/api/core/external_links/force-delete-all')->assertNoContent();

        $this->assertNull(CoreExternalLink::withTrashed()->find($own->id));
        $this->assertNotNull(CoreExternalLink::withTrashed()->find($foreign->id));
    }
}
