<?php
/**
 * @file CoreSecurityEvent.php
 * @path app/Models/Core/CoreSecurityEvent.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Model and write logic of `core_security_events` - a diagnostic log of suspicious
 * activity (captcha failures, throttling, scanning, brute-force logins, ...), separate from
 * `core_logs` (audit log of the actions of logged-in users). Rows are created ONLY by the
 * backend through the static `record()` (no public POST endpoint).
 * @note BUCKETING: `record()` does NOT create a row per occurrence. Events are aggregated into
 * time windows (`BUCKET_SECONDS`) by a `fingerprint` (SHA-256 of the event type, IP, route and
 * window number) with an atomic `INSERT ... ON DUPLICATE KEY UPDATE`. During a real attack
 * (hundreds or thousands of requests a minute) an INSERT per request would overload the database
 * before the attacker is even recorded; with bucketing only a few rows a minute are created
 * (`occurrences` grows).
 */

namespace App\Models\Core;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CoreSecurityEvent extends Model
{
    /** @description Length of the aggregation window (bucket) of one fingerprint. */
    private const BUCKET_SECONDS = 300; // 5 minut

    /**
     * @description Event types whose fingerprint does NOT contain the `route`: aggregated over
     * ALL paths one IP tries in a window. Scanning tries many paths on purpose - a per-route
     * fingerprint would create one row per tried path.
     */
    private const ROUTE_AGNOSTIC_EVENT_TYPES = ['scan_probe'];

    /** @description Maximum length of the context_data JSON - a hard cap against PII / large payloads. */
    private const CONTEXT_MAX_LENGTH = 500;

    /** @description Max length of one string value when an over-long context is shortened. */
    private const CONTEXT_VALUE_MAX_LENGTH = 60;

    protected $fillable = [
        'fingerprint', 'event_type', 'severity', 'ip_address', 'user_agent',
        'route', 'method', 'user_id', 'occurrences', 'first_seen_at',
        'last_seen_at', 'status', 'notes', 'context_data',
    ];

    protected $casts = [
        'first_seen_at' => 'datetime',
        'last_seen_at'  => 'datetime',
        'context_data'  => 'array',
        'occurrences'   => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @description Builds the standard context of a security event from the HTTP request. Holds
     * NO request body / input data - only metadata (GDPR data minimization, CONTEXT_MAX_LENGTH).
     * @param Request $request
     * @param array $extra Extra keys (e.g. 'note' with a short human-readable detail).
     * @return array
     */
    public static function contextFromRequest(Request $request, array $extra = []): array
    {
        return array_merge([
            'route'      => $request->path(),
            'method'     => $request->method(),
            'user_agent' => $request->userAgent(),
            'user_id'    => $request->user()?->id,
        ], $extra);
    }

    /**
     * @description Records a security event - aggregated and atomic, without loading the database
     * on mass occurrence (see the class description).
     *
     * @param string $eventType Event type, e.g. 'captcha_failed', 'throttle_exceeded',
     * 'scan_probe', 'login_failed', 'login_brute_force_suspected', 'login_2fa_invalid',
     * 'login_2fa_exhausted'.
     * @param string $severity 'info' | 'warning' | 'critical'.
     * @param string|null $ip IP address of the client (usually $request->ip()).
     * @param array $context Optional short context (route, method, user_agent, user_id, note) -
     * usually from `contextFromRequest()`. NEVER the whole request payload / form body.
     * @return void
     */
    public static function record(
        string $eventType,
        string $severity = 'warning',
        ?string $ip = null,
        array $context = []
    ): void {
        $bucket = intdiv(now()->timestamp, self::BUCKET_SECONDS);
        // The route is part of the fingerprint, EXCEPT for ROUTE_AGNOSTIC_EVENT_TYPES ('scan_probe'):
        // there a fixed placeholder 'any' is used, so the aggregation spans every tried path.
        $route = $context['route'] ?? 'unknown';
        $fingerprintRoute = in_array($eventType, self::ROUTE_AGNOSTIC_EVENT_TYPES, true) ? 'any' : $route;
        $fingerprint = hash('sha256', $eventType . '|' . ($ip ?? 'unknown') . '|' . $fingerprintRoute . '|' . $bucket);

        $contextJson = self::encodeContext($context);

        // Atomic upsert. Laravel builds
        // `INSERT ... ON DUPLICATE KEY UPDATE` on MySQL/MariaDB and `INSERT ... ON CONFLICT
        // (fingerprint) DO UPDATE` on SQLite (tests) - one atomic statement in both cases,
        // no race condition and no SELECT-then-UPDATE. `occurrences + 1` refers to the
        // stored row in both dialects.
        $now = now();
        DB::table('core_security_events')->upsert(
            [[
                'fingerprint'   => $fingerprint,
                'event_type'    => $eventType,
                'severity'      => $severity,
                'ip_address'    => $ip,
                'user_agent'    => self::limit($context['user_agent'] ?? null, 255),
                'route'         => self::limit($context['route'] ?? null, 255),
                'method'        => self::limit($context['method'] ?? null, 10),
                'user_id'       => $context['user_id'] ?? null,
                'occurrences'   => 1,
                'status'        => 'new',
                'context_data'  => $contextJson,
                'first_seen_at' => $now,
                'last_seen_at'  => $now,
                'created_at'    => $now,
                'updated_at'    => $now,
            ]],
            ['fingerprint'],
            [
                'occurrences'  => DB::raw('occurrences + 1'),
                'last_seen_at' => $now,
                'updated_at'   => $now,
            ]
        );
    }

    /**
     * @description Encodes the event context as JSON of at most CONTEXT_MAX_LENGTH characters.
     *   An over-long context is shortened VALUE by value (every string cut to
     *   CONTEXT_VALUE_MAX_LENGTH) instead of cutting the JSON text.
     * @param array $context Context from record().
     * @return string|null JSON, or null for an empty / not encodable context.
     */
    private static function encodeContext(array $context): ?string
    {
        if (empty($context)) {
            return null;
        }

        $encoded = json_encode($context, JSON_UNESCAPED_UNICODE);
        if ($encoded === false) {
            return null;
        }
        if (mb_strlen($encoded) <= self::CONTEXT_MAX_LENGTH) {
            return $encoded;
        }

        $shortened = array_map(
            fn ($value) => is_string($value) ? self::limit($value, self::CONTEXT_VALUE_MAX_LENGTH) : $value,
            $context
        );
        $encoded = json_encode($shortened, JSON_UNESCAPED_UNICODE);

        return mb_strlen($encoded) <= self::CONTEXT_MAX_LENGTH ? $encoded : json_encode(['_truncated' => true]);
    }

    /**
     * @description Cuts a string to the column length (null stays null).
     * @param string|null $value Value to store.
     * @param int $length Maximum length in characters.
     * @return string|null
     */
    private static function limit(?string $value, int $length): ?string
    {
        return $value === null ? null : mb_substr($value, 0, $length);
    }
}
