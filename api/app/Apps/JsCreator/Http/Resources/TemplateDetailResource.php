<?php
/**
 * @file TemplateDetailResource.php
 * @path app/Apps/JsCreator/Http/Resources/TemplateDetailResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Template for the editor: the fields of TemplateResource and the document (schema
 *   version + JSON of the editor).
 * @dependencies TemplateResource.
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
        ];
    }
}
