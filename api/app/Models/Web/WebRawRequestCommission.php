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
 *
 * @refactor-note (2026-08-19) BACKLOG "editovatelný obsah potvrzovacího e-mailu":
 * přidán sloupec `lang` (default `'cz'`) - zaznamenává, v jakém jazyce zákazník
 * veřejný formulář (ContactComponent) odeslal. Potvrzovací e-mail
 * (`WebRawRequestCommissionReceived`/`App\Support\Mail\RawRequestEmailTemplate`) podle
 * něj vybere odpovídající jazykovou variantu editovatelné šablony (nadpis/úvod/závěr),
 * s fallbackem na `cz`, pokud daný jazyk vůbec nemá vlastní text vyplněný.
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
 * @property string $lang Jazyk, ve kterém byl formulář odeslán (řídí jazyk potvrzovacího e-mailu).
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
'lang',
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