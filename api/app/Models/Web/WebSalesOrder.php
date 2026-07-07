<?php
/**
 * @file WebSalesOrder.php
 * @path app/Models/Web/WebSalesOrder.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Model representing a sales order generated from a lead.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;

/**
 * @description Manages commercial sales order data linked to a specific sales lead.
 * * @property int $id Unique identifier.
 * @property int $lead_id Foreign key to the originating lead.
 * @property string $client_email Contact email for the order.
 */
class WebSalesOrder extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * @var array<int, string> The attributes that are mass assignable.
     */
    protected $fillable = [
        'lead_id',
        'client_name',
        'ico',
        'client_address',
        'client_phone',
        'client_email',
        'order_description',
        'salesman_name',
        'attachment_path' 
    ];

    /**
     * @var array<string, string> The attributes that should be cast to native types.
     */
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Get the lead this order was converted from.
     * * @return BelongsTo
     */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(WebSalesLead::class, 'lead_id');
    }
}