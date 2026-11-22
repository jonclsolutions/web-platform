<?php
/**
 * @file OutputResource.php
 * @path app/Apps/JsCreator/Http/Resources/OutputResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Generated output: name, folder, the template it was made from (id - null after the
 *   template was deleted for good - and its name at the time of generating), text of the post,
 *   size, format, size on the disk and the signed URLs of the first page (picture, thumbnail,
 *   download).
 * @dependencies CreatorOutput (with `files` loaded), WorkspaceFiles.
 */

namespace App\Apps\JsCreator\Http\Resources;

use App\Apps\JsCreator\Support\WorkspaceFiles;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OutputResource extends JsonResource
{
    /**
     * @description Fields of the output.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'section'       => $this->section,
            'folder_id'     => $this->folder_id,
            'name'          => $this->name,
            'template_id'   => $this->template_id,
            'template_name' => $this->template_name,
            'caption'       => $this->caption,
            'width'         => $this->width,
            'height'        => $this->height,
            'format'        => $this->format,
            'page_count'    => $this->page_count,
            'size_bytes'    => $this->size_bytes,
            'url'           => WorkspaceFiles::outputUrl($this->resource, 'original'),
            'thumb_url'     => WorkspaceFiles::outputUrl($this->resource, 'thumb'),
            'download_url'  => WorkspaceFiles::outputUrl($this->resource, 'download'),
            'created_at'    => $this->created_at?->format('Y-m-d H:i:s'),
            'updated_at'    => $this->updated_at?->format('Y-m-d H:i:s'),
            'deleted_at'    => $this->deleted_at?->format('Y-m-d H:i:s'),
        ];
    }
}
