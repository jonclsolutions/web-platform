<?php
/**
 * @file AuditLog.php
 * @path app/Models/Core/AuditLog.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Base of every audit log table (core_logs and the log of each application). The
 *   tables have the same columns, so the core writes them with one trait (LogsActivity), reads
 *   them with one controller (AuditLogController) and one resource (AuditLogResource); a log of an
 *   application is a subclass naming only its table.
 * @usage `final class ShopLog extends AuditLog { protected $table = 'shop_logs'; }`
 * @dependencies User (author of the event).
 */

namespace App\Models\Core;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property string|null $origin IP address / origin of the request.
 * @property string $event_type
 * @property string $module
 * @property string|null $description
 * @property array|null $context_data Event details.
 * @property \Illuminate\Support\Carbon|null $created_at
 */
abstract class AuditLog extends Model
{
    /** @description Rows carry only `created_at` (database default). */
    public $timestamps = false;

    /** @var array<int, string> Columns written by LogsActivity. */
    protected $fillable = [
        'origin', 'event_type', 'module', 'description',
        'affected_entity_type', 'affected_entity_id', 'user_id',
        'context_data', 'user_id_plain', 'user_plain',
    ];

    /**
     * @var array<string, string>
     * @note `context_data` must stay cast to 'array': LogsActivity passes a raw array, so the
     *   payload is encoded exactly once.
     */
    protected $casts = [
        'created_at'   => 'datetime',
        'context_data' => 'array',
    ];

    /**
     * @description Account that triggered the event (null for a guest, a client of a portal or a
     *   deleted account - `user_plain` keeps the e-mail).
     * @return BelongsTo
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
