<?php
/**
 * @file SalesLead.php
 * @path app/Apps/ProjectPortal/Models/SalesLead.php
 * @project JS web-platform
 * @author JS
 * @created 2025
 * @description Sales lead of the project portal (table project_portal_sales_leads): a potential
 *   client, the salesman and the progress of the contact; the public link to the order form
 *   (`public_token`) turns it into an order (SalesOrder), the order into a project.
 */

namespace App\Apps\ProjectPortal\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use App\Models\User;

/**
 * @description Manages potential client interactions, tracking contact progress and lead status.
 * @property int $id Unique identifier.
 * @property string|null $public_token Unguessable token of the public link to the order form.
 * @property \Illuminate\Support\Carbon|null $public_token_expires_at End of the validity of the
 *   link (PUBLIC_TOKEN_TTL_DAYS after it was last sent); null only for links used before the expiry existed.
 * @property int $user_id The salesman assigned to the lead.
 */
class SalesLead extends Model
{
use SoftDeletes;

    /** @var string The table of the model. */
    protected $table = 'project_portal_sales_leads';

    /**
     * @description Validity of the public order form link in days (GDPR / VT-10): a forwarded or
     * forgotten link must not show the contact data forever. Every "generate link" in the admin
     * starts the period again; an expired link is replaced by a new one.
     */
    public const PUBLIC_TOKEN_TTL_DAYS = 30;

    /**
     * @description Personal data: the audit log notes that these attributes changed, never their
     *   values (App\Support\Audit\ModelChanges) - an erased / purged record leaves no copy in the logs.
     */
    public const AUDIT_MASKED = ['contact_person', 'contact_email', 'contact_phone', 'contact_other', 'description', 'next_step', 'rejection_reason'];

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
'public_token_used_at'    => 'datetime',
'public_token_expires_at' => 'datetime',
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
return $this->hasMany(SalesOrder::class, 'lead_id');
    }

/**
     * @description Whether the public link has expired (a link without an expiry - used before
     *              the expiry existed - never expires).
     * @return bool
     */
    public function publicTokenExpired(): bool
    {
        return $this->public_token_expires_at !== null && $this->public_token_expires_at->isPast();
    }

/**
     * @description Returns the public_token of the lead for (re)sending the link: an unused link
     *              gets PUBLIC_TOKEN_TTL_DAYS of validity from now; a missing or expired unused
     *              token is replaced by a new unique one. A used link stays as it is (one order
     *              per lead - the form tells the customer it was already sent).
     * @return string A unique public_token of this lead.
     * @note Str::random(40) uses a cryptographically secure generator (random_bytes) - the token
     *       is not derived from `id` or any predictable input, so it cannot be guessed or
     *       enumerated like a sequential ID.
     */
public function getOrCreatePublicToken(): string
    {
if ($this->public_token && $this->public_token_used_at) {
return $this->public_token;
        }

if (!$this->public_token || $this->publicTokenExpired()) {
do {
$candidate = Str::random(40);
            } while (static::where('public_token', $candidate)->exists());

$this->public_token = $candidate;
        }

$this->public_token_expires_at = now()->addDays(self::PUBLIC_TOKEN_TTL_DAYS);
$this->save();

return $this->public_token;
    }
}