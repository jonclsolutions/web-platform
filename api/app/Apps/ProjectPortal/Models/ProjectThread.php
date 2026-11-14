<?php
/**
 * @file ProjectThread.php
 * @path app/Apps/ProjectPortal/Models/ProjectThread.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description One conversation thread within a project - bidirectional (customer
 * and admin can both post multiple messages) per consultation. `last_message_at` is
 * denormalized for cheap sorting in both the admin's cross-project table and the
 * customer's per-project thread list. `last_public_author` (author of the last message the client
 * can see) gives `waitingOn()`: whose turn it is in an open thread. Internal notes of the
 * administration (`is_internal` messages) never change it and never reach the client.
 */

namespace App\Apps\ProjectPortal\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

class ProjectThread extends Model
{
    /** @description Database table of the model. */
    protected $table = 'project_portal_project_threads';

    public const STATUSES = ['active', 'closed'];

    /** @description Who owes the next answer in an open thread - see `waitingOn()`. */
    public const WAITING_ON_SUPPLIER = 'supplier';
    public const WAITING_ON_CUSTOMER = 'customer';

    /** @description Default number of messages loaded when a thread is opened - see `pagedMessages()`. */
    public const DEFAULT_MESSAGE_PAGE_SIZE = 50;

    protected $fillable = [
        'project_id',
        'subject',
        'priority',
        'status',
        'assignee_id',
        'opened_by',
        'last_public_author',
        'last_message_at',
        'customer_last_read_at',
        'admin_last_read_at',
    ];

    protected $casts = [
        'last_message_at'       => 'datetime',
        'customer_last_read_at' => 'datetime',
        'admin_last_read_at'    => 'datetime',
    ];

    /**
     * @description Condition of a client message the administration has not read yet: written by
     *   the customer after the thread's `admin_last_read_at` (any, when never read). For queries on
     *   project_portal_project_thread_messages joined with / nested in project_portal_project_threads.
     * @return \Closure(\Illuminate\Database\Eloquent\Builder): void
     */
    public static function unreadByAdmin(): \Closure
    {
        return function ($query): void {
            $query->where('project_portal_project_thread_messages.author_type', 'customer')
                ->where(fn ($w) => $w->whereNull('project_portal_project_threads.admin_last_read_at')
                    ->orWhereColumn('project_portal_project_thread_messages.created_at', '>', 'project_portal_project_threads.admin_last_read_at'));
        };
    }

    /**
     * @description Adds `admin_unread_count` (client messages the administration has not read).
     * @param \Illuminate\Database\Eloquent\Builder $query Thread query.
     * @return void
     */
    public function scopeWithAdminUnreadCount($query): void
    {
        $query->withCount(['messages as admin_unread_count' => self::unreadByAdmin()]);
    }

    /**
     * @description Marks the thread read by the administration (opened or answered by an admin);
     *   no change of `updated_at`.
     * @return void
     */
    public function markReadByAdmin(): void
    {
        $this->timestamps = false;
        $this->update(['admin_last_read_at' => now()]);
        $this->timestamps = true;
    }

    /**
     * @description Administrator responsible for the thread (notifications about it go to them).
     * @return BelongsTo
     */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'assignee_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ProjectThreadMessage::class, 'thread_id')->orderBy('created_at');
    }

    /**
     * @description Messages the client may see (no internal notes) - the only messages the client
     *   portal loads.
     * @return HasMany
     */
    public function clientMessages(): HasMany
    {
        return $this->messages()->visibleToClient();
    }

    /**
     * @description Whose turn it is: 'supplier' when the client wrote last (the administration owes
     *   an answer), 'customer' when the administration did; null for a closed thread or a thread
     *   without a visible message.
     * @return string|null
     */
    public function waitingOn(): ?string
    {
        if ($this->status !== 'active') {
            return null;
        }

        return match ($this->last_public_author) {
            'customer' => self::WAITING_ON_SUPPLIER,
            'admin'    => self::WAITING_ON_CUSTOMER,
            default    => null,
        };
    }

    /**
     * @description Returns a page of messages, oldest-first (ready for display) -
     * either the LATEST `$limit` messages (when `$beforeId` is null - the normal
     * "open thread" case), or the `$limit` messages immediately older than
     * `$beforeId` (the "load older messages" case, `$beforeId` = id of the currently
     * oldest-loaded message on the frontend). Internal notes only for the administration.
     * @param int|null $beforeId Id of the oldest loaded message (null = the newest page).
     * @param int $limit Page size.
     * @param bool $withInternal Include internal notes (administration only - never the portal).
     * @return array{0: Collection<int, ProjectThreadMessage>, 1: bool} [$messages, $hasMoreOlder]
     */
    public function pagedMessages(?int $beforeId, int $limit = self::DEFAULT_MESSAGE_PAGE_SIZE, bool $withInternal = false): array
    {
        $query = ($withInternal ? $this->messages() : $this->clientMessages())->with('attachments')->reorder()->orderByDesc('id');

        if ($beforeId) {
            $query->where('id', '<', $beforeId);
        }

        $rows = $query->limit($limit + 1)->get();
        $hasMore = $rows->count() > $limit;
        $messages = $rows->take($limit)->sortBy('id')->values();

        return [$messages, $hasMore];
    }
    /**
 * @description Returns messages STRICTLY NEWER than `$afterId`, oldest-first -
 * used by the customer portal's live-update polling (see
 * `ProjectPublicController::newMessages()`). Deliberately NOT paginated/limited -
 * in practice this returns 0-2 messages per poll (15s interval), never a large batch. Client
 * messages only (no internal notes).
 */
public function newerMessages(int $afterId): \Illuminate\Support\Collection
{
    return $this->clientMessages()->with('attachments')->where('id', '>', $afterId)->reorder()->orderBy('id')->get();
}
}