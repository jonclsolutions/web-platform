<?php
/**
 * @file WebProject.php
 * @path app/Models/Web/WebProject.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Core entity of the customer project portal - can originate from a
 * `WebSalesOrder` (or its originating `WebSalesLead`) or be created standalone by an
 * admin; both paths result in an identical row here (see backlog task).
 * @property string $access_token Permanent, plaintext, unguessable public URL id -
 * see migration for the security rationale (mirrors `WebSalesLead::public_token`).
 * @property string $access_password_hash Bcrypt hash - the actual secret. Never
 * customer-changeable; regenerated exclusively by an admin.
 * @property string $visibility 'public' | 'private' - checked on EVERY public
 * request by `WebProjectPublicController`, not just at login.
 *
 * @refactor-note (2026-09-11) BACKLOG "project portal - odhad termínu dokončení":
 * `estimated_completion_from`/`estimated_completion_to` - ZÁMĚRNĚ rozptyl, ne jedno
 * pevné datum. Vývoj může kolabovat na neočekávané chybě/blockeru, jeden natvrdo
 * slíbený termín by byl zavádějící. Obě pole nullable - projekt beze zadaného odhadu
 * prostě zákazníkovi žádný termín nezobrazí (frontend to řeší podmínkou).
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class WebProject extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'lead_id',
        'order_id',
        'name',
        'description',
        'platform',
        'project_lead',
        'contact_phone',
        'contact_email',
        'technologies',
        'estimated_completion_from',
        'estimated_completion_to',
        'visibility',
        'status',
    ];

    protected $hidden = [
        'access_password_hash',
    ];

    protected $casts = [
        'password_generated_at'     => 'datetime',
        'estimated_completion_from' => 'date',
        'estimated_completion_to'   => 'date',
        'created_at'                => 'datetime',
        'updated_at'                => 'datetime',
        'deleted_at'                => 'datetime',
    ];

    public const STATUSES = ['new', 'development', 'finished'];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(WebSalesLead::class, 'lead_id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(WebSalesOrder::class, 'order_id');
    }

    public function checkpoints(): HasMany
    {
        return $this->hasMany(WebProjectCheckpoint::class, 'project_id')->orderBy('sort_order');
    }

    public function threads(): HasMany
    {
        return $this->hasMany(WebProjectThread::class, 'project_id')->orderByDesc('last_message_at');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(WebProjectSession::class, 'project_id');
    }

    /**
     * @description Generates a fresh, unguessable permanent access token for the
     * public URL. Called exactly once at project creation - see
     * WebProjectController::store() in a later phase. Loops on the (astronomically
     * unlikely) chance of a collision rather than trusting uniqueness blindly.
     */
    public static function generateAccessToken(): string
    {
        do {
            $token = Str::random(48);
        } while (self::withTrashed()->where('access_token', $token)->exists());

        return $token;
    }

    /**
     * @description Sets a brand-new access password (bcrypt-hashed) and returns the
     * PLAINTEXT value so the caller (admin controller) can display/relay it to the
     * customer exactly once - it is never recoverable again afterwards, consistent
     * with how real user passwords are handled everywhere else in the app.
     */
    public function regeneratePassword(): string
    {
        $plaintext = Str::password(14, symbols: false);
        $this->access_password_hash = Hash::make($plaintext);
        $this->password_generated_at = now();
        $this->save();

        return $plaintext;
    }

    public function verifyPassword(string $plaintext): bool
    {
        return Hash::check($plaintext, $this->access_password_hash);
    }
}