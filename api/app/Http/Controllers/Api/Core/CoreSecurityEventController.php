<?php
/**
 * @file CoreSecurityEventController.php
 * @path app/Http/Controllers/Api/Core/CoreSecurityEventController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Admin reading/triage of security monitoring (core_security_events).
 * Writing (`CoreSecurityEvent::record()`) happens exclusively internally from the backend (captcha,
 * throttle, scanning, ...) - this controller DOES NOT have `store()` and no public POST route,
 * unlike CoreLogController (where POST /core/logs serves for self-audit from the frontend).
 *
 * @note Without the trash/restore concept - these records are diagnostics, not a business entity
 * that makes sense to restore. Deletion (`destroy`/`purge`) is therefore directly permanent.
 *
 * @bugfix-note (2026-08-22) `update()` (triage) returns the result wrapped in `{data: ...}` -
 * frontend `DataHandler.put<T>()` (called via `EntityCrudService::update()` from
 * `BaseDataComponent.updateData()`) automatically unwraps `response.data`. `show()`
 * remains UNWRAPPED (called via `EntityCrudService::getOne()` -> `DataHandler.get<T>()`,
 * which unwraps nothing), just like `destroy()` (via `DataHandler.delete()`, which
 * doesn't type/read the returned body at all).
 *
 * @refactor-note (2026-08-22v2) AUDIT LOG: `update()` (triage), `destroy()` and
 * `purge()` now write to `core_logs` (via `LogsActivity` trait) - who and when changed
 * the status of the event, deleted an individual record, or triggered a mass purge (and how many records
 * it deleted). `store()`/writing of the events themselves (`CoreSecurityEvent::record()`) is NOT written to
 * `core_logs` - during an attack that would flood the audit log just as much as
 * unbucketed writes would flood `core_security_events` (see CoreSecurityEvent.php).
 * Only administrative ACTIONS over monitoring are logged, not the diagnostic data itself.
 */

namespace App\Http\Controllers\Api\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\CoreSecurityEvent\UpdateCoreSecurityEventRequest;
use App\Http\Resources\Core\CoreSecurityEventResource;
use App\Models\Core\CoreLog;
use App\Models\Core\CoreSecurityEvent;
use App\Models\Core\CoreSecuritySetting;
use App\Traits\LogsActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CoreSecurityEventController extends Controller
{
    use LogsActivity;

    /**
     * @description Paginated overview of security events with filters for triage.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = $request->input('per_page', 15);
        $query = CoreSecurityEvent::query();

        if ($request->filled('id')) {
            $query->where('id', $request->input('id'));
        }
        if ($request->filled('event_type')) {
            $query->where('event_type', $request->input('event_type'));
        }
        if ($request->filled('severity')) {
            $query->where('severity', $request->input('severity'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('ip_address')) {
            $query->where('ip_address', 'like', '%' . $request->input('ip_address') . '%');
        }
        if ($request->filled('date_from')) {
            $query->where('last_seen_at', '>=', $request->input('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->where('last_seen_at', '<=', $request->input('date_to'));
        }

        $sortBy = $request->input('sort_by', 'last_seen_at');
        $sortDirection = $request->input('sort_direction', 'desc');
        $query->orderBy($sortBy, $sortDirection);
$noPagination = filter_var($request->input('no_pagination', false), FILTER_VALIDATE_BOOLEAN);

    if ($noPagination) {
        return response()->json(CoreSecurityEventResource::collection($query->get()));
    }
        $data = $query->paginate($perPage);

        return response()->json([
            'data'         => CoreSecurityEventResource::collection($data->items()),
            'total'        => $data->total(),
            'per_page'     => $data->perPage(),
            'current_page' => $data->currentPage(),
            'last_page'    => $data->lastPage(),
        ]);
    }

    /**
     * @description Detail of a single security event.
     */
    public function show($id): JsonResponse
    {
        return response()->json(new CoreSecurityEventResource(
            CoreSecurityEvent::findOrFail($id)
        ));
    }

    /**
     * @description Triage action - status change (new/reviewed/false_positive/confirmed_attack)
     * and an optional administrator note. Does not modify the diagnostic data itself
     * (event_type, ip, occurrences...) - only the administrative layer above them.
     */
    public function update(UpdateCoreSecurityEventRequest $request, $id): JsonResponse
    {
        $event = CoreSecurityEvent::findOrFail($id);
        $previousStatus = $event->status;

        $event->update($request->validated());

        $this->logAction(
            $request,
            CoreLog::class,
            'security_event_triaged',
            'Core',
            "Security event #{$event->id} ({$event->event_type}, IP: {$event->ip_address}) changed from status '{$previousStatus}' to '{$event->status}'.",
            $event->id,
            'CoreSecurityEvent'
        );

        // Wrapper {data: ...} - see bugfix-note in class header (DataHandler.put() unwrap).
        return response()->json(['data' => new CoreSecurityEventResource($event)]);
    }

    /**
     * @description Permanently deletes a single record (false detection, or GDPR request for deletion
     * of a specific IP from logs).
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        $event = CoreSecurityEvent::findOrFail($id);
        $eventType = $event->event_type;
        $ip = $event->ip_address;

        $event->delete();

        $this->logAction(
            $request,
            CoreLog::class,
            'security_event_deleted',
            'Core',
            "Security event #{$id} ({$eventType}, IP: {$ip}) was manually deleted.",
            $id,
            'CoreSecurityEvent'
        );

        return response()->json(['message' => 'Record was deleted.']);
    }

    /**
     * @description Immediate manual purge of all records older than the currently set
     * retention (`core_security_settings.retention_days`). Same logic (and same cutoff
     * date - `now() - retention_days`) as scheduled daily cleanup
     * (PurgeSecurityEventsCommand, see routes/console.php) - here runnable on
     * demand from the UI via the "Clear old records" button.
     */
    public function purge(Request $request): JsonResponse
    {
        $retentionDays = CoreSecuritySetting::current()->retention_days;
        $cutoff = Carbon::now()->subDays($retentionDays);

        $deleted = CoreSecurityEvent::where('last_seen_at', '<', $cutoff)->delete();

        $this->logAction(
            $request,
            CoreLog::class,
            'security_events_purged',
            'Core',
            "Manual cleanup of security monitoring: deleted {$deleted} records older than {$retentionDays} days.",
            null,
            'CoreSecurityEvent'
        );

        return response()->json([
            'message' => "Deleted {$deleted} records older than {$retentionDays} days.",
            'deleted' => $deleted,
        ]);
    }

    /**
     * @description Aggregated data for request/event volume chart in admin - counts
     * grouped by day for the last `$days` days (default 14), broken down by severity.
     * Sums `occurrences`, not row count - thanks to bucketing there are few rows, but `occurrences`
     * corresponds to the actual volume of suspicious requests.
     */
    public function stats(Request $request): JsonResponse
    {
        $days = (int) $request->input('days', 14);
        $from = Carbon::now()->subDays($days)->startOfDay();

        $rows = CoreSecurityEvent::query()
            // CAST to UNSIGNED - MySQL/PDO without explicit conversion often returns the result of
            // SUM() as a string, not an integer. Frontend then does `0 + "127"`, which in JS is
            // string concatenation ("0127"), not addition - see fix in
            // security-events.component.ts (buildChartDays) for defense on the other side as well.
            ->selectRaw('DATE(last_seen_at) as day, severity, CAST(SUM(occurrences) AS UNSIGNED) as total')
            ->where('last_seen_at', '>=', $from)
            ->groupBy('day', 'severity')
            ->orderBy('day')
            ->get();

        return response()->json(['data' => $rows]);
    }
}