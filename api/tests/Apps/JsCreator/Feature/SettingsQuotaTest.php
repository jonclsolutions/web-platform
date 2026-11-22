<?php

/**
 * @file SettingsQuotaTest.php
 * @path api/tests/Apps/JsCreator/Feature/SettingsQuotaTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the settings and quotas of JS Creator (SettingsController,
 *   UsageController, WorkspaceQuota): permissions, the default quota, the overview of the
 *   accounts (access through a role, an explicit grant or the sysadmin role, and accounts with
 *   data) with numbers only, individual quotas and the usage of the own workspace.
 * @dependencies Tests\TestCase, JsCreatorFixtures, fake private disk.
 */

namespace Tests\Apps\JsCreator\Feature;

use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorFolder;
use App\Apps\JsCreator\Models\JsCreatorLog;
use Tests\Apps\JsCreator\Support\JsCreatorFixtures;
use Tests\TestCase;

/**
 * @description /api/js-creator/settings, /api/js-creator/usage.
 */
class SettingsQuotaTest extends TestCase
{
    use JsCreatorFixtures;

    /**
     * @description Viewing and changing the settings need their permissions; the default quota
     *   is 1024 MB and is validated.
     * @input accounts without / with view / with update; PUT 0, PUT 2048.
     * @output 403 / 200 1024 / 403 update; 422; 200 2048 + log row.
     */
    public function test_default_quota(): void
    {
        $this->signIn($this->user());
        $this->getJson('/api/js-creator/settings')->assertForbidden();

        $this->signIn($this->userWith(['js-creator-settings-view']));
        $this->getJson('/api/js-creator/settings')->assertOk()->assertJsonPath('data.default_quota_mb', 1024);
        $this->putJson('/api/js-creator/settings', ['default_quota_mb' => 2048])->assertForbidden();

        $this->signIn($this->userWith(['js-creator-settings-view', 'js-creator-settings-update']));
        $this->putJson('/api/js-creator/settings', ['default_quota_mb' => 0])->assertStatus(422);
        $this->putJson('/api/js-creator/settings', ['default_quota_mb' => 2048])->assertOk()->assertJsonPath('data.default_quota_mb', 2048);
        $this->getJson('/api/js-creator/settings')->assertJsonPath('data.default_quota_mb', 2048);
        $this->assertTrue(JsCreatorLog::where('module', 'Settings')->where('description', 'like', '%1024 MB → 2048 MB%')->exists());
    }

    /**
     * @description The overview lists accounts with access (role, explicit grant, sysadmin) and
     *   accounts that still have data, with numbers only; others are not listed.
     * @input role account with a folder and an image; explicit grant; sysadmin; account without
     *   access but with a folder; unrelated account.
     * @output 4 rows by name; usage and counts of the role account; no names of folders anywhere.
     */
    public function test_overview_of_accounts(): void
    {
        $this->fakeDisk();
        $roleUser = $this->signIn($this->creator(['view', 'create']));
        $this->postJson('/api/js-creator/folders', ['name' => 'Very secret campaign'])->assertCreated();
        $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])->assertCreated();

        $explicit = $this->user(['full_name' => 'B explicit']);
        $explicit->explicitPermissions()->attach($this->permission('view-js-creator', 'js-creator')->id);
        $sysadmin = $this->sysadmin(['full_name' => 'C sysadmin']);
        $former = $this->user(['full_name' => 'D former']);
        CreatorFolder::create(['user_id' => $former->id, 'name' => 'Left behind']);
        $this->user(['full_name' => 'E unrelated']);

        $this->signIn($this->userWith(['js-creator-settings-view'], ['full_name' => 'F viewer']));
        $response = $this->getJson('/api/js-creator/settings/users')->assertOk();
        $rows = collect($response->json('data'))->keyBy('id');

        $this->assertEqualsCanonicalizing([$roleUser->id, $explicit->id, $sysadmin->id, $former->id], $rows->keys()->all());
        $this->assertTrue($rows[$roleUser->id]['has_access']);
        $this->assertFalse($rows[$former->id]['has_access']);
        $this->assertSame(['folders' => 1, 'images' => 1, 'fonts' => 0, 'templates' => 0, 'outputs' => 0], $rows[$roleUser->id]['counts']);
        $this->assertSame((int) CreatorAsset::sum('size_bytes'), $rows[$roleUser->id]['used_bytes']);
        $this->assertSame(1024 * 1024 * 1024, $rows[$roleUser->id]['quota_bytes']);
        $this->assertStringNotContainsString('secret', $response->getContent());
        $this->assertStringNotContainsString('Left behind', $response->getContent());
    }

    /**
     * @description An individual quota overrides the default for that account only and can be
     *   removed again; the own usage shows it.
     * @input quota 5 MB for A; usage of A and B; quota null for A; unknown account.
     * @output A 5 MB, B default; after null A default; 404 unknown; log rows without names.
     */
    public function test_individual_quota_and_usage(): void
    {
        $a = $this->creator();
        $b = $this->creator();
        $this->signIn($this->userWith(['js-creator-settings-view', 'js-creator-settings-update']));
        $this->putJson("/api/js-creator/settings/users/{$a->id}/quota", ['quota_mb' => 5])->assertOk()
            ->assertJsonPath('data.quota_mb', 5)->assertJsonPath('data.quota_bytes', 5 * 1024 * 1024)->assertJsonPath('data.has_access', true);
        $this->putJson("/api/js-creator/settings/users/{$a->id}/quota", [])->assertStatus(422);
        $this->putJson('/api/js-creator/settings/users/99999/quota', ['quota_mb' => 5])->assertNotFound();

        $this->signIn($a);
        $this->getJson('/api/js-creator/usage')->assertOk()->assertJsonPath('data.quota_bytes', 5 * 1024 * 1024)
            ->assertJsonPath('data.used_bytes', 0)->assertJsonPath('data.counts.folders', 0);
        $this->signIn($b);
        $this->getJson('/api/js-creator/usage')->assertJsonPath('data.quota_bytes', 1024 * 1024 * 1024);

        $this->signIn($this->userWith(['js-creator-settings-update']));
        $this->putJson("/api/js-creator/settings/users/{$a->id}/quota", ['quota_mb' => null])->assertOk()->assertJsonPath('data.quota_mb', null);
        $this->signIn($a);
        $this->getJson('/api/js-creator/usage')->assertJsonPath('data.quota_bytes', 1024 * 1024 * 1024);
        $this->assertTrue(JsCreatorLog::where('module', 'Quota')->where('description', 'like', '%5 MB → default%')->exists());
    }

    /**
     * @description The usage counts the trash in the used bytes and shows it separately.
     * @input two images, one in the trash; one folder.
     * @output used = both; trash = the trashed one; counts images 1, folders 1.
     */
    public function test_usage_counts_the_trash(): void
    {
        $this->fakeDisk();
        $this->signIn($this->creator());
        $first = $this->post('/api/js-creator/library/assets', ['files' => [$this->png()]], ['Accept' => 'application/json'])->json('data.0');
        $this->post('/api/js-creator/library/assets', ['files' => [$this->png(12, 12)]], ['Accept' => 'application/json'])->assertCreated();
        $this->deleteJson("/api/js-creator/library/assets/{$first['id']}")->assertNoContent();
        $this->postJson('/api/js-creator/folders', ['name' => 'A'])->assertCreated();

        $this->getJson('/api/js-creator/usage')->assertOk()
            ->assertJsonPath('data.used_bytes', (int) CreatorAsset::withTrashed()->sum('size_bytes'))
            ->assertJsonPath('data.trash_bytes', $first['size_bytes'])
            ->assertJsonPath('data.counts.images', 1)->assertJsonPath('data.counts.folders', 1);
    }
}
