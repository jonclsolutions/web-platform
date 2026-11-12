<?php
/**
 * @file WebProjectCheckpoint.php
 * @path app/Models/Web/WebProjectCheckpoint.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Freeform per-project checklist item (e.g. "UI design", "Deploy") -
 * toggled by an admin, visible read-only to the customer on the public project page.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WebProjectCheckpoint extends Model
{
    public const STATUSES = ['new', 'active', 'done'];

    protected $fillable = [
        'project_id',
        'label',
        'description',
        'status',
        'status_changed_at',
        'sort_order',
    ];

    protected $casts = [
        'status_changed_at' => 'datetime',
        'sort_order' => 'integer',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(WebProject::class, 'project_id');
    }

    /**
     * @description Sets the new state and records `status_changed_at` - the one place where
     * `status` should change, so the timestamp is never forgotten.
     */
    public function setStatus(string $status): void
    {
        if (!in_array($status, self::STATUSES, true)) {
            throw new \InvalidArgumentException("Invalid checkpoint status: {$status}");
        }
        $this->status = $status;
        $this->status_changed_at = now();
        $this->save();
    }
}