<?php

/**
 * @file SetResource.php
 * @path app/Apps/JsCreator/Http/Resources/SetResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Set: name, caption pattern and its templates in their order (name, size, output
 *   format, thumbnail, whether it is in the trash - such a template is skipped when generating).
 * @dependencies CreatorSet (templates loaded), WorkspaceFiles.
 */

namespace App\Apps\JsCreator\Http\Resources;

use App\Apps\JsCreator\Models\CreatorTemplate;
use App\Apps\JsCreator\Support\WorkspaceFiles;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SetResource extends JsonResource
{
    /**
     * @description Fields of the set.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'section'          => $this->section,
            'name'             => $this->name,
            'caption_template' => $this->caption_template,
            'templates'        => $this->templates->map(fn (CreatorTemplate $template) => [
                'id'            => $template->id,
                'name'          => $template->name,
                'width'         => $template->width,
                'height'        => $template->height,
                'output_format' => $template->output_format,
                'thumb_url'     => WorkspaceFiles::templateThumbUrl($template),
                'trashed'       => $template->trashed(),
            ])->values()->all(),
            'created_at'       => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'       => $this->updated_at?->format('Y-m-d H:i:s'),
            'deleted_at'       => $this->deleted_at?->format('Y-m-d H:i:s'),
        ];
    }
}
