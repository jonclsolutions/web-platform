<?php
/**
 * @file TemplateDetailResource.php
 * @path app/Apps/JsCreator/Http/Resources/TemplateDetailResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Template for the editor and generating: the fields of TemplateResource, the
 *   document (schema version + JSON of the editor) and - when loaded - the blocks of its
 *   instances with their documents (one request draws the whole template).
 * @dependencies TemplateResource, BlockDetailResource.
 */

namespace App\Apps\JsCreator\Http\Resources;

use Illuminate\Http\Request;

class TemplateDetailResource extends TemplateResource
{
    /**
     * @description Fields of the template with its document.
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return parent::toArray($request) + [
            'schema_version' => $this->schema_version,
            'document'       => $this->document,
            // Blocks of the instances with their documents (TemplateController::withBlocks()).
            'blocks'         => $this->when($this->resource->relationLoaded('blocks'),
                fn () => BlockDetailResource::collection($this->resource->getRelation('blocks'))->resolve($request)),
        ];
    }
}
