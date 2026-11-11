<?php
/**
 * @file CoreCalendarEvent.php
 * @path app/Models/Core/CoreCalendarEvent.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Personal event of the admin calendar (own reminder / note of one admin). Every
 * query is scoped to the owner (CoreCalendarEventController); nobody else sees it.
 */

namespace App\Models\Core;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int         $id
 * @property int         $user_id Owner.
 * @property \Illuminate\Support\Carbon $date Day of the event.
 * @property string|null $time    HH:MM:SS, null = all day.
 * @property string      $title
 * @property string|null $note
 * @property bool        $is_done
 */
class CoreCalendarEvent extends Model
{
    /** @var string Table of the model. */
    protected $table = 'core_calendar_events';

    /**
     * @description Personal data: the audit log notes that these attributes changed, never their
     *   values (App\Support\Audit\ModelChanges) - an erased / purged record leaves no copy in the logs.
     */
    public const AUDIT_MASKED = ['title', 'note'];

    /** @var array<int, string> The attributes that are mass assignable (user_id is set by the controller). */
    protected $fillable = ['date', 'time', 'title', 'note', 'is_done'];

    /** @var array<string, string> The attributes that should be cast to native types. */
    protected $casts = [
        'date' => 'date:Y-m-d',
        'is_done' => 'boolean',
        'user_id' => 'integer',
    ];

    /**
     * @description Owner of the event.
     * @return BelongsTo<User, CoreCalendarEvent>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
