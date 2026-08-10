<?php
/**
 * @file CoreLog.php
 * @path app/Models/Core/CoreLog.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Eloquent model for the `core_logs` table - system-wide audit trail shared
 * across Web and Shop (authentication, user/role/permission management, legal documents,
 * core site settings). Structurally identical to WebLog/ShopLog by design, so all three
 * log tables can share the same LogsActivity trait and the same frontend ActivityLog shape.
 */

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

class CoreLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'origin',
        'event_type',
        'module',
        'description',
        'affected_entity_type',
        'affected_entity_id',
        'user_id',
        'context_data',
        'user_id_plain',
        'user_plain',
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     * @note `context_data` MUST be cast to 'array' here to match WebLog/ShopLog -
     * LogsActivity relies on this cast to serialize the payload exactly once (see trait
     * for the corresponding fix - passing a raw array instead of a pre-encoded string).
     */
    protected $casts = [
        'created_at'   => 'datetime',
        'context_data' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}