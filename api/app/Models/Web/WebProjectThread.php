<?php
/**
 * @file WebProjectThread.php
 * @path app/Models/Web/WebProjectThread.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description One conversation thread within a project - bidirectional (customer
 * and admin can both post multiple messages) per consultation. `last_message_at` is
 * denormalized for cheap sorting in both the admin's cross-project table and the
 * customer's per-project thread list.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WebProjectThread extends Model
{
    public const STATUSES = ['active', 'closed'];

    protected $fillable = [
        'project_id',
        'subject',
        'priority',
        'status',
        'opened_by',
        'last_message_at',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(WebProject::class, 'project_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(WebProjectThreadMessage::class, 'thread_id')->orderBy('created_at');
    }
}