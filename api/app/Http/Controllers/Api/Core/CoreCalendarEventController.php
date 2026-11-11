<?php

/**
 * @file CoreCalendarEventController.php
 * @path app/Http/Controllers/Api/Core/CoreCalendarEventController.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Personal events of the admin calendar (core/calendar) - own reminders and notes of
 * the logged-in admin: create, edit (also done / not done) and delete. Every query is scoped to
 * the owner, like the personal external links; another user's ID gives 404. No permission is
 * needed (own data, like the personal info). The calendar reads them with the agenda
 * (CoreAgendaController).
 * @note The audit log records the action and the ID only - never the title or the note (private
 * texts of the admin).
 * @dependencies CoreCalendarEvent, CoreLog (audit log).
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Models\Core\CoreCalendarEvent;
use App\Models\Core\CoreLog;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CoreCalendarEventController extends Controller
{
    use LogsActivity;

    /** @description Most personal events of one admin (protection against flooding the table). */
    public const MAX_EVENTS_PER_USER = 1000;

    /** @description Request keys never copied into the audit log. */
    private const PRIVATE_KEYS = ['title', 'note'];

    /**
     * @description Creates a personal event of the logged-in admin.
     * @param Request $request { date, time?, title, note?, is_done? }
     * @return JsonResponse 201 the event (as CoreAgendaController::personalEvent()); 422 invalid /
     *   too many events.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $user = $request->user();
        if (CoreCalendarEvent::where('user_id', $user->id)->count() >= self::MAX_EVENTS_PER_USER) {
            return response()->json(['message' => 'You have too many personal events. Delete old ones first.'], 422);
        }

        $event = new CoreCalendarEvent($data);
        $event->user_id = $user->id;
        $event->save();

        $this->logAction($request, CoreLog::class, 'create', 'CoreCalendarEvent', "Created personal calendar event #{$event->id}", $event->id, 'CoreCalendarEvent', self::PRIVATE_KEYS);

        return $this->respond(CoreAgendaController::personalEvent($event), 201);
    }

    /**
     * @description Changes an own personal event (any of its fields, e.g. only is_done).
     * @param Request $request { date?, time?, title?, note?, is_done? }
     * @param string $id Event ID.
     * @return JsonResponse 200 the event; 404 not an own event; 422 invalid.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $event = $this->own($request, $id);
        $event->fill($this->validated($request, $event))->save();

        $this->logAction($request, CoreLog::class, 'update', 'CoreCalendarEvent', "Updated personal calendar event #{$event->id}", $event->id, 'CoreCalendarEvent', self::PRIVATE_KEYS);

        return $this->respond(CoreAgendaController::personalEvent($event));
    }

    /**
     * @description Deletes an own personal event.
     * @param Request $request
     * @param string $id Event ID.
     * @return JsonResponse 204; 404 not an own event.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $event = $this->own($request, $id);
        $event->delete();

        $this->logAction($request, CoreLog::class, 'delete', 'CoreCalendarEvent', "Deleted personal calendar event #{$id}", (int) $id, 'CoreCalendarEvent');

        return response()->json(null, 204);
    }

    /**
     * @description Own event of the logged-in admin (404 for a foreign or unknown ID).
     * @param Request $request
     * @param string $id Event ID.
     * @return CoreCalendarEvent
     */
    private function own(Request $request, string $id): CoreCalendarEvent
    {
        abort_unless(ctype_digit($id), 404);

        return CoreCalendarEvent::where('user_id', $request->user()->id)->findOrFail((int) $id);
    }

    /**
     * @description Validated and cleaned fields: title one line, note multi-line, both plain text
     *   (tags removed); time HH:MM or null (all day).
     * @param Request $request
     * @param CoreCalendarEvent|null $event Edited event (fields optional) or null (create).
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?CoreCalendarEvent $event = null): array
    {
        $required = $event ? 'sometimes' : 'required';
        $data = $request->validate([
            'date'    => [$required, 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2100-12-31'],
            'time'    => ['sometimes', 'nullable', 'date_format:H:i'],
            'title'   => [$required, 'string', 'max:150'],
            'note'    => ['sometimes', 'nullable', 'string', 'max:1000'],
            'is_done' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('title', $data)) {
            $data['title'] = trim((string) preg_replace('/\s+/u', ' ', strip_tags($data['title'])));
            if ($data['title'] === '') {
                abort(response()->json(['message' => 'The title is required.', 'errors' => ['title' => ['The title is required.']]], 422));
            }
        }
        if (array_key_exists('note', $data)) {
            $note = trim(str_replace(["\r\n", "\r"], "\n", strip_tags((string) $data['note'])));
            $data['note'] = $note === '' ? null : $note;
        }

        return $data;
    }
}
