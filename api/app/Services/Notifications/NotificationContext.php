<?php
/**
 * @file NotificationContext.php
 * @path app/Services/Notifications/NotificationContext.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description What a NotificationSource needs to build the kinds of its module for one admin:
 * the permission check (view permission of the page + tab permission of the module, the sysadmin
 * sees everything - the same rule as the calendar agenda), the admin's last look at every kind
 * and the shape of one kind. A kind the admin has never looked at starts now (it is remembered by
 * CoreNotificationController), so a new account or a new kind does not flood the menu with old
 * records.
 * @dependencies none (Eloquent / query builders of the sources)
 */

namespace App\Services\Notifications;

use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;

final class NotificationContext
{
    /** @description Allowed form of a kind key (stored in core_notification_marks.kind). */
    public const KIND_PATTERN = '/^[a-z][a-z0-9_]{0,63}$/';

    /** @var array<int, string> Kinds without a last look that this context returned. */
    private array $firstLooks = [];

    /**
     * @param string $module Module of the kinds ('core' or an application id).
     * @param string $tabPermission Tab permission of the module.
     * @param array<int, string>|null $permissions Permission keys of the user (null = sysadmin).
     * @param array<string, Carbon> $seen Last look of the user at every kind (kind => time).
     * @param Carbon $now Time of the request (the start of a kind without a last look).
     */
    public function __construct(
        private readonly string $module,
        private readonly string $tabPermission,
        private readonly ?array $permissions,
        private readonly array $seen,
        private readonly Carbon $now,
    ) {
    }

    /**
     * @description Module of the kinds.
     * @return string
     */
    public function module(): string
    {
        return $this->module;
    }

    /**
     * @description May the user see the admin page with this view permission?
     * @param string $permission View permission key of the page.
     * @return bool
     */
    public function can(string $permission): bool
    {
        return $this->permissions === null
            || (in_array($this->tabPermission, $this->permissions, true) && in_array($permission, $this->permissions, true));
    }

    /**
     * @description Since when the records of a kind are unread for the user: the last look, or
     *   now for a kind the user has never looked at (remembered as a first look).
     * @param string $kind Kind key.
     * @return Carbon
     */
    public function since(string $kind): Carbon
    {
        if (isset($this->seen[$kind])) {
            return $this->seen[$kind];
        }
        $this->firstLooks[] = $kind;

        return $this->now;
    }

    /**
     * @description Kinds this context returned that the user has never looked at.
     * @return array<int, string>
     */
    public function firstLooks(): array
    {
        return array_values(array_unique($this->firstLooks));
    }

    /**
     * @description A kind whose unread records are the ones with a time column after the last
     *   look (new inquiries, new orders …).
     * @param string $kind Kind key (KIND_PATTERN, unique over all sources).
     * @param string $link Admin page of the records (opening it marks the kind as seen).
     * @param Builder|QueryBuilder $query Records of the kind.
     * @param string $column Time column of the arrival of a record.
     * @return array{kind: string, module: string, link: string, count: int}
     */
    public function created(string $kind, string $link, Builder|QueryBuilder $query, string $column = 'created_at'): array
    {
        return $this->counted($kind, $link, fn (Carbon $since) => (clone $query)->where($column, '>', $since)->count());
    }

    /**
     * @description A kind that asks for the admin's attention until something is done - not
     *   "unread since the last look": the count is the current state (e.g. texts missing in a
     *   language), opening the page does not clear it, it drops to 0 when the work is done. The
     *   menu shows it in orange (an unread kind in red wins in a shared badge).
     * @param string $kind Kind key (KIND_PATTERN, unique over all sources).
     * @param string $link Admin page where the work is done.
     * @param int $count Things needing attention now.
     * @param array<string, int> $languages Optional split of the count per language (texts missing
     *   in a language - the badge tells which one); left out of the answer when empty.
     * @return array{kind: string, module: string, link: string, count: int, attention: true, languages?: array<string, int>}
     */
    public function attention(string $kind, string $link, int $count, array $languages = []): array
    {
        $entry = ['kind' => $kind, 'module' => $this->module, 'link' => $link, 'count' => max(0, $count), 'attention' => true];
        if ($languages !== []) {
            $entry['languages'] = $languages;
        }

        return $entry;
    }

    /**
     * @description A kind with its own rule of what is unread (e.g. leads that became overdue
     *   after the last look).
     * @param string $kind Kind key (KIND_PATTERN, unique over all sources).
     * @param string $link Admin page of the records.
     * @param Closure(Carbon): int $count Number of unread records since the given time.
     * @return array{kind: string, module: string, link: string, count: int}
     */
    public function counted(string $kind, string $link, Closure $count): array
    {
        return ['kind' => $kind, 'module' => $this->module, 'link' => $link, 'count' => (int) $count($this->since($kind))];
    }
}
