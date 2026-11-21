<?php
/**
 * @file AssetResource.php
 * @path app/Apps/JsCreator/Http/Resources/AssetResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Image of the own library with the signed URLs of the image and its thumbnail
 *   (never a path on the disk).
 * @dependencies App\Apps\JsCreator\Models\CreatorAsset, WorkspaceFiles (signed URLs).
 */

namespace App\Apps\JsCreator\Http\Resources;

use App\Apps\JsCreator\Support\WorkspaceFiles;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AssetResource extends JsonResource
{
    /**
     * @description Fields of the image.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'name'       => $this->name,
            'mime'       => $this->mime,
            'width'      => $this->width,
            'height'     => $this->height,
            'size_bytes' => $this->size_bytes,
            'url'        => WorkspaceFiles::assetUrl($this->resource, 'original'),
            'thumb_url'  => WorkspaceFiles::assetUrl($this->resource, 'thumb'),
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
            'deleted_at' => $this->deleted_at?->format('Y-m-d H:i:s'),
        ];
    }
}
