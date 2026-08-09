<?php
/**
 * @file WebSalesLead.php
 * @path app/Models/Web/WebSalesLead.php
 * @project RPSW Web
 * @author RPSW
 * @created 2025
 * @description Model representing a sales lead.
 * @refactor-note (2026) Přidán `public_token` (viz DB sloupec `web_sales_leads.public_token`)
 *      - náhodný, neuhodnutelný identifikátor pro veřejný odkaz na objednávkový formulář
 *      (/order_form/{token}), aby se v URL neobjevovalo interní `id` (sekvenční, prozrazuje
 *      objem dat i strukturu DB - IDOR riziko). Záměrně NENÍ v $fillable - token se nikdy
 *      nepřiřazuje z uživatelského vstupu, jen serverem přes getOrCreatePublicToken().
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use App\Models\User;

/**
 * @description Manages potential client interactions, tracking contact progress and lead status.
 * * @property int $id Unique identifier.
 * @property string|null $public_token Neuhodnutelný token pro veřejný odkaz na objednávkový formulář.
 * @property int $user_id The salesman assigned to the lead.
 */
class WebSalesLead extends Model
{
use HasFactory, SoftDeletes;

/**
     * @var array<int, string> The attributes that are mass assignable.
     */
protected $fillable = [
'user_id',
'salesman_name',
'first_contact_date',
'subject_name',
'contact_person',
'contact_email',
'contact_phone',
'contact_other',
'location',
'source_channel',
'source_url',
'description',
'priority',
'status',
'last_contact_date',
'next_step',
'rejection_reason'
    ];

/**
     * @var array<string, string> The attributes that should be cast to native types.
     */
protected $casts = [
'first_contact_date' => 'date',
'last_contact_date'  => 'date',
'created_at'         => 'datetime',
'updated_at'         => 'datetime',
'deleted_at'         => 'datetime',
    ];

/**
     * Get the user (salesman) assigned to this lead.
     * * @return BelongsTo
     */
public function user(): BelongsTo
    {
return $this->belongsTo(User::class, 'user_id');
    }

/**
     * Get the sales orders derived from this lead.
     * * @return HasMany
     */
public function orders(): HasMany
    {
return $this->hasMany(WebSalesOrder::class, 'lead_id');
    }

/**
     * @description Vrátí existující public_token, nebo pokud ještě neexistuje, vygeneruje
     *              nový, ověří jeho unikátnost proti DB a uloží.
     * @return string Platný, unikátní public_token pro tento lead.
     * @note Str::random(40) používá kryptograficky bezpečný generátor (random_bytes pod
     *       kapotou) - token není odvozený od `id` ani od jiného předvídatelného vstupu,
     *       takže ho nejde uhodnout ani postupně projíždět jako sekvenční ID.
     */
public function getOrCreatePublicToken(): string
    {
if ($this->public_token) {
return $this->public_token;
        }

do {
$candidate = Str::random(40);
        } while (static::where('public_token', $candidate)->exists());

$this->public_token = $candidate;
$this->save();

return $this->public_token;
    }
}