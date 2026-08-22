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

        $contextJson = null;
        if (!empty($context)) {
            $encoded = json_encode($context, JSON_UNESCAPED_UNICODE);
            $contextJson = $encoded !== false
                ? mb_substr($encoded, 0, self::CONTEXT_MAX_LENGTH)
                : null;
        }

        // Atomický upsert - MySQL specifické (projekt je čistě MySQL/InnoDB, viz db dump).
        // Při souběžných requestech ze stejné IP/okna je tohle jediný způsob, jak
        // inkrementovat `occurrences` bez race condition a bez SELECT-pak-UPDATE.
        DB::statement(
            'INSERT INTO core_security_events
                (fingerprint, event_type, severity, ip_address, user_agent, route, method,
                 user_id, occurrences, status, context_data, first_seen_at, last_seen_at,
                 created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, "new", ?, NOW(), NOW(), NOW(), NOW())
             ON DUPLICATE KEY UPDATE
                occurrences = occurrences + 1,
                last_seen_at = NOW(),
                updated_at = NOW()',
            [
                $fingerprint,
                $eventType,
                $severity,
                $ip,
                $context['user_agent'] ?? null,
                $context['route'] ?? null,
                $context['method'] ?? null,
                $context['user_id'] ?? null,
                $contextJson,
            ]
        );
    }
}