<?php
/**
 * @file AgendaContext.php
 * @path app/Services/Agenda/AgendaContext.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description What an AgendaSource gets from the admin calendar: the permission check of the
 * signed-in user for its module (view permission of the page AND the tab permission of the
 * module, the sysadmin role sees everything) and builders of the calendar entries in the shape
 * the admin page expects (only ids, short names and dates - never personal details).
 * @dependencies none
 */

namespace App\Services\Agenda;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;

final class AgendaContext
{
    /** @description Most events of one kind in one answer (protection against huge answers). */
    public const MAX_EVENTS_PER_SOURCE = 300;

    /**
     * @param string $module Module of the entries ('core' or an application id).
     * @param string $tabPermission Tab permission of the module.
     * @param array<int, string>|null $permissions Permission keys of the user (null = sysadmin).
     */
    public function __construct(
        private readonly string $module,
        private readonly string $tabPermission,
        private readonly ?array $permissions,
    ) {
    }

    /**
     * @description Module of the entries.
     * @return string
     */
    public function module(): string
    {
        return $this->module;
    }

    /**
     * @description May the user see entries of the admin page with this view permission?
     * @param string $permission View permission key of the page.
     * @return bool
     */
    public function can(string $permission): bool
    {
        return $this->permissions === null
            || (in_array($this->tabPermission, $this->permissions, true) && in_array($permission, $this->permissions, true));
    }

    /**
     * @description One dated event.
     * @param string $type Kind of the event (translated by the admin page).
     * @param string $id Id of the record (unique within the kind).
     * @param Carbon $date Day of the event.
     * @param string $subject Short name shown in the calendar.
     * @param string $link Admin page of the record.
     * @param string $severity info | warning | danger.
     * @return array{id: string, type: string, module: string, date: string, subject: string, link: string, severity: string}
     */
    public function event(string $type, string $id, Carbon $date, string $subject, string $link, string $severity = 'info'): array
    {
        return [
            'id' => "{$type}-{$id}", 'type' => $type, 'module' => $this->module, 'date' => $date->toDateString(),
            'subject' => $subject, 'link' => $link, 'severity' => $severity,
        ];
    }

    /**
     * @description One kind of open work - counted; null when there is none.
     * @param string $type Kind of the reminder (translated by the admin page).
     * @param string $link Admin page of the work.
     * @param Builder|QueryBuilder $query Records of the work (Eloquent or a plain table query).
     * @param string|null $dateColumn Column of the start of an item (`since` = the oldest); null
     *   for a state without a start (e.g. low stock).
     * @return array{type: string, module: string, count: int, since: string|null, link: string}|null
     */
    public function reminder(string $type, string $link, Builder|QueryBuilder $query, ?string $dateColumn = 'created_at'): ?array
    {
        $count = (clone $query)->count();
        if ($count === 0) {
            return null;
        }
        $oldest = $dateColumn ? (clone $query)->min($dateColumn) : null;

        return [
            'type' => $type, 'module' => $this->module, 'count' => $count, 'link' => $link,
            'since' => $oldest ? Carbon::parse($oldest)->toDateString() : null,
        ];
    }
}
