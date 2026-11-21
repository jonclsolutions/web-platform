<?php
/**
 * @file CreatorUserQuota.php
 * @path app/Apps/JsCreator/Models/CreatorUserQuota.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Individual quota of one account in JS Creator (js_creator_user_quotas); without a
 *   row the default quota of CreatorSetting applies.
 */

namespace App\Apps\JsCreator\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $user_id
 * @property int $quota_mb
 */
class CreatorUserQuota extends Model
{
    /** @var string The table of the model. */
    protected $table = 'js_creator_user_quotas';

    /** @var string Primary key (one row per account). */
    protected $primaryKey = 'user_id';

    /** @var bool The key is not auto-incrementing. */
    public $incrementing = false;

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['user_id', 'quota_mb'];

    /** @var array<string, string> The attributes that should be cast. */
    protected $casts = ['user_id' => 'integer', 'quota_mb' => 'integer'];
}
