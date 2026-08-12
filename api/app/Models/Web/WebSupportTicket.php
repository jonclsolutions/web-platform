<?php
/**
 * @file WebSupportTicket.php
 * @path app/Models/Web/WebSupportTicket.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Model representing a customer support request.
 * @refactor-note (2026-08-2) Přidán `attachments()` polymorfní vztah - příloha se od teď
 *      ukládá přes `web_attachments` (viz HandlesAttachments::storeSingleAttachment())
 *      místo přímo do `attachment_path`. `attachment_path`/`attachment_original_name`
 *      sloupce zůstávají v DB kvůli historickým záznamům nahraným před touto změnou,
 *      ale nový upload už do nich nezapisuje - viz WebSupportTicketController.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\User;

/**
 * @description Tracks support tickets, their status, and priority levels for internal processing.
 * * @property int $id Unique identifier.
 * @property string $state Ticket status (default: new).
 */
class WebSupportTicket extends Model
{
use HasFactory, SoftDeletes;

/**
     * @var array<int, string> The attributes that are mass assignable.
     */
protected $fillable = [
'user_id',
'user_name_plain',
'user_plain',
'category',
'priority',
'state',
'subject',
'description',
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
     * Boot the model and register events.
     * Set default ticket state upon creation.
     */
protected static function booted()
    {
static::creating(function ($ticket) {
if (empty($ticket->state)) {
$ticket->state = 'new';
            }
        });
    }

/**
     * Get the user who submitted the ticket.
     * * @return BelongsTo
     */
public function user(): BelongsTo
    {
return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @description Polymorphic relation to the current attachment(s).
     *              storeSingleAttachment() guarantees at most one row here.
     * @return MorphMany
     */
    public function attachments(): MorphMany
    {
        return $this->morphMany(WebAttachment::class, 'attachable');
    }
}