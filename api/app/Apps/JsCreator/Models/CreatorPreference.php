<?php

/**
 * @file CreatorPreference.php
 * @path app/Apps/JsCreator/Models/CreatorPreference.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Personal settings of an account in JS Creator (js_creator_preferences, one row
 *   per account): brand colours offered by every colour picker of the editor and hashtag sets
 *   inserted into the text of the post (`payload`, shape checked by Preferences).
 * @dependencies BelongsToWorkspace, Preferences.
 */

namespace App\Apps\JsCreator\Models;

use App\Apps\JsCreator\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $user_id Owner.
 * @property array $payload `colors` and `hashtag_sets` (Preferences).
 */
class CreatorPreference extends Model
{
    use BelongsToWorkspace;

    /** @description Colours and hashtags never reach the audit log (content of the private workspace). */
    public const AUDIT_MASKED = ['payload'];

    /** @var string The table of the model. */
    protected $table = 'js_creator_preferences';

    /** @var array<int, string> The attributes that are mass assignable. */
    protected $fillable = ['user_id', 'payload'];

    /** @var array<string, string> The attributes that should be cast. */
    protected $casts = ['user_id' => 'integer', 'payload' => 'array'];
}
