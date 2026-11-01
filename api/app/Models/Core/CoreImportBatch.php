<?php
/**
 * @file CoreImportBatch.php
 * @path app/Models/Core/CoreImportBatch.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Model of core_import_batches - state and audit trail of one bulk import
 * (synchronous or queued). Separate from core_logs (one audit line) and core_security_events
 * (attack diagnostics): a state object of one import, polled by the frontend for large imports
 * running in the background.
 */

namespace App\Models\Core;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CoreImportBatch extends Model
{
    public $timestamps = true;

    protected $fillable = [
        'resource', 'user_id', 'original_filename', 'format', 'temp_path',
        'status', 'total_rows', 'valid_rows', 'invalid_rows',
        'imported_count', 'skipped_count', 'error_summary', 'completed_at',
    ];

    protected $casts = [
        'error_summary' => 'array',
        'created_at'    => 'datetime',
        'updated_at'    => 'datetime',
        'completed_at'  => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}