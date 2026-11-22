<?php
/**
 * @file WorkspaceQuota.php
 * @path app/Apps/JsCreator/Services/WorkspaceQuota.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Disk space of the workspace of an account: what it uses (every stored file -
 *   images of the library with their thumbnails, fonts, thumbnails of templates and blocks and
 *   outputs with their thumbnails - INCLUDING
 *   the trash, which frees space only when emptied) and its quota (individual quota, otherwise the default of the settings).
 *   Uploads ask ensureRoom() first; a full workspace refuses them with 422 `quota_exceeded`.
 * @note Two uploads running at the same moment may together exceed the quota a little - the
 *   quota is a limit of the workspace, not an exact accounting.
 * @dependencies CreatorAsset, CreatorFont, CreatorTemplate, CreatorOutput, CreatorSetting, CreatorUserQuota.
 */

namespace App\Apps\JsCreator\Services;

use App\Apps\JsCreator\Models\CreatorAsset;
use App\Apps\JsCreator\Models\CreatorBlock;
use App\Apps\JsCreator\Models\CreatorFont;
use App\Apps\JsCreator\Models\CreatorOutput;
use App\Apps\JsCreator\Models\CreatorSetting;
use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Models\CreatorUserQuota;

final class WorkspaceQuota
{
    /** @description Bytes of one MB of the quota. */
    public const MB = 1024 * 1024;

    /**
     * @description Bytes used by the files of the account (trash included).
     * @param int $userId Account.
     * @return int
     */
    public static function usedBytes(int $userId): int
    {
        return (int) CreatorAsset::withTrashed()->ownedBy($userId)->sum('size_bytes')
            + (int) CreatorFont::withTrashed()->ownedBy($userId)->sum('size_bytes')
            + (int) CreatorTemplate::withTrashed()->ownedBy($userId)->sum('thumb_bytes')
            + (int) CreatorBlock::withTrashed()->ownedBy($userId)->sum('thumb_bytes')
            + (int) CreatorOutput::withTrashed()->ownedBy($userId)->sum('size_bytes');
    }

    /**
     * @description Individual quota of the account in MB (null = the default applies).
     * @param int $userId Account.
     * @return int|null
     */
    public static function individualMb(int $userId): ?int
    {
        return CreatorUserQuota::query()->find($userId)?->quota_mb;
    }

    /**
     * @description Quota of the account in bytes.
     * @param int $userId Account.
     * @return int
     */
    public static function quotaBytes(int $userId): int
    {
        return (self::individualMb($userId) ?? CreatorSetting::current()->default_quota_mb) * self::MB;
    }

    /**
     * @description Refuses a new file that would not fit into the quota.
     * @param int $userId Account.
     * @param int $bytes Size of the new files.
     * @return void
     * @throws QuotaExceededException
     */
    public static function ensureRoom(int $userId, int $bytes): void
    {
        if (self::usedBytes($userId) + $bytes > self::quotaBytes($userId)) {
            throw new QuotaExceededException();
        }
    }
}
