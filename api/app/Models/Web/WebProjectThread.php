<?php
/**
 * @file WebProjectThread.php
 * @path app/Models/Web/WebProjectThread.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description One conversation thread within a project - bidirectional (customer
 * and admin can both post multiple messages) per consultation. `last_message_at` is
 * denormalized for cheap sorting in both the admin's cross-project table and the
 * customer's per-project thread list.
 *
 * (Earlier refactor-note for customer_last_read_at unread tracking is unchanged.)
 *
 * @refactor-note (2026-09-11v4) BACKLOG "otevření vlákna ukazuje nejstarší zprávu
 * místo nejnovější / vlákno s 1000 zprávami nemá načítat všechny najednou":
 * `pagedMessages()` - vrací jen POSLEDNÍCH `$limit` zpráv (výchozí otevření vlákna),
 * nebo zprávy STARŠÍ než `$beforeId` (tlačítko "Načíst starší zprávy" ve frontendu).
 * `messages()` relace samotná ZŮSTÁVÁ beze změny (pořadí `orderBy('created_at')` asc) -
 * `pagedMessages()` na ní volá `reorder()` (zruší zděděné řazení) a řadí sestupně přes
 * `id` (levnější index než `created_at` a při shodném timestampu deterministické),
 * pak vrácenou dávku otočí zpět do vzestupného pořadí pro zobrazení.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

class WebProjectThread extends Model
{
    public const STATUSES = ['active', 'closed'];

    /** @description Default počet zpráv natažených při otevření vlákna - viz `pagedMessages()`. */
    public const DEFAULT_MESSAGE_PAGE_SIZE = 50;

    protected $fillable = [
        'project_id',
        'subject',
        'priority',
        'status',
        'opened_by',
        'last_message_at',
        'customer_last_read_at',
    ];

    protected $casts = [
        'last_message_at'       => 'datetime',
        'customer_last_read_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(WebProject::class, 'project_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(WebProjectThreadMessage::class, 'thread_id')->orderBy('created_at');
    }

    /**
     * @description Returns a page of messages, oldest-first (ready for display) -
     * either the LATEST `$limit` messages (when `$beforeId` is null - the normal
     * "open thread" case), or the `$limit` messages immediately older than
     * `$beforeId` (the "load older messages" case, `$beforeId` = id of the currently
     * oldest-loaded message on the frontend).
     * @return array{0: Collection<int, WebProjectThreadMessage>, 1: bool} [$messages, $hasMoreOlder]
     */
    public function pagedMessages(?int $beforeId, int $limit = self::DEFAULT_MESSAGE_PAGE_SIZE): array
    {
        $query = $this->messages()->with('attachments')->reorder()->orderByDesc('id');

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
 * `WebProjectPublicController::newMessages()`). Deliberately NOT paginated/limited -
 * in practice this returns 0-2 messages per poll (15s interval), never a large batch.
 */
public function newerMessages(int $afterId): \Illuminate\Support\Collection
{
    return $this->messages()->with('attachments')->where('id', '>', $afterId)->orderBy('id')->get();
}
}