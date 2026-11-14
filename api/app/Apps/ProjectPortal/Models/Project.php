<?php
/**
 * @file Project.php
 * @path app/Apps/ProjectPortal/Models/Project.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Core entity of the customer project portal - can originate from an order of the
 * portal (`order_id`, or its lead `lead_id`) or be created standalone by an admin; both paths
 * result in an identical row here.
 * @property string $access_token Permanent, plaintext, unguessable public URL id -
 * see migration for the security rationale (like the public token of a sales lead). The secret of
 * a sign-in is the password of a client account (ProjectAccount), set by the administration.
 * @property string $visibility 'public' | 'private' - checked on EVERY public
 * request by `ProjectPublicController`, not just at login.
 * @property int|null $assignee_id Administrator responsible for the project - gets the e-mails
 * about client activity (else the project's contact e-mail).
 */

namespace App\Apps\ProjectPortal\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Builder;
use App\Models\User;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;

class Project extends Model
{
    /** @description Database table of the model. */
    protected $table = 'project_portal_projects';

    use SoftDeletes;

    /**
     * @description Personal data: the audit log notes that these attributes changed, never their
     *   values (App\Support\Audit\ModelChanges) - an erased / purged record leaves no copy in the logs.
     */
    public const AUDIT_MASKED = ['contact_phone', 'contact_email'];

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
        'assignee_id',
    ];

    protected $casts = [
        'estimated_completion_from' => 'date',
        'estimated_completion_to'   => 'date',
        'created_at'                => 'datetime',
        'updated_at'                => 'datetime',
        'deleted_at'                => 'datetime',
    ];

    public const STATUSES = ['new', 'development', 'finished'];

    /** @description Permission an administrator needs to be assignable to a project. */
    public const ASSIGNEE_PERMISSION = 'project-portal-projects-update';

    /**
     * @description Validation of the origin of a project (sales lead / order). An order has at
     *   most one project.
     * @param int|null $ignoreProjectId Project being updated (its own order is not "taken").
     * @return array<string, array<int, mixed>>
     */
    public static function originRules(?int $ignoreProjectId = null): array
    {
        return [
            'lead_id'  => ['nullable', 'integer', Rule::exists(SalesLead::class, 'id')],
            'order_id' => ['nullable', 'integer', Rule::exists(SalesOrder::class, 'id'), Rule::unique(self::class, 'order_id')->ignore($ignoreProjectId)],
        ];
    }

    /** @description Order the project was created from (null for a standalone project). */
    public function order(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class, 'order_id');
    }

    public function checkpoints(): HasMany
    {
        return $this->hasMany(ProjectCheckpoint::class, 'project_id')->orderBy('sort_order');
    }

    public function threads(): HasMany
    {
        return $this->hasMany(ProjectThread::class, 'project_id')->orderByDesc('last_message_at');
    }

    /**
     * @description Messages of all threads of the project (for the unread counts).
     * @return HasManyThrough
     */
    public function threadMessages(): HasManyThrough
    {
        return $this->hasManyThrough(ProjectThreadMessage::class, ProjectThread::class, 'project_id', 'thread_id');
    }

    /**
     * @description Adds `unread_messages_count`: client messages in the project's threads the
     *   administration has not read yet (ProjectThread::unreadByAdmin()).
     * @param \Illuminate\Database\Eloquent\Builder $query Project query.
     * @return void
     */
    public function scopeWithUnreadMessagesCount($query): void
    {
        $query->withCount(['threadMessages as unread_messages_count' => ProjectThread::unreadByAdmin()]);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(ProjectSession::class, 'project_id');
    }

    /**
     * @description Client accounts of the portal (oldest first).
     * @return HasMany
     */
    public function updates(): HasMany
    {
        return $this->hasMany(ProjectUpdate::class, 'project_id')->orderByDesc('id');
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(ProjectApproval::class, 'project_id')->orderByDesc('id');
    }

    public function accounts(): HasMany
    {
        return $this->hasMany(ProjectAccount::class, 'project_id')->orderBy('id');
    }

    /**
     * @description Administrator responsible for the project.
     * @return BelongsTo
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    /**
     * @description Administrators who can be responsible for a project: active (not blocked)
     *   accounts of the sysadmin role or with the update permission of projects (from a role or
     *   granted directly) - the people who can answer the client.
     * @return Builder<User>
     */
    public static function assignableUsers(): Builder
    {
        $hasPermission = fn (Builder $q) => $q->where('permission_key', self::ASSIGNEE_PERMISSION);

        return User::query()
            ->where('is_blocked', false)
            ->where(fn (Builder $q) => $q
                ->whereHas('roles', fn (Builder $r) => $r->where(fn (Builder $w) => $w->where('role_name', 'sysadmin')->orWhereHas('permissions', $hasPermission)))
                ->orWhereHas('explicitPermissions', $hasPermission))
            ->orderBy('full_name');
    }

    /**
     * @description Adds `waiting_threads_count`: open threads whose last visible message is the
     *   client's - the administration owes an answer.
     * @param Builder $query Project query.
     * @return void
     */
    public function scopeWithWaitingThreadsCount($query): void
    {
        $query->withCount(['threads as waiting_threads_count' => fn ($q) => $q->where('status', 'active')->where('last_public_author', 'customer')]);
    }

    /**
     * @description Generates a fresh, unguessable permanent access token for the
     * public URL. Called exactly once at project creation - see
     * ProjectController::store() in a later phase. Loops on the (astronomically
     * unlikely) chance of a collision rather than trusting uniqueness blindly.
     */
    public static function generateAccessToken(): string
    {
        do {
            $token = Str::random(48);
        } while (self::withTrashed()->where('access_token', $token)->exists());

        return $token;
    }
}
