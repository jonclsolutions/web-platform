<?php
/**
 * @file CoreExternalLink.php
 * @path app/Models/Core/CoreExternalLink.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model pro externí odkazy zobrazované v adminu (Google Analytics dashboard,
 * webmail, Search Console apod.) - jen odkazy ven, žádné živé statistiky přes API.
 *
 * @refactor-note (2026-08) Odkazy jsou nyní PLNĚ SOUKROMÉ per-uživatel (`user_id`,
 * FK ON DELETE CASCADE) - dřív byly sdílené napříč všemi administrátory. Veškeré
 * vlastnické scopování řeší CoreExternalLinkController (nikdy nedůvěřuje `user_id`
 * poslanému z klienta - vždy bere `$request->user()->id`).
 *
 * @refactor-note (2026-08-31) ODSTRANĚNY `position`/`is_active` - viz SQL migrace
 * (DROP COLUMN position, is_active) a CoreExternalLinkController/external-links.config.ts
 * stejné datum. Odkazy se teď řadí abecedně podle `name` (výchozí `sort_by` v index()) -
 * dřív podle ručního `position`. Zobrazení v adminu už nemá stavový přepínač
 * aktivní/neaktivní - všechny uložené odkazy jsou vždy zobrazené.
 *
 * @refactor-note (2026-08-31v2) PŘEJMENOVÁNA TABULKA `web_external_links` ->
 * `core_external_links` - opravuje historický nesoulad (model/controller/routa žijí
 * pod `Core` namespace a `/core` prefixem, ale tabulka v DB si donedávna nesla staré
 * jméno z doby, než byl resource přesunut z `web` pod `core` - viz poznámka
 * u EXTERNAL_LINK_* permission klíčů v external-links.config.ts, kde ke stejnému
 * přejmenování došlo už dřív u permission stringů). SQL migrace (RENAME TABLE)
 * spuštěna přímo na serveru. `$table` je JEDINÉ místo v celé aplikaci, které název
 * tabulky nese natvrdo - controller/resource/request pracují výhradně přes tento
 * Eloquent model, žádná jiná úprava nebyla potřeba.
 */

namespace App\Models\Core;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

/**
 * @property int $user_id Vlastník odkazu - odkaz vidí a spravuje výhradně tento uživatel.
 * @property string $name Zobrazovaný název odkazu.
 * @property string $url Cílová URL adresa.
 */
class CoreExternalLink extends Model
{
    use SoftDeletes;

    protected $table = 'core_external_links';

    protected $fillable = [
        'user_id',
        'name',
        'url',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}