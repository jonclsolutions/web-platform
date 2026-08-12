<?php
/**
 * @file WebAttachment.php
 * @path app/Models/Web/WebAttachment.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Univerzální (polymorfní) model přílohy - znovupoužitelný pro libovolnou
 * entitu (WebRawRequestCommission, WebSalesOrder, a v budoucnu i admin formuláře - viz
 * task "část 2"). Nahrazuje dřívější jednosouborová pole `file_path`/`attachment_path`
 * roztroušená po jednotlivých modelech.
 * @note Timestampy jen `created_at` (žádné `updated_at`) - příloha se po nahrání nikdy
 * needituje, jen přidává/maže.
 */

namespace App\Models\Web;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class WebAttachment extends Model
{
    const UPDATED_AT = null;

    protected $fillable = [
        'disk',
        'path',
        'original_filename',
        'mime_type',
        'size_bytes',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
        'created_at' => 'datetime',
    ];

    public function attachable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @description Veřejná URL k souboru na daném disku.
     */
    public function getUrlAttribute(): string
    {
        return asset('storage/' . $this->path);
    }
}