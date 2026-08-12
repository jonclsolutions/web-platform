<?php
/**
 * @file WebSalesOrder.php
 * @path app/Models/Web/WebSalesOrder.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Model representing a sales order generated from a lead.
 *
 * @refactor-note (2026-08) Odstraněno jednosouborové pole `attachment_path` - nahrazeno
 * polymorfním vztahem `attachments()` (viz WebAttachment.php), umožňuje uložit až 10
 * příloh na jednu realizaci místo jedné.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * @description Manages commercial sales order data linked to a specific sales lead.
 * @property int $id Unique identifier.
 * @property int $lead_id Foreign key to the originating lead.
 * @property string $client_email Contact email for the order.
 */
class WebSalesOrder extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'lead_id',
        'client_name',
        'ico',
        'client_address',
        'client_phone',
        'client_email',
        'order_description',
        'salesman_name',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(WebSalesLead::class, 'lead_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(WebAttachment::class, 'attachable');
    }
}