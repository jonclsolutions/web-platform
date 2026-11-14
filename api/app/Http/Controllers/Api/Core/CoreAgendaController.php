<?php

/**
 * @file CoreAgendaController.php
 * @path app/Http/Controllers/Api/Core/CoreAgendaController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Agenda of the admin calendar (admin: core/calendar) - read only. Collects the
 * dates and the open work the admin already holds from the agenda sources of the core
 * (CoreAgendaSource) and of every registered application (AppManifest::agendaSources(), e.g.
 * project deadlines, lead follow-ups, coupons - events; new applicants, orders to process -
 * reminders), plus the personal events of the logged-in admin (own reminders / notes,
 * CoreCalendarEventController) - only the own ones, an open one in the past is overdue.
 * Every entry is returned only to a user with the view permission of its admin page AND the tab
 * permission of its module (AgendaContext; the sysadmin role sees all) - the page itself needs no
 * permission. `modules` lists the modules the user may see (the page shows the filter only for
 * them). Only what the calendar shows is returned (ids, short names, dates), never personal
 * details such as e-mails of applicants.
 * @note The texts are composed by the admin page (type + subject) in the admin language.
 * @dependencies AgendaSource / AgendaContext, AppRegistry, CoreCalendarEvent, App\Models\User.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreCalendarEvent;
use App\Services\Agenda\AgendaContext;
use App\Services\Agenda\AgendaSource;
use App\Services\Agenda\CoreAgendaSource;
use App\Support\Apps\AppRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CoreAgendaController extends Controller
{
    /** @description Longest range of one request (6 weeks of a month view + margin). */
    private const MAX_RANGE_DAYS = 62;

    /** @description Tab permission of the core module (frontend CORE_TAB_PERMISSION). */
    private const CORE_TAB_PERMISSION = 'view-core';

    /**
     * @description Events of the range and the current reminders the user may see.
     * @param Request $request from, to (YYYY-MM-DD; at most MAX_RANGE_DAYS apart).
     * @return JsonResponse { data: { today, modules: ['personal', <application ids>…, 'core'],
     *   events: [{ id, type, module, date, subject, link, severity, personal? }],
     *   reminders: [{ type, module, count, since, link }] } } - personal
     *   events have module 'personal', link null and `personal` (personalEvent()).
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['required', 'date_format:Y-m-d'],
            'to'   => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $from = Carbon::createFromFormat('Y-m-d', $validated['from'])->startOfDay();
        $to = Carbon::createFromFormat('Y-m-d', $validated['to'])->endOfDay();
        if ($from->diffInDays($to) > self::MAX_RANGE_DAYS) {
            return response()->json(['message' => 'The range may have at most ' . self::MAX_RANGE_DAYS . ' days.', 'errors' => ['to' => ['The range is too long.']]], 422);
        }

        $user = $request->user();
        $permissions = $user->roles()->where('role_name', 'sysadmin')->exists() ? null : ($user->permissions ?? []);
        $modules = ['personal'];
        $events = collect();
        $reminders = [];
        foreach ($this->sources($permissions) as [$agenda, $source]) {
            /** @var AgendaContext $agenda */
            /** @var AgendaSource $source */
            if (!collect($source->permissions())->contains(fn (string $key) => $agenda->can($key))) {
                continue;
            }
            if (!in_array($agenda->module(), $modules, true)) {
                $modules[] = $agenda->module();
            }
            $events = $events->merge($source->events($agenda, $from, $to));
            array_push($reminders, ...$source->reminders($agenda));
        }

        return $this->respond([
            'today'     => now()->toDateString(),
            'modules'   => $modules,
            'events'    => $events
                ->merge(CoreCalendarEvent::where('user_id', $user->id)->whereBetween('date', [$from->toDateString(), $to->toDateString()])
                    ->orderBy('time')->limit(AgendaContext::MAX_EVENTS_PER_SOURCE)->get()->map(fn ($event) => self::personalEvent($event)))
                ->sortBy([['date', 'asc'], ['type', 'asc']])->values()->all(),
            'reminders' => $reminders,
        ]);
    }

    /**
     * @description The agenda sources in calendar order: every registered application, then the
     *   core - each with the context of its module.
     * @param array<int, string>|null $permissions Permission keys of the user (null = sysadmin).
     * @return array<int, array{0: AgendaContext, 1: AgendaSource}>
     */
    private function sources(?array $permissions): array
    {
        $sources = [];
        foreach (AppRegistry::agendaSources() as [$app, $source]) {
            $sources[] = [new AgendaContext($app->id(), $app->tabPermission(), $permissions), $source];
        }
        $sources[] = [new AgendaContext('core', self::CORE_TAB_PERMISSION, $permissions), app(CoreAgendaSource::class)];

        return $sources;
    }

    /**
     * @description A personal event in the shape of the agenda.
     * @param CoreCalendarEvent $event Own event.
     * @return array{id: string, type: string, module: string, date: string, subject: string,
     *   link: null, severity: string, personal: array{id: int, time: string|null, note: string|null, done: bool}}
     */
    public static function personalEvent(CoreCalendarEvent $event): array
    {
        $date = $event->date->toDateString();

        return [
            'id'       => "personal-{$event->id}",
            'type'     => 'personal',
            'module'   => 'personal',
            'date'     => $date,
            'subject'  => $event->title,
            'link'     => null,
            'severity' => !$event->is_done && $date < now()->toDateString() ? 'danger' : 'info',
            'personal' => [
                'id'   => $event->id,
                'time' => $event->time ? substr((string) $event->time, 0, 5) : null,
                'note' => $event->note,
                'done' => (bool) $event->is_done,
            ],
        ];
    }
}
