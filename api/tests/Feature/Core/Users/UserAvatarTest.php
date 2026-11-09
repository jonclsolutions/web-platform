<?php

/**
 * @file UserAvatarTest.php
 * @path api/tests/Feature/Core/Users/UserAvatarTest.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Feature tests of the profile photo of an admin account: upload (processed to a
 *   256×256 WebP), the signed URL in the account data, removal, permissions (own account, account
 *   management, sysadmin rule), validation of the upload and clean-up of the file with the
 *   account (force delete, emptied trash, orphan prune).
 * @dependencies
 * - Tests\TestCase (InteractsWithAccounts); Storage fake of the private disk; UploadedFile fake
 *   images (GD).
 */

namespace Tests\Feature\Core\Users;

use App\Support\Images\UserAvatar;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * @description Profile photo of an admin account.
 */
class UserAvatarTest extends TestCase
{
    /** @description Permission of the account management edit. */
    private const UPDATE = 'core-administrators-update';

    /**
     * @description Uploads a photo for the account and returns the response.
     * @param int $id Account ID.
     * @param UploadedFile $file Upload.
     * @return \Illuminate\Testing\TestResponse
     */
    private function upload(int $id, UploadedFile $file)
    {
        return $this->post("/api/core/users/{$id}/avatar", ['avatar' => $file], ['Accept' => 'application/json']);
    }

    /**
     * @description The own photo: a 1200×800 PNG is stored as a 256×256 WebP, the account data
     *   carry its signed URL, the URL serves it with safe headers, a tampered URL is refused, a
     *   new photo replaces the file and removal returns to the default image.
     * @input Account without permissions; upload PNG; GET own account; GET the URL (and with a
     *   changed signature); second upload; DELETE.
     * @output 200 + relative avatar_url; 256×256 WebP on the disk; avatar_url in GET; image/webp +
     *   nosniff; 403 (signature / v changed); old file deleted; avatar_url null, file gone.
     */
    public function test_own_photo_is_processed_served_replaced_and_removed(): void
    {
        $disk = Storage::fake('private');
        $me = $this->signIn($this->userWith([]));

        $url = $this->upload($me->id, UploadedFile::fake()->image('me.png', 1200, 800))->assertOk()->json('data.avatar_url');
        // Relative - loaded from the origin of the admin, whatever host name the API sees.
        $this->assertStringStartsWith("/api/users/{$me->id}/avatar?", $url);
        $path = $me->fresh()->avatar_path;
        $this->assertStringStartsWith('avatars/' . $me->id . '-', $path);
        $this->assertStringEndsWith('.webp', $path);
        $size = getimagesizefromstring($disk->get($path));
        $this->assertSame([256, 256, 'image/webp'], [$size[0], $size[1], $size['mime']]);

        $this->assertSame($url, $this->getJson("/api/core/users/{$me->id}")->json('data.avatar_url'));

        $image = $this->get($url)->assertOk();
        $this->assertSame('image/webp', $image->headers->get('Content-Type'));
        $this->assertSame('nosniff', $image->headers->get('X-Content-Type-Options'));
        $this->get($url . 'x')->assertForbidden();
        $this->get(preg_replace('/v=[^&]+/', 'v=other', $url))->assertForbidden();

        $this->upload($me->id, UploadedFile::fake()->image('new.jpg', 300, 300))->assertOk();
        $disk->assertMissing($path);

        $newPath = $me->fresh()->avatar_path;
        $this->deleteJson("/api/core/users/{$me->id}/avatar")->assertOk()->assertJsonPath('data.avatar_url', null);
        $this->assertNull($me->fresh()->avatar_path);
        $disk->assertMissing($newPath);
        $this->assertNull($this->getJson("/api/core/users/{$me->id}")->json('data.avatar_url'));
    }

    /**
     * @description Another account: only with the update permission; the photo of a sysadmin only
     *   by a sysadmin (a sysadmin changes his own photo too).
     * @input Without permission -> other; with update -> other, -> sysadmin; sysadmin -> sysadmin;
     *   sysadmin -> own.
     * @output 403; 200; 403 (file untouched); 200; 200.
     */
    public function test_permissions(): void
    {
        Storage::fake('private');
        $other = $this->user();
        $admin = $this->sysadmin();

        $this->signIn($this->userWith([]));
        $this->upload($other->id, UploadedFile::fake()->image('a.png', 50, 50))->assertForbidden();

        $this->signIn($this->userWith([self::UPDATE]));
        $this->upload($other->id, UploadedFile::fake()->image('a.png', 50, 50))->assertOk();
        $this->upload($admin->id, UploadedFile::fake()->image('a.png', 50, 50))->assertForbidden();
        $this->deleteJson("/api/core/users/{$admin->id}/avatar")->assertForbidden();
        $this->assertNull($admin->fresh()->avatar_path);

        $this->signIn($this->sysadmin());
        $this->upload($admin->id, UploadedFile::fake()->image('a.png', 50, 50))->assertOk();
        $this->signIn($admin);
        $this->upload($admin->id, UploadedFile::fake()->image('a.png', 50, 50))->assertOk();
    }

    /**
     * @description Only real JPG / PNG / WebP images up to 2 MB and 8000 px are accepted.
     * @input A PDF; text named .png; a 3 MB "jpg"; a 9000×10 PNG; no file.
     * @output 422 each, no photo stored.
     */
    public function test_invalid_uploads_are_refused(): void
    {
        Storage::fake('private');
        $me = $this->signIn($this->userWith([]));

        foreach ([
            UploadedFile::fake()->create('cv.pdf', 10, 'application/pdf'),
            UploadedFile::fake()->createWithContent('fake.png', 'not an image'),
            UploadedFile::fake()->create('big.jpg', 3000, 'image/jpeg'),
            UploadedFile::fake()->image('wide.png', 9000, 10),
        ] as $file) {
            $this->upload($me->id, $file)->assertStatus(422)->assertJsonValidationErrors('avatar');
        }
        $this->postJson("/api/core/users/{$me->id}/avatar")->assertStatus(422);
        $this->assertNull($me->fresh()->avatar_path);
    }

    /**
     * @description The file lives as long as the account: a soft delete keeps it (restore), the
     *   force delete and the emptied trash delete it; an orphan photo is pruned, a soft-deleted
     *   account's one is kept.
     * @input Three accounts with photos + an orphan file (2 days old); soft delete A; prune;
     *   force delete A; soft delete B + empty trash; C stays.
     * @output after prune: orphan gone, A kept; A file gone; B file gone; C kept.
     */
    public function test_file_is_deleted_with_the_account(): void
    {
        $disk = Storage::fake('private');
        $this->signIn($this->sysadmin());
        [$a, $b, $c] = [$this->user(), $this->user(), $this->user()];
        foreach ([$a, $b, $c] as $user) {
            UserAvatar::store($user, UploadedFile::fake()->image('p.png', 40, 40));
        }
        [$pa, $pb, $pc] = [$a->avatar_path, $b->avatar_path, $c->avatar_path];
        $disk->put('avatars/999-orphan.webp', 'x');
        foreach (['avatars/999-orphan.webp', $pa] as $path) {
            touch($disk->path($path), Carbon::now()->subDays(2)->getTimestamp());
        }

        $this->deleteJson("/api/core/users/{$a->id}")->assertNoContent();
        $this->artisan('storage:prune-orphans')->assertSuccessful();
        $disk->assertMissing('avatars/999-orphan.webp');
        $disk->assertExists($pa);

        $this->deleteJson("/api/core/users/{$a->id}", ['force_delete' => true])->assertNoContent();
        $disk->assertMissing($pa);

        $this->deleteJson("/api/core/users/{$b->id}")->assertNoContent();
        $this->deleteJson('/api/core/users/force-delete-all')->assertNoContent();
        $disk->assertMissing($pb);
        $disk->assertExists($pc);
    }
}
