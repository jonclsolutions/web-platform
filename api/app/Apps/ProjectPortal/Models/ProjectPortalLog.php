<?php
/**
 * @file ProjectPortalLog.php
 * @path app/Apps/ProjectPortal/Models/ProjectPortalLog.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Audit log of the project portal (project_portal_logs): changes of projects, their
 *   checkpoints, threads, updates, approvals, templates and client accounts made in the admin, and
 *   the activity of the clients in the portal (sign-in, threads, decisions). Same shape as the
 *   other audit logs (LogsActivity).
 * @dependencies User (author of the event).
 */

namespace App\Apps\ProjectPortal\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property array|null $context_data Event details.
 */
class ProjectPortalLog extends Model
{
    /** @description Rows carry only `created_at` (database default). */
    public $timestamps = false;

    protected $fillable = [
        'origin', 'event_type', 'module', 'description',
        'affected_entity_type', 'affected_entity_id', 'user_id',
        'context_data', 'user_id_plain', 'user_plain',
    ];

    protected $casts = [
        'created_at'   => 'datetime',
        'context_data' => 'array',
    ];

    /**
     * @description Admin who triggered the event (null for a client of the portal or a deleted account).
     * @return BelongsTo
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
