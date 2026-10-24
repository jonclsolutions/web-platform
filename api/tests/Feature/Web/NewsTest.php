<?php

/**
 * @file NewsTest.php
 * @path api/tests/Feature/Web/NewsTest.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Feature tests of the news administration (WebNewsController): list with
 *   filters, create / edit with validation, delete / bulk delete / restore / trash.
 * @dependencies
 * - Tests\TestCase, Tests\Support\WebFixtures.
 */

namespace Tests\Feature\Web;

use App\Models\Web\WebNews;
use Tests\Support\WebFixtures;
use Tests\TestCase;

/**
 * @description /api/web/news.
 */
class NewsTest extends TestCase
{
    use WebFixtures;

    /** @var string[] All news permissions. */
    private const ALL = ['web-news-view', 'web-news-create', 'web-news-update', 'web-news-delete'];

    /**
     * @description List: permission, newest first, search, filters, trash, export.
     * @input A ('Launch', milestone, author Eva, yesterday), B ('Patch', update, author Petr), C trashed.
     * @output Each filter returns the expected item.
     */
    public function test_index(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/web/news')->assertStatus(403);

        $this->signIn($this->userWith(['web-news-view']));
        $a = $this->news(['title' => 'Launch', 'thema' => 'milestone', 'author' => 'Eva']);
        $a->forceFill(['created_at' => now()->subDay()])->save();
        $b = $this->news(['title' => 'Patch', 'thema' => 'update', 'author' => 'Petr', 'message' => 'Fixes']);
        $this->news(['title' => 'Old'])->delete();

        $ids = fn (string $q) => array_column($this->getJson("/api/web/news?{$q}")->json('data'), 'id');
        $this->assertSame([$b->id, $a->id], $ids(''));
        $this->assertSame([$b->id], $ids('search=Fixes'));
        $this->assertSame([$a->id], $ids("id={$a->id}"));
        $this->assertSame([$a->id], $ids('title=aunc'));
        $this->assertSame([$b->id], $ids('thema=update'));
        $this->assertSame([$a->id], $ids('author=Ev'));
        $this->assertSame(['Old'], array_column($this->getJson('/api/web/news?only_trashed=true')->json('data'), 'title'));
        $this->getJson('/api/web/news?per_page=1')->assertJson(['meta' => ['total' => 2, 'last_page' => 2]]);
        $this->assertCount(2, $this->getJson('/api/web/news?no_pagination=1')->json('data'));
    }

    /**
     * @description Create and edit with validation; detail includes trashed; 404s; database errors.
     * @input POST valid / invalid thema; GET; PUT {title}; PUT {title:'ab'}; PUT /999; failures.
     * @output 201; 422 "The selected theme is invalid."; 200; 200; 422; 404; 500 / 500.
     */
    public function test_store_show_update(): void
    {
        $this->signIn($this->userWith(self::ALL));

        $id = $this->postJson('/api/web/news', ['title' => 'Hello', 'message' => 'World', 'author' => 'Me', 'thema' => 'info', 'bullet_1' => 'One'])
            ->assertCreated()->assertJsonPath('data.bullet_1', 'One')->json('data.id');
        $this->assertWebLog('create', 'News item created: Hello');
        $this->postJson('/api/web/news', ['title' => 'Hello', 'message' => 'World', 'author' => 'Me', 'thema' => 'x'])
            ->assertStatus(422)->assertJsonPath('errors.thema.0', 'The selected theme is invalid.');

        $this->getJson("/api/web/news/{$id}")->assertOk()->assertJsonPath('data.title', 'Hello');
        $this->getJson('/api/web/news/999')->assertStatus(404);
        $this->putJson("/api/web/news/{$id}", ['title' => 'Hello again'])->assertOk()->assertJsonPath('data.title', 'Hello again');
        $this->assertWebLog('update', 'Hello again');
        $this->putJson("/api/web/news/{$id}", ['title' => 'ab'])->assertStatus(422);
        $this->putJson('/api/web/news/999', ['title' => 'Nope'])->assertStatus(404);

        $this->failOn('web_news', 'UPDATE');
        $this->putJson("/api/web/news/{$id}", ['title' => 'Boom'])->assertStatus(500)->assertJson(['message' => 'News update failed.']);
        $this->failOn('web_news', 'INSERT');
        $this->postJson('/api/web/news', ['title' => 'Hello', 'message' => 'World', 'author' => 'Me', 'thema' => 'info'])
            ->assertStatus(500)->assertJson(['message' => 'News creation failed.']);
    }

    /**
     * @description Delete (soft / permanent), bulk delete, restore, empty trash, 404s.
     * @input News A, B, C; the actions in sequence.
     * @output As expected; logs written.
     */
    public function test_delete_restore_and_trash(): void
    {
        $this->signIn($this->userWith(self::ALL));
        [$a, $b, $c] = [$this->news(), $this->news(), $this->news()];

        $this->deleteJson("/api/web/news/{$a->id}")->assertNoContent();
        $this->assertSoftDeleted($a);
        $this->deleteJson("/api/web/news/{$b->id}?force_delete=true")->assertNoContent();
        $this->assertNull(WebNews::withTrashed()->find($b->id));
        $this->deleteJson('/api/web/news/999')->assertStatus(404);
        $this->postJson("/api/web/news/{$a->id}/restore")->assertOk()->assertJsonPath('data.deleted_at', null);
        $this->assertWebLog('restore');
        $this->postJson('/api/web/news/999/restore')->assertStatus(404);

        $this->postJson('/api/web/news/bulk-delete', ['ids' => [$c->id, 999]])->assertOk()->assertJson(['data' => ['deleted_count' => 1, 'skipped_count' => 1]]);
        $this->postJson('/api/web/news/bulk-delete', ['ids' => array_merge([$a->id], range(1000, 1060)), 'force_delete' => true])->assertOk()->assertJsonPath('data.deleted_count', 1);
        $this->assertWebLog('hard_delete_bulk', '...');
        $this->postJson('/api/web/news/bulk-delete', ['ids' => 'x'])->assertStatus(422);

        $this->deleteJson('/api/web/news/force-delete-all')->assertNoContent();
        $this->assertSame(0, WebNews::onlyTrashed()->count());
        $this->assertWebLog('force_delete_all', 'Count: 1');
    }

    /**
     * @description Database errors of delete, bulk delete, restore and emptying the trash.
     * @input A active, B trashed; UPDATE fails, then DELETE fails.
     * @output 500 with the action's message each.
     */
    public function test_delete_errors(): void
    {
        $this->signIn($this->userWith(self::ALL));
        $a = $this->news();
        $b = $this->news();
        $b->delete();

        $this->failOn('web_news', 'UPDATE');
        $this->deleteJson("/api/web/news/{$a->id}")->assertStatus(500)->assertJson(['message' => 'News deletion failed.']);
        $this->postJson('/api/web/news/bulk-delete', ['ids' => [$a->id]])->assertStatus(500)->assertJson(['message' => 'Bulk deletion failed.']);
        $this->postJson("/api/web/news/{$b->id}/restore")->assertStatus(500)->assertJson(['message' => 'News restoration failed.']);
        $this->failOn('web_news', 'DELETE');
        $this->deleteJson('/api/web/news/force-delete-all')->assertStatus(500)->assertJson(['message' => 'Emptying trash failed.']);
    }
}
