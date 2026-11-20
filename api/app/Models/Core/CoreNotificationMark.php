<?php
/**
 * @file CoreNotificationMark.php
 * @path app/Models/Core/CoreNotificationMark.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description When one admin last looked at one kind of records (CoreNotificationController) -
 * records of the kind that came after `seen_at` are unread for that admin. Only the owner's own
 * marks are read or written; deleted with the account.
 */

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int    $id
 * @property int    $user_id Owner.
 * @property string $kind    Kind of records (NotificationContext key, e.g. web_inquiries).
 * @property \Illuminate\Support\Carbon $seen_at Last look at the kind.
 */
class CoreNotificationMark extends Model
{
    /** @var string Table of the model. */
    protected $table = 'core_notification_marks';

    /** @var bool No created_at / updated_at - seen_at is the only time. */
    public $timestamps = false;

    /** @var array<int, string> The attributes that are mass assignable (user_id is set by the controller). */
    protected $fillable = ['kind', 'seen_at'];

    /** @var array<string, string> Attribute casts. */
    protected $casts = ['seen_at' => 'datetime'];
}
