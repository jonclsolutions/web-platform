<?php
/**
 * @file CoreImportBatch.php
 * @path app/Models/Core/CoreImportBatch.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Eloquent model pro core_import_batches - audit trail a stav zpracování
 * hromadného importu (synchronního i queue). Odděleno od core_logs (jednořádkový
 * audit záznam) i od core_security_events (diagnostika útoků) - tohle je stavový
 * objekt konkrétní importní operace, na který se dá dotazovat opakovaně (frontend
 * poll u velkých importů běžících na pozadí).
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