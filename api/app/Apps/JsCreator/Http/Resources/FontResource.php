<?php
/**
 * @file FontResource.php
 * @path app/Apps/JsCreator/Http/Resources/FontResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Own font with the signed URL of its file (loaded by the browser with FontFace).
 * @dependencies App\Apps\JsCreator\Models\CreatorFont, WorkspaceFiles (signed URL).
 */

namespace App\Apps\JsCreator\Http\Resources;

use App\Apps\JsCreator\Support\WorkspaceFiles;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FontResource extends JsonResource
{
    /**
     * @description Fields of the font.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'family'     => $this->family,
            'weight'     => $this->weight,
            'style'      => $this->style,
            'format'     => $this->format,
            'size_bytes' => $this->size_bytes,
            'url'        => WorkspaceFiles::fontUrl($this->resource),
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
            'deleted_at' => $this->deleted_at?->format('Y-m-d H:i:s'),
            // Templates using the font (only in the list - TemplateUsages::usedBy()).
            'used_by'    => $this->when($this->resource->relationLoaded('usedBy'), fn () => $this->resource->getRelation('usedBy')->values()->all()),
        ];
    }
}
