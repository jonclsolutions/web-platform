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
 * @refactor-note (2026-10-23) The `url` accessor (`asset('storage/' . path)`) was removed (open
 *   finding #9): attachments live on the `private` disk without a public storage link, so the
 *   URL was dead - and for a file on a public disk it would have bypassed the signed routes. Files
 *   are reachable ONLY through the signed `download_url` / `view_url` of WebAttachmentResource.
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
}