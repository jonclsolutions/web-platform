<?php
/**
 * @file CreatorSetting.php
 * @path app/Apps/JsCreator/Models/CreatorSetting.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Settings of JS Creator (js_creator_settings, one row): the default quota of an
 *   account in MB (an individual quota is CreatorUserQuota).
 */

namespace App\Apps\JsCreator\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $default_quota_mb
 */
class CreatorSetting extends Model
{
    /** @description Default quota of a new installation (MB). */
    public const DEFAULT_QUOTA_MB = 1024;

    /** @var string The table of the model. */
    protected $table = 'js_creator_settings';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['default_quota_mb'];

    /** @var array<string, mixed> Defaults of a new row. */
    protected $attributes = ['default_quota_mb' => self::DEFAULT_QUOTA_MB];

    /** @var array<string, string> The attributes that should be cast. */
    protected $casts = ['default_quota_mb' => 'integer'];

    /**
     * @description The settings row (a new unsaved one with the defaults when it is missing).
     * @return self
     */
    public static function current(): self
    {
        return self::query()->orderBy('id')->first() ?? new self();
    }
}
