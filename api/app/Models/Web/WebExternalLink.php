<?php
/**
 * @file WebExternalLink.php
 * @path app/Models/Web/WebExternalLink.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Model pro externí odkazy zobrazované v adminu (Google Analytics dashboard,
 * webmail, Search Console apod.) - jen odkazy ven, žádné živé statistiky přes API.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
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
        'name',
        'url',
        'position',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}