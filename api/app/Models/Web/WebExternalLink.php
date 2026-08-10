<?php
/**
 * @file WebExternalLink.php
 * @path app/Models/Web/WebExternalLink.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model pro externí odkazy zobrazované v adminu (Google Analytics dashboard,
 * webmail, Search Console apod.) - jen odkazy ven, žádné živé statistiky přes API.
 *
 * @refactor-note (2026-08) Odkazy jsou nyní PLNĚ SOUKROMÉ per-uživatel (`user_id`,
 * FK ON DELETE CASCADE) - dřív byly sdílené napříč všemi administrátory. Veškeré
 * vlastnické scopování řeší WebExternalLinkController (nikdy nedůvěřuje `user_id`
 * poslanému z klienta - vždy bere `$request->user()->id`).
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

/**
 * @property int $user_id Vlastník odkazu - odkaz vidí a spravuje výhradně tento uživatel.
 * @property string $name Zobrazovaný název odkazu.
 * @property string $url Cílová URL adresa.
 * @property int $position Pořadí zobrazení v adminu.
 * @property bool $is_active Zda se odkaz má v adminu zobrazovat.
 */
class WebExternalLink extends Model
{
    use SoftDeletes;

    protected $table = 'web_external_links';

    protected $fillable = [
        'user_id',
        'name',
        'url',
        'position',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}