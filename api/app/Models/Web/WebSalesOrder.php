<?php
/**
 * @file WebSalesOrder.php
 * @path app/Models/Web/WebSalesOrder.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Model representing a sales order generated from a lead.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;


/**
 * @description Manages commercial sales order data linked to a specific sales lead.
 * @property int $id Unique identifier.
 * @property int $lead_id Foreign key to the originating lead.
 * @property string $client_email Contact email for the order.
 * @property bool $data_processing_agreement Whether the client accepted the GDPR data
 * processing consent at submission time.
 * @property bool $tos_agreement Whether the client accepted the terms of service at
 * submission time.
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
        'lang',
        'order_description',
        'salesman_name',
        'data_processing_agreement',
        'tos_agreement',
    ];

    protected $casts = [
        'data_processing_agreement' => 'boolean',
        'tos_agreement'              => 'boolean',
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

    /**
     * @description The project created from this order (at most one: `web_projects.order_id`
     * has a UNIQUE constraint).
     */
    public function project(): HasOne
    {
        return $this->hasOne(\App\Models\Web\WebProject::class, 'order_id');
    }
}