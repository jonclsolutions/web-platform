<?php
/**
 * @file TemplateResource.php
 * @path app/Apps/JsCreator/Http/Resources/TemplateResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Template in a list: name, size, output format, caption pattern, signed URL of the
 *   thumbnail (null until the editor saves one; `thumb_stale` = a block it uses changed since)
 *   and the version. Without the document - TemplateDetailResource adds it.
 * @dependencies CreatorTemplate, WorkspaceFiles.
 */

namespace App\Apps\JsCreator\Http\Resources;

use App\Apps\JsCreator\Support\WorkspaceFiles;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TemplateResource extends JsonResource
{
    /**
     * @description Fields of the template.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'section'          => $this->section,
            'name'             => $this->name,
            'width'            => $this->width,
            'height'           => $this->height,
            'output_format'    => $this->output_format,
            'output_quality'   => $this->output_quality,
            'caption_template' => $this->caption_template,
            'thumb_url'        => WorkspaceFiles::templateThumbUrl($this->resource),
            // A block of the template changed after the thumbnail was drawn (the list draws it again).
            'thumb_stale'      => (bool) $this->thumb_stale,
            'version'          => $this->version,
            // Personal helpers: starred, last generated, default folder of its outputs.
            'favorite'          => (bool) $this->favorite,
            'last_used_at'      => $this->last_used_at?->format('Y-m-d H:i:s'),
            'default_folder_id' => $this->default_folder_id,
            'created_at'       => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'       => $this->updated_at?->format('Y-m-d H:i:s'),
            'deleted_at'       => $this->deleted_at?->format('Y-m-d H:i:s'),
        ];
    }
}
