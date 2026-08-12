<?php
/**
 * @file WebRawRequestCommission.php
 * @path app/Models/Web/WebRawRequestCommission.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Model representing raw commission requests submitted from the web.
 *
 * @refactor-note (2026-08) Odstraněno jednosouborové pole `file_path` - nahrazeno
 * polymorfním vztahem `attachments()` (viz WebAttachment.php), který umožňuje uložit
 * až 10 příloh na jeden požadavek místo jedné.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * @description Handles raw commission inquiry submissions, preserving contact info and order details.
 * @property int $id Unique identifier.
 * @property string $thema Subject of the commission.
 */
class WebRawRequestCommission extends Model
{
    use HasFactory, SoftDeletes;

    public $timestamps = true;

    protected $fillable = [
        'thema',
        'contact_email',
        'contact_phone',
        'order_description',
        'status',
        'priority',
        'note',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function attachments(): MorphMany
    {
        return $this->morphMany(WebAttachment::class, 'attachable');
    }
}