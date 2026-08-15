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
 *
 * @bugfix-note (2026-08-15) KRITICKÁ OPRAVA (GDPR): `data_processing_agreement` a
 * `tos_agreement` doplněny do `$fillable`. Frontend (order-form.component.html) i
 * `StoreWebSalesOrderRequest` (required|accepted) souhlas s GDPR i obchodními
 * podmínkami odjakživa VYŽADOVALY a validovaly - ale `WebSalesOrder::create()` obě
 * hodnoty mlčky zahazoval, protože nebyly ve `$fillable`, a tabulka pro ně navíc
 * neměla sloupce. Výsledek: uživatel musel zaškrtnout souhlas, aby formulář vůbec
 * prošel, ale nikde se netrvale nezaznamenalo, že tak učinil - bez auditní stopy pro
 * případnou GDPR kontrolu. Sloupce doplněny samostatnou SQL migrací (nedestruktivní
 * ALTER, DEFAULT 0 pro existující řádky - u těch souhlas retroaktivně nelze doložit).
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
}