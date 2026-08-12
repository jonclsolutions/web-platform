<?php
/**
 * @file WebAttachmentResource.php
 * @path app/Http/Resources/Web/WebAttachmentResource.php
 * @project RPSW Web
 * @author RPSW
 * @created 2026
 * @description Resource transformation for individual file attachments.
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
            'created_at'        => $this->created_at?->format('Y-m-d H:i:s'),
        ];
    }
}