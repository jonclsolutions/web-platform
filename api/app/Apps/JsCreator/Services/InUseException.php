<?php
/**
 * @file InUseException.php
 * @path app/Apps/JsCreator/Services/InUseException.php
 * @project JS web-platform
 * @author JS
 * @created 2026
 * @description A library image, own font or block cannot be deleted while a template or block
 *   (also one in the trash) uses it: 409 `in_use` with the list of those templates and blocks
 *   (`kind` template | block; they belong to the same account, so their names may be shown).
 * @dependencies TemplateUsages::ensureUnused().
 */

namespace App\Apps\JsCreator\Services;

use Illuminate\Http\JsonResponse;
use RuntimeException;

final class InUseException extends RuntimeException
{
    /**
     * @param list<array{id: int, kind: string, name: string, section: string, trashed: bool}> $templates Templates / blocks using it.
     */
    public function __construct(public readonly array $templates)
    {
        parent::__construct('in_use');
    }

    /**
     * @description Answer of the API (Laravel calls render() of the exception).
     * @return JsonResponse 409.
     */
    public function render(): JsonResponse
    {
        return response()->json([
            'message'    => 'It is used by a template or a block. Remove it from them (or delete them for good) first.',
            'error_code' => 'in_use',
            'used_by'    => $this->templates,
        ], 409);
    }
}
