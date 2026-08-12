<?php
/**
 * @file WebAttachmentResource.php
 * @path app/Http/Resources/Web/WebAttachmentResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Resource transformation for individual file attachments.
 * @refactor-note (2026-08-3) Přidána `download_url`/`view_url` pole, mířící na
 *      `PublicFileDownloadController` (/api/download-file/{path}, /api/view-file/{path})
 *      místo přímého odkazu na storage symlink. Původní `url` pole ZŮSTÁVÁ beze změny
 *      (může se hodit pro <img src> náhledy obrázků atd.), ale pro STAHOVÁNÍ/NÁHLED
 *      v adminu musí frontend přejít na `download_url`/`view_url` - `url` vždy servíruje
 *      soubor pod interním hashovaným jménem na disku (Laravel/Storage v tom neumí nic
 *      ovlivnit u přímého symlink odkazu), zatímco `download_url`/`view_url` jdou přes
 *      PublicFileDownloadController, který dohledá a použije `original_filename`.
 */

namespace App\Http\Resources\Web;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WebAttachmentResource extends JsonResource
{
public function toArray(Request $request): array
    {
return [
'id'                => $this->id,
'original_filename' => $this->original_filename,
'mime_type'         => $this->mime_type,
'size_bytes'        => $this->size_bytes,
'url'               => $this->url,
'download_url'      => $this->path ? url('/api/download-file/' . $this->path) : null,
'view_url'          => $this->path ? url('/api/view-file/' . $this->path) : null,
'created_at'        => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }
}