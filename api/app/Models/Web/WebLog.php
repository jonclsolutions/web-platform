<?php
/**
 * @file WebLog.php
 * @path app/Models/Web/WebLog.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Model representing web module audit logs.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

/**
 * @description Tracks administrative and system events within the web module.
 * * @property int $id Unique identifier.
 * @property array $context_data JSON object containing event-specific metadata.
 */
class WebLog extends Model
{
    use HasFactory;

    /**
     * @var bool Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'origin', 'event_type', 'module', 'description', 
        'affected_entity_type', 'affected_entity_id', 'user_id', 
        'context_data', 'user_id_plain', 'user_plain'
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'created_at' => 'datetime',
        'context_data' => 'array',
    ];

    /**
     * Get the user who triggered the log event.
     * * @return BelongsTo
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}