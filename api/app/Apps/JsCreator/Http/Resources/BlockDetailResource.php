<?php

/**
 * @file BlockDetailResource.php
 * @path app/Apps/JsCreator/Http/Resources/BlockDetailResource.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description Block with its document (editor of the block; the blocks of a template for its
 *   editor, generating and thumbnails).
 * @dependencies BlockResource.
 */

namespace App\Apps\JsCreator\Http\Resources;

use Illuminate\Http\Request;

class BlockDetailResource extends BlockResource
{
    /**
     * @description Fields of the block with its document.
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
