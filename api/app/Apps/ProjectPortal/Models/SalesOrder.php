<?php
/**
 * @file SalesOrder.php
 * @path app/Apps/ProjectPortal/Models/SalesOrder.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Order of the project portal (table project_portal_sales_orders) - sent by the
 *   client on the public order form, usually from the link of a sales lead; a project is created
 *   from it (Project::order_id).
 */

namespace App\Apps\ProjectPortal\Models;

use App\Models\Core\CoreAttachment;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;


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
class SalesOrder extends Model
{
    use SoftDeletes;

    /** @var string The table of the model. */
    protected $table = 'project_portal_sales_orders';

    /**
     * @description Personal data: the audit log notes that these attributes changed, never their
     *   values (App\Support\Audit\ModelChanges) - an erased / purged record leaves no copy in the logs.
     */
    public const AUDIT_MASKED = ['client_name', 'client_address', 'client_phone', 'client_email', 'order_description'];

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
        return $this->belongsTo(SalesLead::class, 'lead_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(CoreAttachment::class, 'attachable');
    }
}