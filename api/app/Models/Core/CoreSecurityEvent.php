<?php
/**
 * @file CoreSecurityEvent.php
 * @path app/Models/Core/CoreSecurityEvent.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Eloquent model + zápisová logika pro `core_security_events` - diagnostický
 * log podezřelé aktivity (captcha failures, throttle, scanning, brute-force login, ...),
 * oddělený od `core_logs` (auditní log akcí přihlášených uživatelů). Záznamy vytváří
 * VÝHRADNĚ backend (žádný veřejný POST endpoint) přes statickou metodu `record()`.
 *
 * @note BUCKETING: `record()` NEVYTVÁŘÍ nový řádek na každý výskyt. Eventy se agregují do
 * časových oken (`BUCKET_SECONDS`) pomocí `fingerprint` (SHA-256 z typu události, IP,
 * route a čísla okna) a atomického `INSERT ... ON DUPLICATE KEY UPDATE`. Důvod: při
 * reálném útoku (stovky/tisíce requestů za minutu) by INSERT na každý request sám o sobě
 * přetížil databázi dřív, než útočníka vůbec stihneme zaznamenat. Díky bucketingu vznikne
 * při útoku jen několik řádků za minutu (`occurrences` se inkrementuje), ne tisíce.
 *
 * @bugfix-note (2026-08-22) FINGERPRINT MUSÍ OBSAHOVAT ROUTE. Bez ní (dřívější verze:
 * jen `event_type|ip|bucket`) se např. `throttle_exceeded` ze TŘÍ různých endpointů
 * (`/login`, `/forgot-password`, `/sales_orders`) zasažených ze stejné IP ve stejné
 * minutě slilo do JEDNOHO řádku - `occurrences` sečetl všechny tři (matoucně vysoké
 * číslo), ale zobrazená `route`/`context_data` zůstala z PRVNÍHO zápisu (upsert mění jen
 * `occurrences`/`last_seen_at`, ne route), takže admin viděl např. "17× throttle na
 * /login", i když reálně šlo o tři různé, mnohem méně dramatické útoky. Route je teď
 * součástí fingerprintu - agregace probíhá PER endpoint, ne napříč nimi.
 *
 * @bugfix-note (2026-08-22v2) VÝJIMKA PRO `scan_probe`: route-based fingerprint měl
 * nechtěný vedlejší efekt - skenování ZÁMĚRNĚ zkouší desítky/stovky RŮZNÝCH cest ze
 * stejné IP (`.env`, `wp-login.php`, `.git/config`, ...), takže s route ve fingerprintu
 * by každá zkoušená cesta dostala VLASTNÍ řádek (`occurrences: 1` u každé) - přesně ten
 * scénář zahlcení tabulky při útoku, kterému měl bucketing předejít, jen přesunutý
 * z "requestů" na "unikátních cest". Throttle/login typicky míří na pár ZNÁMÝCH
 * endpointů (login, forgot-password), takže tam je route-based rozlišení žádoucí a
 * bezpečné. `ROUTE_AGNOSTIC_EVENT_TYPES` proto pro vyjmenované typy (zatím jen
 * `scan_probe`) route z fingerprintu vynechává - jedna IP skenující cokoliv v rámci
 * jednoho 5minutového okna skončí v JEDNOM řádku s rostoucím `occurrences`, bez ohledu
 * na to, kolik různých cest zkusila. Konkrétní poslední zkoušená cesta zůstává vidět
 * v `route`/`context_data` sloupci (jen se neediscriminuje pro účely agregace).
 *
 * @refactor-note (2026-10-22) The upsert was rewritten from hand-written MySQL SQL
 * (`ON DUPLICATE KEY UPDATE`, `NOW()`, `"new"` in double quotes) to Laravel's
 * `DB::table()->upsert()`. On MariaDB it is still one atomic `INSERT ... ON DUPLICATE KEY
 * UPDATE`, but the query now also runs on SQLite, which the unit tests use. The
 * timestamps now come from PHP `now()` (application timezone) instead of the DB `NOW()`
 * (DB session timezone) - the same clock the purge (PurgeSecurityEventsCommand,
 * CoreSecurityEventController::purge) and the admin filters compare them with.
 *
 * @refactor-note (2026-08-22v3) KROK 2 BEZPEČNOSTNÍHO MONITORINGU: přidán statický helper
 * `contextFromRequest()` - sjednocuje sestavení `$context` pole (route, method, user_agent,
 * user_id) na všech hook bodech (CaptchaVerificationService, AuthController, throttle
 * exception handler, scanning fallback route), ať se stejná logika neopisuje na čtyřech
 * místech nezávisle a nerozjede se do budoucna.
 */

namespace App\Models\Core;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CoreSecurityEvent extends Model
{
    /** @description Délka časového okna pro agregaci (bucketing) jednoho fingerprintu. */
    private const BUCKET_SECONDS = 300; // 5 minut

    /**
     * @description Typy eventů, u kterých se `route` VYNECHÁVÁ z fingerprintu -
     * agregace probíhá napříč VŠEMI cestami zkoušenými danou IP v jednom okně, ne
     * per-route. Viz bugfix-note (2026-08-22v2) v hlavičce třídy - scanning záměrně
     * zkouší mnoho různých cest, route-based fingerprint by tak vytvořil jeden řádek
     * na každou zkoušenou cestu místo agregace celého náletu do pár řádků.
     */
    private const ROUTE_AGNOSTIC_EVENT_TYPES = ['scan_probe'];

    /** @description Maximální délka context_data JSON - tvrdý strop proti PII/velkým payloadům. */
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
     * @description Sestaví standardizovaný kontext z HTTP requestu pro zápis do
     * bezpečnostního eventu. Úmyslně NEOBSAHUJE tělo requestu/input data - jen metadata
     * (GDPR minimalizace, viz doc blok třídy `CONTEXT_MAX_LENGTH`).
     * @param Request $request
     * @param array $extra Doplňkové klíče (např. 'note' s krátkým lidsky čitelným detailem).
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
     * @description Zaznamená bezpečnostní událost - agregovaně, atomicky, bez zatížení
     * DB při hromadném výskytu (viz doc blok třídy).
     *
     * @param string $eventType Typ události, např. 'captcha_failed', 'throttle_exceeded',
     * 'scan_probe', 'login_failed', 'login_brute_force_suspected', 'login_2fa_invalid',
     * 'login_2fa_exhausted'.
     * @param string $severity 'info' | 'warning' | 'critical'.
     * @param string|null $ip IP adresa klienta (obvykle $request->ip()).
     * @param array $context Volitelný krátký kontext (route, method, user_agent, user_id,
     * poznámka) - typicky výstup `contextFromRequest()`. NIKDY sem nedávat celý request
     * payload/tělo formuláře.
     * @return void
     */
    public static function record(
        string $eventType,
        string $severity = 'warning',
        ?string $ip = null,
        array $context = []
    ): void {
        $bucket = intdiv(now()->timestamp, self::BUCKET_SECONDS);
        // Route je součástí fingerprintu, KROMĚ typů v ROUTE_AGNOSTIC_EVENT_TYPES
        // (zatím jen 'scan_probe') - viz bugfix-notes v hlavičce třídy. Tam se místo
        // skutečné route použije pevný placeholder 'any', ať se agregace děje napříč
        // všemi zkoušenými cestami, ne per-route.
        $route = $context['route'] ?? 'unknown';
        $fingerprintRoute = in_array($eventType, self::ROUTE_AGNOSTIC_EVENT_TYPES, true) ? 'any' : $route;
        $fingerprint = hash('sha256', $eventType . '|' . ($ip ?? 'unknown') . '|' . $fingerprintRoute . '|' . $bucket);

        $contextJson = self::encodeContext($context);

        // Atomic upsert - see refactor-note (2026-10-22) in the file header. Laravel builds
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
     *   CONTEXT_VALUE_MAX_LENGTH) instead of cutting the JSON text - see bugfix-note below.
     * @param array $context Context from record().
     * @return string|null JSON, or null for an empty / not encodable context.
     * @bugfix-note (2026-10-22) The JSON used to be cut with mb_substr() at 500 characters,
     *   which leaves invalid JSON - the model's `array` cast then returned null and the admin
     *   saw no context at all for exactly the long (most suspicious) requests. Found by the
     *   unit tests.
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
     * @bugfix-note (2026-10-22) `user_agent` and `route` are varchar(255) and the client
     *   controls both (User-Agent header, URL; `method` varchar(10) likewise). A longer value made the INSERT fail in MySQL
     *   strict mode ("Data too long"), so record() threw and the request answered 500 - e.g.
     *   a failed login with a 300-character User-Agent - and the event was never stored.
     */
    private static function limit(?string $value, int $length): ?string
    {
        return $value === null ? null : mb_substr($value, 0, $length);
    }
}
