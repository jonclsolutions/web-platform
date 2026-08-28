<?php
/**
 * @file WebProjectCheckpoint.php
 * @path app/Models/Web/WebProjectCheckpoint.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Freeform per-project checklist item (e.g. "Návrh UI", "Deploy") -
 * toggled by an admin, visible read-only to the customer on the public project page.
 * @refactor-note (2026-08-28) `status` je 3-stavový enum ('new'/'active'/'done'),
 * NE boolean `is_checked` - odpovídá reálnému průběhu práce na checkpointu
 * (nezahájeno / rozpracováno / hotovo), ne jen binárnímu hotovo/nehotovo.
 * `status_changed_at` se aktualizuje při KAŽDÉ změně stavu (ne jen při přechodu na
 * 'done') - viz `setStatus()`.
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
     * @description Nastaví nový stav a automaticky zaznamená `status_changed_at` -
     * jediné místo, kudy by se `status` měl v aplikaci měnit (viz
     * WebProjectController::updateCheckpointStatus() v pozdější fázi), ať se nikde
     * nezapomene timestamp aktualizovat.
     */
    public function setStatus(string $status): void
    {
        if (!in_array($status, self::STATUSES, true)) {
            throw new \InvalidArgumentException("Neplatný stav checkpointu: {$status}");
        }
        $this->status = $status;
        $this->status_changed_at = now();
        $this->save();
    }
}