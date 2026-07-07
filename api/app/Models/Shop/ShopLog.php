<?php
/**
 * @file ShopLog.php
 * @path app/Models/Shop/ShopLog.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model representing shop-specific system event logs.
 */

namespace App\Models\Shop;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

/**
 * @description Tracks business events, security logs, and user-initiated actions within the shop.
 * 
 * @property int $id The unique identifier.
 * @property array|null $context_data JSON object containing event details.
 */
class ShopLog extends Model
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
     * Get the user who performed the action.
     *
     * @return BelongsTo
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}