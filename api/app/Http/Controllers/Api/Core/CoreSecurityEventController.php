<?php
/**
 * @file CoreSecurityEventController.php
 * @path app/Http/Controllers/Api/Core/CoreSecurityEventController.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Admin čtení/triage bezpečnostního monitoringu (core_security_events).
 * Zápis (`CoreSecurityEvent::record()`) probíhá výhradně interně z backendu (captcha,
 * throttle, scanning, ...) - tento kontroler NEMÁ `store()` a žádnou veřejnou POST routu,
 * na rozdíl od CoreLogController (kde POST /core/logs slouží k self-auditu z frontendu).
 *
 * @note Bez konceptu koše/restore - tyhle záznamy jsou diagnostika, ne byznys entita,
 * kterou má smysl vracet zpět. Smazání (`destroy`/`purge`) je proto rovnou trvalé.
 *
 * @bugfix-note (2026-08-22) `update()` (triage) vrací výsledek obalený v `{data: ...}` -
 * frontendový `DataHandler.put<T>()` (volaný přes `EntityCrudService::update()` z
 * `BaseDataComponent.updateData()`) automaticky odbaluje `response.data`. `show()`
 * zůstává NEobalené (volá se přes `EntityCrudService::getOne()` -> `DataHandler.get<T>()`,
 * který neodbaluje nic), stejně jako `destroy()` (přes `DataHandler.delete()`, který
 * vrácené tělo vůbec netypuje/nečte).
 *
 * @refactor-note (2026-08-22v2) AUDITNÍ LOG: `update()` (triage), `destroy()` a
 * `purge()` teď zapisují do `core_logs` (přes `LogsActivity` trait) - kdo a kdy změnil
 * stav eventu, smazal jednotlivý záznam, nebo spustil hromadný purge (a kolik záznamů
 * smazal). `store()`/zápis samotných eventů (`CoreSecurityEvent::record()`) se do
 * `core_logs` NEzapisuje - to by při útoku zahltilo audit log stejně, jako by
 * nebucketovaný zápis zahltil `core_security_events` (viz CoreSecurityEvent.php).
 * Loguje se jen administrátorská AKCE nad monitoringem, ne diagnostická data samotná.
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
     * @description Paginovaný přehled bezpečnostních eventů s filtry pro triage.
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
     * @description Detail jednoho bezpečnostního eventu.
     */
    public function show($id): JsonResponse
    {
        return response()->json(new CoreSecurityEventResource(
            CoreSecurityEvent::findOrFail($id)
        ));
    }

    /**
     * @description Triage akce - změna stavu (new/reviewed/false_positive/confirmed_attack)
     * a volitelná poznámka administrátora. Neupravuje diagnostická data samotná
     * (event_type, ip, occurrences...) - jen administrativní vrstvu nad nimi.
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
            "Bezpečnostní event #{$event->id} ({$event->event_type}, IP: {$event->ip_address}) změněn ze stavu '{$previousStatus}' na '{$event->status}'.",
            $event->id,
            'CoreSecurityEvent'
        );

        // Obal {data: ...} - viz bugfix-note v hlavičce třídy (DataHandler.put() unwrap).
        return response()->json(['data' => new CoreSecurityEventResource($event)]);
    }

    /**
     * @description Trvale smaže jeden záznam (chybná detekce, nebo GDPR žádost o výmaz
     * konkrétní IP z logů).
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
            "Bezpečnostní event #{$id} ({$eventType}, IP: {$ip}) byl ručně smazán.",
            $id,
            'CoreSecurityEvent'
        );

        return response()->json(['message' => 'Záznam byl smazán.']);
    }

    /**
     * @description Okamžitý ruční purge všech záznamů starších než aktuálně nastavená
     * retence (`core_security_settings.retention_days`). Stejná logika (a stejné cutoff
     * datum - `now() - retention_days`) jako naplánovaný denní úklid
     * (PurgeSecurityEventsCommand, viz routes/console.php) - tady spustitelná na
     * vyžádání z UI tlačítkem "Vyčistit staré záznamy".
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
            "Ruční vyčištění bezpečnostního monitoringu: smazáno {$deleted} záznamů starších než {$retentionDays} dní.",
            null,
            'CoreSecurityEvent'
        );

        return response()->json([
            'message' => "Smazáno {$deleted} záznamů starších než {$retentionDays} dní.",
            'deleted' => $deleted,
        ]);
    }

    /**
     * @description Agregovaná data pro graf objemu requestů/eventů v adminu - počty
     * seskupené po dnech za posledních `$days` dní (default 14), rozdělené podle severity.
     * Sčítá `occurrences`, ne počet řádků - díky bucketingu je řádků málo, ale `occurrences`
     * odpovídá skutečnému objemu podezřelých requestů.
     */
    public function stats(Request $request): JsonResponse
    {
        $days = (int) $request->input('days', 14);
        $from = Carbon::now()->subDays($days)->startOfDay();

        $rows = CoreSecurityEvent::query()
            // CAST na UNSIGNED - MySQL/PDO bez explicitní konverze často vrací výsledek
            // SUM() jako string, ne integer. Frontend pak dělá `0 + "127"`, což je v JS
            // konkatenace řetězců ("0127"), ne sčítání - viz oprava v
            // security-events.component.ts (buildChartDays) pro obranu i na druhé straně.
            ->selectRaw('DATE(last_seen_at) as day, severity, CAST(SUM(occurrences) AS UNSIGNED) as total')
            ->where('last_seen_at', '>=', $from)
            ->groupBy('day', 'severity')
            ->orderBy('day')
            ->get();

        return response()->json(['data' => $rows]);
    }
}